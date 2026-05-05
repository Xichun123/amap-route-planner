#!/usr/bin/env sh
set -eu

: "${MAP_DOMAIN:?Set MAP_DOMAIN first, for example map.example.com}"
: "${AMAP_JSAPI_KEY:?Set AMAP_JSAPI_KEY first}"

cat >amap-config.js <<EOF
const AMAP_ROUTE_ORIGIN = window.location.origin;

window.__AMAP_ROUTE_CONFIG__ = {
  jsapiKey: "${AMAP_JSAPI_KEY}",
  serviceHost: "https://${MAP_DOMAIN}/_AMapService",
};
EOF
