const CACHE_NAME = "moneytrack-v14-password-reset";

const FILES_TO_CACHE = [
    "./",
    "./index.html",
    "./style.css",
    "./modules/core.js",
    "./modules/utils.js",
    "./modules/auth.js",
    "./modules/data.js",
    "./modules/transactions.js",
    "./modules/dashboard.js",
    "./modules/reports.js",
    "./modules/app.js",
    "./vendor/supabase.js",
    "./vendor/chart.umd.min.js",
    "./manifest.json",
    "./icons/icon-192.png",
    "./icons/icon-512.png"
];

self.addEventListener("install", event => {

    event.waitUntil(
        caches.open(CACHE_NAME)
            .then(cache => cache.addAll(FILES_TO_CACHE))
    );

    self.skipWaiting();
});


self.addEventListener("activate", event => {

    event.waitUntil(
        caches.keys().then(keys => {

            return Promise.all(
                keys
                    .filter(key => key !== CACHE_NAME)
                    .map(key => caches.delete(key))
            );

        })
    );

    self.clients.claim();
});


self.addEventListener("fetch", event => {

    if (event.request.method !== "GET") {
        return;
    }

    const url = new URL(event.request.url);
    const isAppFile = ["/", "/index.html", "/style.css"].includes(url.pathname) || url.pathname.startsWith("/modules/");
    const isVendorFile = url.pathname.startsWith("/vendor/");

    if (isAppFile || isVendorFile) {
        event.respondWith(
            fetch(event.request)
                .then(response => {
                    if (response.ok) {
                        const copy = response.clone();
                        caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy));
                    }
                    return response;
                })
                .catch(async () => {
                    const cached = await caches.match(event.request);
                    if (cached) {
                        return cached;
                    }
                    if (event.request.mode === "navigate") {
                        return caches.match("./index.html");
                    }
                    return Response.error();
                })
        );
        return;
    }

    event.respondWith(
        caches.match(event.request).then(cached =>
            cached || fetch(event.request)
        )
    );
});