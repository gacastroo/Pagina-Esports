/* ─────────────────────────────────────────
   BLACK PHANTOM ESPORTS — main.js
   ───────────────────────────────────────── */

document.addEventListener('DOMContentLoaded', () => {

  /* ── Custom cursor ── */
  const cursor      = document.getElementById('cursor');
  const cursorTrail = document.getElementById('cursor-trail');

  let mouseX = 0, mouseY = 0;
  let trailX  = 0, trailY  = 0;

  document.addEventListener('mousemove', e => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    cursor.style.left = mouseX - 5 + 'px';
    cursor.style.top  = mouseY - 5 + 'px';
  });

  function animateTrail() {
    trailX += (mouseX - trailX) * 0.12;
    trailY += (mouseY - trailY) * 0.12;
    cursorTrail.style.left = trailX - 14 + 'px';
    cursorTrail.style.top  = trailY - 14 + 'px';
    requestAnimationFrame(animateTrail);
  }

  animateTrail();

  /* ── Scroll reveal ── */
  const reveals = document.querySelectorAll('.reveal');

  const revealObserver = new IntersectionObserver(entries => {
    entries.forEach(entry => {
      if (entry.isIntersecting) {
        entry.target.classList.add('visible');
        revealObserver.unobserve(entry.target);
      }
    });
  }, { threshold: 0.1 });

  reveals.forEach(el => revealObserver.observe(el));

  /* ── Navbar scroll state ── */
  const navbar = document.querySelector('nav');

  window.addEventListener('scroll', () => {
    if (window.scrollY > 80) {
      navbar.style.background = 'rgba(0,0,0,0.97)';
      navbar.style.borderBottomColor = 'rgba(255,255,255,0.08)';
    } else {
      navbar.style.background = 'linear-gradient(180deg, rgba(0,0,0,0.95) 0%, rgba(0,0,0,0) 100%)';
      navbar.style.borderBottomColor = 'rgba(255,255,255,0.04)';
    }
  }, { passive: true });

  /* ── Smooth anchor links ── */
  document.querySelectorAll('a[href^="#"]').forEach(anchor => {
    anchor.addEventListener('click', e => {
      const target = document.querySelector(anchor.getAttribute('href'));
      if (target) {
        e.preventDefault();
        target.scrollIntoView({ behavior: 'smooth' });
      }
    });
  });

});

/* ─────────────────────────────────────────────────────────────
   BLACK PHANTOM ESPORTS — Stats Loader
   Añade esto al FINAL de js/main.js (o como <script> al final del body)
   ───────────────────────────────────────────────────────────── */

/* ─────────────────────────────────────────────────────────────
   BLACK PHANTOM ESPORTS — Stats Loader
   ───────────────────────────────────────────────────────────── */

(function () {

  const TIER_COLORS = {
    IRON:        '#7a6a6a',
    BRONZE:      '#a0704a',
    SILVER:      '#a8b0c0',
    GOLD:        '#c8a832',
    PLATINUM:    '#30a890',
    EMERALD:     '#50c878',
    DIAMOND:     '#7890e0',
    MASTER:      '#a050d0',
    GRANDMASTER: '#d04040',
    CHALLENGER:  '#e8c040',
  };

  const sleep = ms => new Promise(r => setTimeout(r, ms));

  function applyWinrateColor(el, wr) {
    const n = parseInt(wr);
    el.classList.remove('wr-high','wr-mid','wr-low');
    if (n >= 55)      el.classList.add('wr-high');
    else if (n >= 45) el.classList.add('wr-mid');
    else              el.classList.add('wr-low');
  }

  function renderCard(card, data) {
    const loading = card.querySelector('.stat-card-loading');
    const content = card.querySelector('.stat-card-content');

    card.querySelector('.stat-summoner-name').textContent = data.summoner.name;
    card.querySelector('.stat-icon').src = data.summoner.profileIconUrl;
    card.querySelector('.stat-level').textContent = data.summoner.level;

    if (data.ranked) {
      const tier   = data.ranked.tier;
      const tierEl = card.querySelector('.stat-tier');
      tierEl.textContent = `${tier} ${data.ranked.rank}`;
      tierEl.style.color = TIER_COLORS[tier] ?? 'var(--accent)';

      card.querySelector('.stat-lp').textContent      = `${data.ranked.lp} LP`;
      card.querySelector('.stat-rank-emblem').src      = data.ranked.rankEmblemUrl;
      card.querySelector('.stat-winrate').textContent = `${data.ranked.winRate}%`;
      card.querySelector('.stat-wl').textContent      = `${data.ranked.wins}W ${data.ranked.losses}L`;
      applyWinrateColor(card.querySelector('.stat-winrate'), data.ranked.winRate);

      if (data.ranked.hotStreak) {
        const nick  = card.querySelector('.stat-nickname');
        const badge = document.createElement('span');
        badge.className   = 'stat-streak-badge';
        badge.textContent = '🔥 Racha';
        nick.appendChild(badge);
      }
    } else {
      card.querySelector('.stat-tier').textContent              = 'UNRANKED';
      card.querySelector('.stat-lp').textContent                = '—';
      card.querySelector('.stat-rank-emblem').style.display     = 'none';
      card.querySelector('.stat-winrate').textContent           = '—';
      card.querySelector('.stat-wl').textContent                = '—';
    }

    const l10 = data.last10;
    card.querySelector('.stat-l10-wins').textContent          = `${l10.wins}W`;
    card.querySelector('.stat-l10-losses').textContent        = `${l10.losses}L`;
    card.querySelector('.stat-l10-bar-fill').style.width      = `${l10.winRate}%`;
    card.querySelector('.stat-kda').textContent               = l10.kda === 'Perfect' ? '∞ KDA' : `${l10.kda} KDA`;
    card.querySelector('.stat-avg-kills').textContent         = `${l10.avgKills} / ${l10.avgDeaths} / ${l10.avgAssists}`;
    card.querySelector('.stat-avg-cs').textContent            = l10.avgCS;
    card.querySelector('.stat-avg-damage').textContent        = l10.avgDamage;
    card.querySelector('.stat-champ-icon').src                = l10.championIconUrl;
    card.querySelector('.stat-champ-name').textContent        = l10.mostPlayed;

    const histList = card.querySelector('.stat-history-list');
    histList.innerHTML = '';
    (l10.recentMatches || []).forEach(m => {
      const row = document.createElement('div');
      row.className = `stat-match-row ${m.win ? 'win' : 'loss'}`;
      row.innerHTML = `
        <span class="stat-match-result">${m.win ? 'WIN' : 'LOSS'}</span>
        <span class="stat-match-champ">${m.champion}</span>
        <span class="stat-match-kda">${m.kills}/${m.deaths}/${m.assists}</span>
        <span class="stat-match-dur">${m.duration}m</span>
      `;
      histList.appendChild(row);
    });

    loading.style.display = 'none';
    content.style.display = 'block';
  }

  function showError(card, retryFn) {
    card.querySelector('.stat-card-loading').style.display = 'none';
    const errorEl = card.querySelector('.stat-card-error');
    errorEl.style.display = 'flex';

    // Añadir botón de reintento si no existe ya
    if (!errorEl.querySelector('.stat-retry-btn')) {
      const btn = document.createElement('button');
      btn.className   = 'stat-retry-btn';
      btn.textContent = '↺ Reintentar';
      btn.style.cssText = 'margin-top:10px;padding:6px 14px;background:var(--accent);color:#000;border:none;cursor:pointer;font-size:12px;font-weight:700;letter-spacing:.05em;';
      btn.addEventListener('click', () => {
        errorEl.style.display = 'none';
        card.querySelector('.stat-card-loading').style.display = 'flex';
        retryFn();
      });
      errorEl.appendChild(btn);
    }
  }

  /**
   * Carga los datos de un jugador con reintentos automáticos en el cliente.
   * Útil si el serverless devuelve 500 por un pico puntual.
   */
  async function loadPlayerStats(card, maxRetries = 2) {
    const player = card.dataset.player;
    const tag    = card.dataset.tag;
    const region = card.dataset.region;

    const url = `/api/lol-stats?gameName=${encodeURIComponent(player)}&tagLine=${encodeURIComponent(tag)}&region=${encodeURIComponent(region)}`;

    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        const res = await fetch(url);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        renderCard(card, data);
        return; // éxito
      } catch (err) {
        console.warn(`[LoL Stats] ${player}#${tag} — intento ${attempt + 1}/${maxRetries + 1}: ${err.message}`);
        if (attempt < maxRetries) {
          // Espera exponencial: 2s, 4s entre reintentos
          await sleep(Math.pow(2, attempt + 1) * 1000);
        }
      }
    }

    // Todos los intentos fallaron
    console.error(`[LoL Stats] ${player}#${tag}: no se pudo cargar tras ${maxRetries + 1} intentos`);
    showError(card, () => loadPlayerStats(card, maxRetries));
  }

  /**
   * Carga las cards de una en una con un pequeño delay entre ellas.
   * Así el backend nunca recibe 5 peticiones simultáneas al mismo tiempo
   * y el rate limit de Riot se distribuye mejor.
   */
  async function loadAllSequentially(cards, delayBetween = 800) {
    for (let i = 0; i < cards.length; i++) {
      loadPlayerStats(cards[i]); // sin await — lanzamos y dejamos que corra
      if (i < cards.length - 1) await sleep(delayBetween);
    }
  }

  function resetCard(card) {
    card.querySelector('.stat-card-loading').style.display = 'flex';
    card.querySelector('.stat-card-content').style.display = 'none';
    card.querySelector('.stat-card-error').style.display   = 'none';
    // Limpiar badge de racha si existe
    const badge = card.querySelector('.stat-streak-badge');
    if (badge) badge.remove();
  }

  async function reloadAll(cards) {
    const btn = document.getElementById('stats-refresh-btn');
    if (btn) {
      btn.disabled = true;
      btn.classList.add('spinning');
    }

    cards.forEach(resetCard);
    await loadAllSequentially(cards, 800);

    if (btn) {
      btn.disabled = false;
      btn.classList.remove('spinning');
    }
  }

  function initStats() {
    const cards = Array.from(document.querySelectorAll('.stat-card'));
    if (!cards.length) return;

    // Botón de actualizar
    const btn = document.getElementById('stats-refresh-btn');
    if (btn) {
      btn.addEventListener('click', () => reloadAll(cards));
    }

    const grid = document.getElementById('stats-grid');
    if (!grid) {
      loadAllSequentially(cards);
      return;
    }

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some(e => e.isIntersecting)) {
          observer.disconnect();
          loadAllSequentially(cards, 800);
        }
      },
      { rootMargin: '300px' }
    );

    observer.observe(grid);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initStats);
  } else {
    initStats();
  }

})();
