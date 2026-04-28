# AMap Multi-Stop Route Planner

[English](README.md) | [中文](README.zh-CN.md)

Mobile-first multi-stop route planner built with AMap JSAPI and AMap WebService.

It can search POIs, add multiple stops on the map, set a custom origin, mark priority stops, optimize visit order, choose travel mode, draw the route, and open the first leg in AMap navigation.

## Features

- AMap JSAPI v2 map rendering.
- POI keyword search through a server-side WebService proxy.
- Add, remove, reorder, and mark stops.
- Set any stop as the route origin.
- Priority stops are visited first.
- Optional strict list-order routing.
- Travel modes: auto, driving, walking, riding, transfer.
- Auto mode recommends walking, riding, or driving by rough total distance.
- Server-side proxy keeps `AMAP_SECURITY_JS_CODE` and `AMAP_WEBSERVICE_KEY` out of frontend files.
- PWA manifest and service worker included.

## Required AMap Keys

Create these keys in the AMap console:

| Variable | AMap key type | Where it is used |
| --- | --- | --- |
| `AMAP_JSAPI_KEY` | Web JSAPI | Browser map loader. This key is visible to the browser by design. |
| `AMAP_SECURITY_JS_CODE` | Web JSAPI security code | Server proxy only. Do not ship it in frontend code. |
| `AMAP_WEBSERVICE_KEY` | WebService API | Server proxy only. Do not ship it in frontend code. |

In the AMap console, add your production domain, for example `map.example.com`, to the Web JSAPI key's allowed domains.

## Local Preview

The checked-in `amap-config.js` contains an empty JSAPI key, so it will not load a real map until configured.

For a quick layout-only preview:

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
- `/_AMapService/*` proxy appends `AMAP_SECURITY_JS_CODE`.
- `/_AMapWebService/*` proxy appends `AMAP_WEBSERVICE_KEY`.
- Frontend only receives `AMAP_JSAPI_KEY` and same-origin proxy URLs.

The examples below assume:

- domain: `map.example.com`
- site root: `/var/www/map.example.com`
- reverse proxy: Caddy

### 1. Prepare DNS

Create an `A` record:

```text
map.example.com -> YOUR_SERVER_IP
```

Keep it DNS-only if your provider has proxy modes and you want to avoid TLS or edge proxy issues while debugging.

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

From your workstation:

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

On the server:

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
AMAP_WEBSERVICE_KEY=your-webservice-key
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

Create a Caddy environment file:

```bash
sudo mkdir -p /etc/caddy
sudo tee /etc/caddy/amap-route-planner.env >/dev/null <<'EOF'
MAP_DOMAIN=map.example.com
AMAP_SECURITY_JS_CODE=your-jsapi-security-code
AMAP_WEBSERVICE_KEY=your-webservice-key
EOF
```

Expose that file to the Caddy service:

```bash
sudo systemctl edit caddy
```

Add:

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

Check the site:

```bash
curl -I https://map.example.com/route-planner.html
curl -I https://map.example.com/amap-config.js
```

`amap-config.js` should include:

```text
Cache-Control: no-store
```

Check the POI proxy. The URL does not include a key; Caddy appends it:

```bash
curl "https://map.example.com/_AMapWebService/v3/place/text?keywords=故宫&city=北京&citylimit=true&offset=3&page=1&extensions=all&output=JSON"
```

Expected result:

```json
{"status":"1","info":"OK"}
```

Then open:

```text
https://map.example.com/route-planner.html
```

Search a place, add multiple stops, and click `规划路线`.

## Updating A Deployed Site

Upload changed static files to the site root, then render runtime config again if `AMAP_JSAPI_KEY` or domain changed:

```bash
cd /var/www/map.example.com
set -a
. ./.env
set +a
./scripts/render-amap-config.sh
sudo systemctl reload caddy
```

If a browser keeps old assets, hard refresh once or clear site data. The service worker cache version is inside `service-worker.js`.

## Security Notes

- Never commit `.env`.
- Never commit a real `AMAP_SECURITY_JS_CODE`.
- Never commit a real `AMAP_WEBSERVICE_KEY`.
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
├── route-planner.js
├── scripts/
│   └── render-amap-config.sh
└── service-worker.js
```

## License

MIT
