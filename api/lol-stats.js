/**
 * BLACK PHANTOM ESPORTS — Vercel Serverless Function
 * Proxy seguro entre el frontend y la API de Riot Games.
 * La RIOT_API_KEY nunca se expone al cliente.
 *
 * Endpoint: GET /api/lol-stats?gameName=nyx&tagLine=ak4&region=euw1
 *
 * Mejoras de fiabilidad:
 *  - Reintentos automáticos con backoff exponencial en 429/500
 *  - Peticiones de partidas secuenciales (no en paralelo) para respetar rate limits
 *  - Caché más larga (10 min) para reducir presión sobre la API
 *  - Fallback a unranked si falla el endpoint de ranked
 *  - Manejo explícito de 429 con Retry-After header
 */

/** Espera N milisegundos */
const sleep = ms => new Promise(r => setTimeout(r, ms));

const REGION_ROUTING = {
  euw1:  { platform: 'euw1',  regional: 'europe'    },
  eune1: { platform: 'eune1', regional: 'europe'    },
  na1:   { platform: 'na1',   regional: 'americas'  },
  br1:   { platform: 'br1',   regional: 'americas'  },
  la1:   { platform: 'la1',   regional: 'americas'  },
  la2:   { platform: 'la2',   regional: 'americas'  },
  kr:    { platform: 'kr',    regional: 'asia'       },
  jp1:   { platform: 'jp1',   regional: 'asia'       },
  tr1:   { platform: 'tr1',   regional: 'europe'    },
  ru:    { platform: 'ru',    regional: 'europe'    },
  oc1:   { platform: 'oc1',   regional: 'sea'        },
};

/**
 * Fetch con reintentos automáticos y backoff exponencial.
 * Reintenta en 429 (rate limit) y 5xx (error servidor).
 */
async function riotFetch(url, apiKey, maxRetries = 4) {
  let lastError;

  for (let attempt = 0; attempt <= maxRetries; attempt++) {
    const res = await fetch(url, {
      headers: { 'X-Riot-Token': apiKey },
    });

    if (res.ok) return res.json();

    // Rate limit: respetar el header Retry-After si existe
    if (res.status === 429) {
      const retryAfter = parseInt(res.headers.get('Retry-After') ?? '1', 10);
      const waitMs = Math.max(retryAfter * 1000, 1000) + Math.random() * 500;
      console.warn(`[lol-stats] 429 — esperando ${Math.round(waitMs)}ms (intento ${attempt + 1}/${maxRetries + 1})`);
      await sleep(waitMs);
      lastError = new Error('Rate limited (429)');
      continue;
    }

    // Error servidor: backoff exponencial
    if (res.status >= 500) {
      const waitMs = Math.pow(2, attempt) * 500 + Math.random() * 300;
      console.warn(`[lol-stats] ${res.status} — esperando ${Math.round(waitMs)}ms (intento ${attempt + 1}/${maxRetries + 1})`);
      await sleep(waitMs);
      lastError = new Error(`Riot API ${res.status}`);
      continue;
    }

    // Error cliente (4xx distinto de 429): no reintentar
    const errText = await res.text();
    throw new Error(`Riot API ${res.status}: ${errText}`);
  }

  throw lastError ?? new Error('Max retries reached');
}

/**
 * Obtiene detalles de partidas de forma secuencial con pausa entre cada una.
 * Evita disparar 10 peticiones en paralelo que saturan el rate limit.
 */
async function fetchMatchesSequentially(matchIds, regional, apiKey, delayMs = 150) {
  const results = [];
  for (const id of matchIds) {
    try {
      const match = await riotFetch(
        `https://${regional}.api.riotgames.com/lol/match/v5/matches/${id}`,
        apiKey
      );
      results.push(match);
    } catch (err) {
      // Si falla una partida individual la saltamos — mejor datos parciales que nada
      console.warn(`[lol-stats] No se pudo obtener partida ${id}: ${err.message}`);
    }
    if (delayMs > 0) await sleep(delayMs);
  }
  return results;
}

export default async function handler(req, res) {
  // CORS — permite peticiones desde tu dominio Vercel y localhost
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  if (req.method === 'OPTIONS') return res.status(200).end();

  const API_KEY = process.env.RIOT_API_KEY;
  if (!API_KEY) {
    return res.status(500).json({ error: 'RIOT_API_KEY no configurada en Vercel.' });
  }

  const { gameName, tagLine, region = 'euw1' } = req.query;
  if (!gameName || !tagLine) {
    return res.status(400).json({ error: 'Parámetros gameName y tagLine requeridos.' });
  }

  const routing = REGION_ROUTING[region.toLowerCase()] ?? REGION_ROUTING['euw1'];

  try {
    // 1. Obtener PUUID por Riot ID
    const account = await riotFetch(
      `https://${routing.regional}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(gameName)}/${encodeURIComponent(tagLine)}`,
      API_KEY
    );
    const { puuid } = account;

    // 2. Summoner y Ranked en paralelo (son independientes entre sí)
    const [summoner, rankedData] = await Promise.all([
      riotFetch(
        `https://${routing.platform}.api.riotgames.com/lol/summoner/v4/summoners/by-puuid/${puuid}`,
        API_KEY
      ),
      riotFetch(
        `https://${routing.platform}.api.riotgames.com/lol/league/v4/entries/by-puuid/${puuid}`,
        API_KEY
      ).catch(() => []), // Si falla ranked, continuar con unranked
    ]);

    // Preferir SoloQ, fallback a Flex, fallback a null (Unranked)
    const soloQ  = rankedData.find(e => e.queueType === 'RANKED_SOLO_5x5');
    const flex   = rankedData.find(e => e.queueType === 'RANKED_TEAM_5x5');
    const ranked = soloQ ?? flex ?? null;

    // 3. IDs de las últimas 10 partidas ranked
    let matchIds = [];
    try {
      matchIds = await riotFetch(
        `https://${routing.regional}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?queue=420&start=0&count=10`,
        API_KEY
      );
      // Si no hay ranked, intentar con todas las colas
      if (matchIds.length === 0) {
        matchIds = await riotFetch(
          `https://${routing.regional}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=10`,
          API_KEY
        );
      }
    } catch (err) {
      console.warn(`[lol-stats] No se pudieron obtener match IDs para ${gameName}: ${err.message}`);
    }

    // 4. Detalles de partidas — SECUENCIAL con pausa para respetar rate limits
    // (en lugar de Promise.all que dispara 10 peticiones simultáneas)
    const matchDetails = await fetchMatchesSequentially(
      matchIds.slice(0, 10),
      routing.regional,
      API_KEY,
      150 // 150ms entre cada partida
    );

    // 6. Calcular estadísticas de las últimas 10 partidas
    let totalKills = 0, totalDeaths = 0, totalAssists = 0;
    let totalCS = 0, totalVisionScore = 0, totalDamage = 0;
    let wins = 0;
    const championCount = {};
    const recentMatches = [];

    matchDetails.forEach(match => {
      const participant = match.info.participants.find(p => p.puuid === puuid);
      if (!participant) return;

      totalKills    += participant.kills;
      totalDeaths   += participant.deaths;
      totalAssists  += participant.assists;
      totalCS       += participant.totalMinionsKilled + (participant.neutralMinionsKilled ?? 0);
      totalVisionScore += participant.visionScore ?? 0;
      totalDamage   += participant.totalDamageDealtToChampions;
      if (participant.win) wins++;

      const champ = participant.championName;
      championCount[champ] = (championCount[champ] ?? 0) + 1;

      recentMatches.push({
        champion:  champ,
        win:       participant.win,
        kills:     participant.kills,
        deaths:    participant.deaths,
        assists:   participant.assists,
        cs:        participant.totalMinionsKilled + (participant.neutralMinionsKilled ?? 0),
        duration:  Math.round(match.info.gameDuration / 60),
      });
    });

    const n = matchDetails.length || 1;
    const avgKills    = (totalKills    / n).toFixed(1);
    const avgDeaths   = (totalDeaths   / n).toFixed(1);
    const avgAssists  = (totalAssists  / n).toFixed(1);
    const avgCS       = Math.round(totalCS       / n);
    const avgVision   = Math.round(totalVisionScore / n);
    const avgDamage   = Math.round(totalDamage   / n);
    const kda         = totalDeaths === 0
      ? 'Perfect'
      : ((totalKills + totalAssists) / totalDeaths).toFixed(2);
    const winRate     = Math.round((wins / n) * 100);

    // Campeón más jugado
    const mostPlayed = Object.entries(championCount)
      .sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'Unknown';

    // Versión del parche para Data Dragon (icono de campeón y rango)
    // Usamos la versión más reciente automáticamente
    const versionsRes = await fetch('https://ddragon.leagueoflegends.com/api/versions.json');
    const versions    = await versionsRes.json();
    const patch       = versions[0];

    // Construir respuesta final
    const payload = {
      summoner: {
        name:           `${gameName}#${tagLine}`,
        level:          summoner.summonerLevel,
        profileIconUrl: `https://ddragon.leagueoflegends.com/cdn/${patch}/img/profileicon/${summoner.profileIconId}.png`,
      },
      ranked: ranked ? {
        tier:          ranked.tier,        // GOLD, PLATINUM...
        rank:          ranked.rank,        // I, II, III, IV
        lp:            ranked.leaguePoints,
        wins:          ranked.wins,
        losses:        ranked.losses,
        winRate:       Math.round((ranked.wins / (ranked.wins + ranked.losses)) * 100),
        hotStreak:     ranked.hotStreak,
        veteran:       ranked.veteran,
        rankEmblemUrl: `https://raw.communitydragon.org/latest/plugins/rcp-fe-lol-shared-components/global/default/${ranked.tier.toLowerCase()}.png`,
      } : null,
      last10: {
        wins,
        losses:    n - wins,
        winRate,
        avgKills,
        avgDeaths,
        avgAssists,
        kda,
        avgCS,
        avgVision,
        avgDamage:   (avgDamage / 1000).toFixed(1) + 'k',
        mostPlayed,
        championIconUrl: `https://ddragon.leagueoflegends.com/cdn/${patch}/img/champion/${mostPlayed}.png`,
        recentMatches: recentMatches.slice(0, 5),
      },
      patch,
    };

    // Caché 10 min en Vercel Edge (stale-while-revalidate 20 min)
    res.setHeader('Cache-Control', 's-maxage=600, stale-while-revalidate=1200');
    return res.status(200).json(payload);

  } catch (err) {
    console.error('[lol-stats]', err.message);
    return res.status(500).json({ error: err.message });
  }
}