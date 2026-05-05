# AMap Multi-Stop Route Planner

[English](README.md) | [中文](README.zh-CN.md)

Mobile-first multi-stop route planner built entirely on AMap JSAPI v2 plugins. Map rendering, POI autocomplete, and all routing (driving / walking / riding / transfer) run through the JSAPI — a JSAPI Key plus its security code is all you need. No WebService Key anywhere.

It can search POIs with live autocomplete, add multiple stops on the map, set a custom origin, mark priority stops, optimize visit order, choose a travel mode, draw the route, and open the first leg in AMap navigation.

## Features

**Core**

- AMap JSAPI v2 map rendering.
- `AMap.AutoComplete` powered live POI suggestions (type to search).
- `AMap.Driving / Walking / Riding / Transfer` plugins for route planning.
- Add, remove, reorder, and mark stops.
- Set any stop as the route origin.
- Priority stops are visited first.
- Optional strict list-order routing.
- Travel modes: auto, driving, walking, riding, transfer.
- Auto mode recommends walking, riding, or driving by rough total distance.
- `serviceHost` proxy keeps `AMAP_SECURITY_JS_CODE` out of the frontend.
- Source split into ES modules under `src/` (map, search, route, ui, utils).
- PWA manifest and service worker included.

**UI / UX (v0.2)**

- **Apple Maps inspired design system**: full SF color / type / shadow / radius scale, automatic dark mode.
- **Three-detent draggable bottom sheet**: peek (header only) / mid (half-screen, default) / full (near full-screen). Top grip cycles up, side chevron cycles down. Position persisted in localStorage.
- **Search results pinned on the map**: candidate POIs render as **red numbered markers** on the map alongside the dropdown list, view auto-fits to all results. Tap either the list row or the map marker to add — useful for picking by physical proximity (e.g. "which restaurant is closest").
- **Plan library**: save / name / load multiple stop combinations to localStorage.
- **Inline SVG icons everywhere** (zero external dependency): search, locate, plan-route, save, library, origin, priority, reorder, delete, etc.
- **iOS-style switch**, **stop row connectors** (vertical line linking sequential stops), **iOS easing** (`cubic-bezier(.32, .72, 0, 1)`).

## Required AMap Keys

Create these keys in the AMap console:

| Variable | AMap key type | Where it is used |
| --- | --- | --- |
| `AMAP_JSAPI_KEY` | Web JSAPI | Browser map loader. This key is visible to the browser by design. |
| `AMAP_SECURITY_JS_CODE` | Web JSAPI security code | Server proxy only. Do not ship it in frontend code. |

In the AMap console, add your production domain (for example `map.example.com`) to the Web JSAPI key's allowed domains.

> The WebService Key that earlier versions required has been removed in this refactor; POI search and route planning are all handled by JSAPI plugins.

## Local Preview

The checked-in `amap-config.js` contains an empty JSAPI key, so the page will not load a real map until configured.

The entry point is `route-planner.html`, which loads code via `<script type="module" src="./src/main.js">`. It must be served over HTTP — `file://` will not work.

```bash
python3 -m http.server 4173
```

Then open:

```text
http://127.0.0.1:4173/route-planner.html
```

For a full local AMap test, edit `amap-config.js` locally or export `AMAP_JSAPI_KEY` and run:

```bash
cp .env.example .env
# edit .env with your real values
set -a
. ./.env
set +a
./scripts/render-amap-config.sh
python3 -m http.server 4173
```

Do not commit `.env` or a real-key `amap-config.js`.

## Production Deployment With Caddy

Recommended production setup:

- Static files served by Caddy.
- `/_AMapService/*` proxy forwards JSAPI online requests and appends `AMAP_SECURITY_JS_CODE`.
- Frontend only receives `AMAP_JSAPI_KEY` and same-origin proxy URLs.

The examples below assume:

- domain: `map.example.com`
- site root: `/var/www/map.example.com`
- reverse proxy: Caddy

### 1. Prepare DNS

```text
map.example.com -> YOUR_SERVER_IP
```

### 2. Install Caddy

On Ubuntu/Debian:

```bash
sudo apt update
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/gpg.key" | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt" | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

### 3. Upload Files

```bash
scp -r ./* root@YOUR_SERVER_IP:/tmp/amap-route-planner/
```

On the server:

```bash
export MAP_DOMAIN=map.example.com
sudo mkdir -p /var/www/$MAP_DOMAIN
sudo cp -a /tmp/amap-route-planner/. /var/www/$MAP_DOMAIN/
```

### 4. Render Runtime Frontend Config

```bash
cd /var/www/map.example.com
sudo cp .env.example .env
sudo nano .env
```

Fill:

```env
MAP_DOMAIN=map.example.com
AMAP_JSAPI_KEY=your-web-jsapi-key
AMAP_SECURITY_JS_CODE=your-jsapi-security-code
```

Then render `amap-config.js`:

```bash
cd /var/www/map.example.com
set -a
. ./.env
set +a
./scripts/render-amap-config.sh
```

### 5. Configure Caddy

```bash
sudo mkdir -p /etc/caddy
sudo tee /etc/caddy/amap-route-planner.env >/dev/null <<'EOF'
MAP_DOMAIN=map.example.com
AMAP_SECURITY_JS_CODE=your-jsapi-security-code
EOF
```

Expose that file to Caddy:

```bash
sudo systemctl edit caddy
```

```ini
[Service]
EnvironmentFile=/etc/caddy/amap-route-planner.env
```

Copy the example Caddyfile:

```bash
sudo cp /var/www/map.example.com/deploy/Caddyfile.example /etc/caddy/Caddyfile
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### 6. Verify

```bash
curl -I https://map.example.com/route-planner.html
curl -I https://map.example.com/amap-config.js
```

`amap-config.js` should include:

```text
Cache-Control: no-store
```

Check the JSAPI proxy (Caddy appends `jscode` automatically):

```bash
curl -I "https://map.example.com/_AMapService/v3/iplocation"
```

Then open `https://map.example.com/route-planner.html`, type a keyword in the search box to see live suggestions, pick entries to add them as stops, and hit `规划路线`.

### Common Pitfall: JSONP Blocked By `nosniff`

If the browser console shows:

```text
Refused to execute script from '<URL>' because its MIME type ('application/json') is not executable, and strict MIME type checking is enabled.
```

and **search / geolocation / route planning all silently fail**, here is why:

1. The site sets `X-Content-Type-Options: nosniff` (a recommended security header).
2. AMap JSONP endpoints respond with `Content-Type: application/json`.
3. Under nosniff + strict MIME, the browser refuses to execute the response as `<script>`.

**Fix**: inside the `/_AMapService/*` block, neutralize nosniff for that path AND force-rewrite the response Content-Type:

```caddy
handle /_AMapService/* {
    uri strip_prefix /_AMapService
    uri query +jscode {$AMAP_SECURITY_JS_CODE}
    header -X-Content-Type-Options
    reverse_proxy https://restapi.amap.com {
        header_up Host restapi.amap.com
        header_down Content-Type "application/javascript; charset=utf-8"
    }
}
```

The bundled `deploy/Caddyfile.example` already includes this fix. Reload Caddy to take effect — no frontend changes needed.

## Updating A Deployed Site

Upload changed static files to the site root, then render runtime config again if `AMAP_JSAPI_KEY` or the domain changed:

```bash
cd /var/www/map.example.com
set -a
. ./.env
set +a
./scripts/render-amap-config.sh
sudo systemctl reload caddy
```

If a browser keeps old assets, hard refresh once or clear site data. The service worker cache version is inside `service-worker.js` (bump `CACHE_NAME` on any breaking change).

## Security Notes

- Never commit `.env`.
- Never commit a real `AMAP_SECURITY_JS_CODE`.
- `AMAP_JSAPI_KEY` is necessarily visible to the browser because AMap JSAPI requires it at load time.
- Restrict your AMap JSAPI key to your production domain in the AMap console.
- If a key leaks, rotate it in the AMap console and update `/etc/caddy/amap-route-planner.env`.

## Project Structure

```text
.
├── amap-config.js
├── amap-config.example.js
├── app-manifest.webmanifest
├── deploy/
│   └── Caddyfile.example
├── index.html
├── route-planner.css
├── route-planner.html
├── scripts/
│   └── render-amap-config.sh
├── service-worker.js
└── src/
    ├── config.js           # constants, runtime config reader
    ├── state.js            # shared runtime state
    ├── dom.js              # DOM element references
    ├── storage.js          # localStorage helpers (incl. sheet 3-detent position)
    ├── stops.js            # stop CRUD / origin / priority
    ├── plans.js            # saved plan store (localStorage)
    ├── main.js             # entry point, event wiring
    ├── map/
    │   ├── loader.js       # AMapLoader + Map bootstrap
    │   ├── locate.js       # geolocation flow
    │   ├── markers.js      # origin / stop markers + red search-result candidates
    │   └── search-markers.js  # compat shim, re-exports from markers.js
    ├── search/
    │   └── poi.js          # AMap.AutoComplete suggestions
    ├── route/
    │   ├── optimizer.js    # open-path TSP optimizer
    │   ├── recommender.js  # auto-mode selection
    │   ├── services.js     # Driving/Walking/Riding/Transfer wrappers
    │   ├── planner.js      # plan + draw routes
    │   └── navigation.js   # deep-link to AMap native navigation
    ├── ui/
    │   ├── status.js       # status bar
    │   ├── sheet.js        # bottom sheet 3-detent (peek/mid/full)
    │   ├── stops-view.js   # stop list + search result rendering
    │   ├── plans-view.js   # plan library dialog rendering
    │   └── icons.js        # inline SVG icon set (SF Symbols flavor)
    └── utils/
        ├── geo.js          # coords, distances
        └── format.js       # text / html helpers
```

## License

MIT
