# 高德多点路线规划

[English](README.md) | [中文](README.zh-CN.md)

基于高德 JSAPI v2 插件的移动端优先多点路线规划工具。所有在线能力（地图、搜索、路线）均通过 JSAPI 完成，只需一把 JSAPI Key + 安全密钥，无需 WebService Key。

它支持搜索地点、添加多个到访点、设置自定义出发点、标记优先到达点、优化到访顺序、选择交通方式、绘制路线，并可打开第一段高德导航。

## 功能

- 高德 JSAPI v2 地图渲染。
- `AMap.AutoComplete` 实现搜索框即时联想（输入即搜）。
- `AMap.Driving / Walking / Riding / Transfer` 插件完成路径规划。
- 添加、删除、排序、标记到访地点。
- 可将任意地点设为出发点。
- 优先地点会先规划到达。
- 可选择严格按列表顺序规划。
- 交通方式：自动、驾车、步行、骑行、公交。
- 自动模式会按粗略总距离推荐步行、骑行或驾车。
- 服务器端代理 `serviceHost` 转发高德 JSAPI 的鉴权请求，`AMAP_SECURITY_JS_CODE` 不出现在前端。
- 代码拆分为 `src/` 下的 ES 模块（地图、搜索、路线、UI 等分层）。
- 包含 PWA manifest 和 service worker。

## 需要的高德 Key

请在高德开放平台控制台创建这些 Key：

| 变量 | 高德 Key 类型 | 用途 |
| --- | --- | --- |
| `AMAP_JSAPI_KEY` | Web JSAPI | 浏览器加载地图使用。这个 key 按高德 JSAPI 机制必须暴露给浏览器。 |
| `AMAP_SECURITY_JS_CODE` | Web JSAPI 安全密钥 | 仅服务器代理使用，不要放进前端代码。 |

在高德控制台中，把生产域名（如 `map.example.com`）加入 Web JSAPI Key 的允许域名。

> 之前版本使用的 WebService Key 已经在本次重构中移除，POI 搜索与路径规划全部由 JSAPI 插件承担。

## 本地预览

仓库中的 `amap-config.js` 默认不包含真实 JSAPI Key，因此配置前不会加载真实地图。

页面入口是 `route-planner.html`，它通过 `<script type="module" src="./src/main.js">` 加载源码，因此必须经 HTTP 服务访问（不能直接 `file://` 打开）。

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

> 本地调试如果没有配置 `serviceHost`，JSAPI 会走 `restapi.amap.com` 直连。这种情况下请把 `amap-config.js` 中的 `serviceHost` 去掉或改为空串，并在页面脚本运行环境里提供 `securityJsCode`（仅调试用，不要提交到仓库）。

不要提交 `.env`，也不要提交包含真实 key 的 `amap-config.js`。

## 使用 Caddy 生产部署

推荐的生产部署结构：

- Caddy 托管静态文件。
- `/_AMapService/*` 代理转发 JSAPI 的在线请求，并自动追加 `AMAP_SECURITY_JS_CODE`。
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

```bash
scp -r ./* root@YOUR_SERVER_IP:/tmp/amap-route-planner/
```

在服务器上：

```bash
export MAP_DOMAIN=map.example.com
sudo mkdir -p /var/www/$MAP_DOMAIN
sudo cp -a /tmp/amap-route-planner/. /var/www/$MAP_DOMAIN/
```

### 4. 生成前端运行时配置

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
```

生成 `amap-config.js`：

```bash
cd /var/www/map.example.com
set -a
. ./.env
set +a
./scripts/render-amap-config.sh
```

### 5. 配置 Caddy

```bash
sudo mkdir -p /etc/caddy
sudo tee /etc/caddy/amap-route-planner.env >/dev/null <<'EOF'
MAP_DOMAIN=map.example.com
AMAP_SECURITY_JS_CODE=your-jsapi-security-code
EOF
```

让 Caddy 读取环境变量：

```bash
sudo systemctl edit caddy
```

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

```bash
curl -I https://map.example.com/route-planner.html
curl -I https://map.example.com/amap-config.js
```

`amap-config.js` 的响应头应包含 `Cache-Control: no-store`。

检查 JSAPI 安全代理（URL 不带 `jscode`，Caddy 会追加）：

```bash
curl -I "https://map.example.com/_AMapService/v3/iplocation"
```

然后打开 `https://map.example.com/route-planner.html`，在搜索框输入关键词会即时联想，点击条目加入到访点，再点 `规划路线`。

## 更新已部署站点

上传静态文件后，如果 `AMAP_JSAPI_KEY` 或域名发生变化，需要重新生成运行时配置：

```bash
cd /var/www/map.example.com
set -a
. ./.env
set +a
./scripts/render-amap-config.sh
sudo systemctl reload caddy
```

如果浏览器仍保留旧文件，强制刷新一次或清理站点数据。service worker 的缓存版本在 `service-worker.js` 的 `CACHE_NAME` 中，每次破坏性变更都应升版本号。

## 安全说明

- 不要提交 `.env`。
- 不要提交真实的 `AMAP_SECURITY_JS_CODE`。
- `AMAP_JSAPI_KEY` 必须暴露给浏览器（高德 JSAPI 机制决定）。
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
├── scripts/
│   └── render-amap-config.sh
├── service-worker.js
└── src/
    ├── config.js           # 常量、读取运行时配置
    ├── state.js            # 全局运行时状态
    ├── dom.js              # DOM 节点引用
    ├── storage.js          # localStorage 读写
    ├── stops.js            # 到访点的增删改查
    ├── main.js             # 启动入口，事件绑定
    ├── map/
    │   ├── loader.js       # AMap 加载 + Map 实例创建
    │   ├── locate.js       # 定位逻辑
    │   └── markers.js      # 起点/到访点 marker
    ├── search/
    │   └── poi.js          # AMap.AutoComplete 联想搜索
    ├── route/
    │   ├── optimizer.js    # 开路径 TSP 优化
    │   ├── recommender.js  # 自动推荐交通方式
    │   ├── services.js     # 封装 Driving/Walking/Riding/Transfer
    │   ├── planner.js      # 规划主流程与绘制
    │   └── navigation.js   # 跳转高德原生导航
    ├── ui/
    │   ├── status.js       # 顶部状态条
    │   ├── sheet.js        # 底部面板折叠
    │   └── stops-view.js   # 到访点、搜索结果渲染
    └── utils/
        ├── geo.js          # 坐标、距离
        └── format.js       # 文本、html 工具
```

## 许可证

MIT
