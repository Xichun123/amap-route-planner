# 高德多点路线规划

[English](README.md) | [中文](README.zh-CN.md)

基于高德 JSAPI 和高德 WebService 的移动端优先多点路线规划工具。

它支持搜索地点、添加多个到访点、设置自定义出发点、标记优先到达点、优化到访顺序、选择交通方式、绘制路线，并可打开第一段高德导航。

## 功能

- 高德 JSAPI v2 地图渲染。
- 通过服务器端 WebService 代理进行 POI 关键词搜索。
- 添加、删除、排序、标记到访地点。
- 可将任意地点设为出发点。
- 优先地点会先规划到达。
- 可选择严格按列表顺序规划。
- 交通方式：自动、驾车、步行、骑行、公交。
- 自动模式会按粗略总距离推荐步行、骑行或驾车。
- 服务器代理会隐藏 `AMAP_SECURITY_JS_CODE` 和 `AMAP_WEBSERVICE_KEY`，前端文件不包含这些敏感值。
- 包含 PWA manifest 和 service worker。

## 需要的高德 Key

请在高德开放平台控制台创建这些 Key。

| 变量 | 高德 Key 类型 | 用途 |
| --- | --- | --- |
| `AMAP_JSAPI_KEY` | Web JSAPI | 浏览器加载地图使用。这个 key 按高德 JSAPI 机制必须暴露给浏览器。 |
| `AMAP_SECURITY_JS_CODE` | Web JSAPI 安全密钥 | 仅服务器代理使用，不要放进前端代码。 |
| `AMAP_WEBSERVICE_KEY` | WebService API | 仅服务器代理使用，不要放进前端代码。 |

在高德控制台中，把生产域名，例如 `map.example.com`，加入 Web JSAPI Key 的允许域名。

## 本地预览

仓库中的 `amap-config.js` 默认不包含真实 JSAPI Key，因此配置前不会加载真实地图。

如果只想快速预览界面布局：

```bash
python3 -m http.server 4173
```

然后打开：

```text
http://127.0.0.1:4173/route-planner.html
```

如果要在本地完整测试高德地图，可以临时编辑 `amap-config.js`，或者导出 `AMAP_JSAPI_KEY` 后运行：

```bash
cp .env.example .env
# 编辑 .env，填入你的真实配置
set -a
. ./.env
set +a
./scripts/render-amap-config.sh
python3 -m http.server 4173
```

不要提交 `.env`，也不要提交包含真实 key 的 `amap-config.js`。

## 使用 Caddy 生产部署

推荐的生产部署结构：

- Caddy 托管静态文件。
- `/_AMapService/*` 代理自动追加 `AMAP_SECURITY_JS_CODE`。
- `/_AMapWebService/*` 代理自动追加 `AMAP_WEBSERVICE_KEY`。
- 前端只拿到 `AMAP_JSAPI_KEY` 和同源代理地址。

下面示例假设：

- 域名：`map.example.com`
- 网站目录：`/var/www/map.example.com`
- 反向代理：Caddy

### 1. 准备 DNS

创建一条 `A` 记录：

```text
map.example.com -> YOUR_SERVER_IP
```

如果你的 DNS 服务商有代理模式，调试阶段建议先保持 DNS-only，避免 TLS 或边缘代理问题干扰排查。

### 2. 安装 Caddy

在 Ubuntu/Debian 上：

```bash
sudo apt update
sudo apt install -y debian-keyring debian-archive-keyring apt-transport-https curl
curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/gpg.key" | sudo gpg --dearmor -o /usr/share/keyrings/caddy-stable-archive-keyring.gpg
curl -1sLf "https://dl.cloudsmith.io/public/caddy/stable/debian.deb.txt" | sudo tee /etc/apt/sources.list.d/caddy-stable.list
sudo apt update
sudo apt install -y caddy
```

### 3. 上传文件

在你的本机执行：

```bash
scp -r ./* root@YOUR_SERVER_IP:/tmp/amap-route-planner/
```

在服务器上执行：

```bash
export MAP_DOMAIN=map.example.com
sudo mkdir -p /var/www/$MAP_DOMAIN
sudo cp -a /tmp/amap-route-planner/. /var/www/$MAP_DOMAIN/
```

### 4. 生成前端运行时配置

在服务器上：

```bash
cd /var/www/map.example.com
sudo cp .env.example .env
sudo nano .env
```

填写：

```env
MAP_DOMAIN=map.example.com
AMAP_JSAPI_KEY=your-web-jsapi-key
AMAP_SECURITY_JS_CODE=your-jsapi-security-code
AMAP_WEBSERVICE_KEY=your-webservice-key
```

然后生成 `amap-config.js`：

```bash
cd /var/www/map.example.com
set -a
. ./.env
set +a
./scripts/render-amap-config.sh
```

### 5. 配置 Caddy

创建 Caddy 环境变量文件：

```bash
sudo mkdir -p /etc/caddy
sudo tee /etc/caddy/amap-route-planner.env >/dev/null <<'EOF'
MAP_DOMAIN=map.example.com
AMAP_SECURITY_JS_CODE=your-jsapi-security-code
AMAP_WEBSERVICE_KEY=your-webservice-key
EOF
```

让 Caddy 服务读取这个文件：

```bash
sudo systemctl edit caddy
```

添加：

```ini
[Service]
EnvironmentFile=/etc/caddy/amap-route-planner.env
```

复制示例 Caddyfile：

```bash
sudo cp /var/www/map.example.com/deploy/Caddyfile.example /etc/caddy/Caddyfile
sudo caddy fmt --overwrite /etc/caddy/Caddyfile
sudo caddy validate --config /etc/caddy/Caddyfile
sudo systemctl reload caddy
```

### 6. 验证

检查页面：

```bash
curl -I https://map.example.com/route-planner.html
curl -I https://map.example.com/amap-config.js
```

`amap-config.js` 应该包含：

```text
Cache-Control: no-store
```

检查 POI 代理。这个 URL 不带 key，Caddy 会自动追加：

```bash
curl "https://map.example.com/_AMapWebService/v3/place/text?keywords=故宫&city=北京&citylimit=true&offset=3&page=1&extensions=all&output=JSON"
```

预期结果：

```json
{"status":"1","info":"OK"}
```

然后打开：

```text
https://map.example.com/route-planner.html
```

搜索地点、添加多个到访点，然后点击 `规划路线`。

## 更新已部署站点

把修改后的静态文件上传到站点目录。如果 `AMAP_JSAPI_KEY` 或域名发生变化，需要重新生成运行时配置：

```bash
cd /var/www/map.example.com
set -a
. ./.env
set +a
./scripts/render-amap-config.sh
sudo systemctl reload caddy
```

如果浏览器仍保留旧文件，强制刷新一次或清理站点数据。service worker 的缓存版本在 `service-worker.js` 中。

## 安全说明

- 不要提交 `.env`。
- 不要提交真实的 `AMAP_SECURITY_JS_CODE`。
- 不要提交真实的 `AMAP_WEBSERVICE_KEY`。
- `AMAP_JSAPI_KEY` 必须暴露给浏览器，这是高德 JSAPI 加载机制决定的。
- 请在高德控制台把 JSAPI Key 限制到生产域名。
- 如果 key 泄露，请在高德控制台重置，并更新 `/etc/caddy/amap-route-planner.env`。

## 项目结构

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

## 许可证

MIT
