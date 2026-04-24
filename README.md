# ⚫ BLACK PHANTOM ESPORTS — Página Oficial

> Sitio web oficial del equipo de esports **Black Phantom**, competidores de *League of Legends*. Muestra el roster, estadísticas en tiempo real integradas con la **Riot Games API**, tienda de equipación, stream de Twitch y noticias de Twitter/X.

---

## 🚀 Demo

**[black-team.vercel.app](https://black-team.vercel.app)**

---

## ✨ Características

- **Estadísticas en vivo** — Datos actualizados de cada jugador desde la Riot Games API: rango, winrate, KDA, últimas partidas, campeón más jugado.
- **Botón de actualización** — Recarga las stats de todos los jugadores bajo demanda con un solo clic.
- **3 rosters** — Plantilla principal, segundo equipo y suplentes con roles y nicks.
- **Sección de coaches** — Cuerpo técnico del equipo.
- **Tienda** — Equipación oficial de la temporada 2026.
- **Stream integrado** — Player y chat de Twitch embebidos.
- **Feed de Twitter/X** — Últimas noticias del equipo via Nitter.
- **Cursor personalizado** — Cursor animado con trail.
- **Animaciones scroll** — Reveal progresivo de secciones con IntersectionObserver.
- **Diseño responsivo** — Adaptado a móvil, tablet y escritorio.
- **PWA ready** — Web manifest incluido.

---

## 🛠️ Tecnologías

| Capa | Tecnología |
|---|---|
| Frontend | HTML5, CSS3 (custom properties, CSS Grid), Vanilla JS |
| Backend | Vercel Serverless Functions (Node.js 20+) |
| API | Riot Games API v4/v5 |
| Tipografía | Bebas Neue · Rajdhani · Orbitron (Google Fonts) |
| Assets champions/ranks | Data Dragon · CommunityDragon |
| Deploy | Vercel |

---

## 📁 Estructura

```
PaginaBlack/
├── index.html              # Página principal
├── css/
│   └── style.css           # Estilos completos
├── js/
│   └── main.js             # Lógica frontend + stats loader
├── api/
│   └── lol-stats.js        # Serverless function (proxy Riot API)
├── img/
│   ├── logo*.png           # Logos del equipo
│   ├── camisetas/          # Imágenes de la tienda
│   ├── favicon/            # Favicon
│   ├── logotwitch.webp
│   └── logotwitter.avif
├── html/
│   └── index.html          # Subpágina adicional
├── site.webmanifest        # PWA manifest
├── package.json
└── .env                    # Variables de entorno (no subir)
```

---

## ⚙️ Instalación y desarrollo local

### 1. Clona el repositorio

```bash
git clone https://github.com/tu-usuario/PaginaBlack.git
cd PaginaBlack
```

### 2. Instala la CLI de Vercel

```bash
npm install -g vercel
```

### 3. Configura la API Key de Riot

Crea un archivo `.env` en la raíz (ya está en `.gitignore`, nunca lo subas):

```env
RIOT_API_KEY=RGAPI-xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
```

Obtén tu clave en [developer.riotgames.com](https://developer.riotgames.com). Las claves de desarrollo caducan cada 24 h; para producción solicita una **Production Key**.

### 4. Lanza el servidor local

```bash
vercel dev
```

La función serverless `/api/lol-stats` se ejecuta automáticamente en local con las variables del `.env`.

---

## 🌐 Deploy en Vercel

### Opción A — CLI

```bash
vercel --prod
```

### Opción B — GitHub Actions (auto-deploy)

1. Conecta el repositorio en [vercel.com/new](https://vercel.com/new).
2. En **Settings → Environment Variables** añade `RIOT_API_KEY`.
3. Cada push a `main` desplegará automáticamente.

---

## 🔑 Variables de entorno

| Variable | Descripción | Requerida |
|---|---|---|
| `RIOT_API_KEY` | API Key de Riot Games | ✅ Sí |

---

## 📡 API — `/api/lol-stats`

Proxy seguro entre el frontend y Riot. La API Key **nunca** se expone al cliente.

**Request:**
```
GET /api/lol-stats?gameName=nyx&tagLine=ak4&region=euw1
```

**Parámetros:**

| Param | Descripción | Ejemplo |
|---|---|---|
| `gameName` | Nombre de invocador (Riot ID) | `nyx` |
| `tagLine` | Tag de la cuenta | `ak4` |
| `region` | Región de la cuenta | `euw1` |

**Response (200):**
```json
{
  "summoner": {
    "name": "nyx#ak4",
    "level": 248,
    "profileIconUrl": "https://ddragon.leagueoflegends.com/..."
  },
  "ranked": {
    "tier": "GOLD",
    "rank": "II",
    "lp": 47,
    "wins": 82,
    "losses": 71,
    "winRate": 54,
    "hotStreak": false,
    "rankEmblemUrl": "https://raw.communitydragon.org/..."
  },
  "last10": {
    "wins": 6,
    "losses": 4,
    "winRate": 60,
    "avgKills": "5.2",
    "avgDeaths": "3.1",
    "avgAssists": "8.4",
    "kda": "4.39",
    "avgCS": 187,
    "mostPlayed": "Lux",
    "recentMatches": [...]
  },
  "patch": "14.10.1"
}
```

**Caché:** 10 minutos en Vercel Edge (`s-maxage=600, stale-while-revalidate=1200`).

---

## 🔄 Fiabilidad de la API

La función serverless implementa varias capas de protección contra los rate limits de Riot:

- **Reintentos automáticos** con backoff exponencial en errores 429 y 5xx (hasta 4 intentos).
- **Respeto del header `Retry-After`** cuando Riot devuelve 429.
- **Fetch secuencial de partidas** — las 10 partidas se obtienen una a una con 150 ms de pausa, evitando picos de peticiones paralelas.
- **Summoner + Ranked en paralelo** — estas dos llamadas sí son independientes y se lanzan juntas.
- **Fallback a Unranked** si el endpoint de ranked falla.
- **Caché larga** — 10 minutos en el Edge de Vercel reduce drásticamente las llamadas repetidas.
- **Reintentos en el cliente** — el frontend reintenta hasta 2 veces con espera exponencial antes de mostrar el error.
- **Carga escalonada** — las 5 cards se cargan con 800 ms de separación para no saturar el serverless.

---

## 🗺️ Roadmap

- [ ] Panel de administración para actualizar el roster sin tocar el código
- [ ] Histórico de partidas con más detalle (visión, daño, estructura)
- [ ] Página de estadísticas individuales por jugador
- [ ] Integración con Liquipedia para resultados de torneos
- [ ] Notificaciones push cuando el stream está en directo

---

## 📜 Licencia

Este proyecto es de uso privado para **Black Phantom Esports**. No está permitida su redistribución ni uso comercial sin autorización expresa del equipo.

---

*Black Phantom Esports · 2026 · "No importa ganar o perder… lo importante es tener excusa."*