"use strict";

const CACHE_NAME = "amap-route-planner-v23";
const APP_SHELL = [
  "./index.html",
  "./route-planner.html",
  "./route-planner.css",
  "./src/main.js",
  "./src/config.js",
  "./src/state.js",
  "./src/dom.js",
  "./src/storage.js",
  "./src/stops.js",
  "./src/plans.js",
  "./src/utils/geo.js",
  "./src/utils/format.js",
  "./src/ui/status.js",
  "./src/ui/sheet.js",
  "./src/ui/stops-view.js",
  "./src/ui/plans-view.js",
  "./src/ui/icons.js",
  "./src/map/loader.js",
  "./src/map/locate.js",
  "./src/map/markers.js",
  "./src/map/search-markers.js",
  "./src/search/poi.js",
  "./src/route/optimizer.js",
  "./src/route/recommender.js",
  "./src/route/services.js",
  "./src/route/planner.js",
  "./src/route/navigation.js",
  "./app-manifest.webmanifest",
  "./icons/icon-32.png",
  "./icons/icon-120.png",
  "./icons/icon-152.png",
  "./icons/icon-167.png",
  "./icons/icon-180.png",
  "./icons/icon-192.png",
  "./icons/icon-512.png",
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))),
    ),
  );
  self.clients.claim();
});

self.addEventListener("fetch", (event) => {
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) return;
  if (
    requestUrl.pathname === "/amap-config.js" ||
    requestUrl.pathname.startsWith("/_AMapService/")
  ) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const copy = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return response;
      })
      .catch(() => caches.match(event.request)),
  );
});
