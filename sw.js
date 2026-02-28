// sw.js — Service Worker для Вайб PWA
const CACHE = 'vibe-v1';

// Файлы для офлайн-кэша
const PRECACHE = [
    '/',
    '/index.html',
    '/reviews.html',
    '/download.html',
    '/pricing.html',
    '/profile.html',
    '/style.css',
    '/style-additions.css',
    '/script.js',
    '/script-reviews.js',
    '/script-download.js',
    '/script-pricing.js',
    '/profile.js',
    '/firebase.js',
    '/background.js',
    '/parallax.js',
    '/page-transitions.js',
    '/manifest.json',
    '/icons/icon-192.png',
    '/icons/icon-512.png',
];

// ── Установка: кэшируем основные файлы ──
self.addEventListener('install', event => {
    event.waitUntil(
        caches.open(CACHE).then(cache => {
            return Promise.allSettled(
                PRECACHE.map(url => cache.add(url).catch(() => {}))
            );
        }).then(() => self.skipWaiting())
    );
});

// ── Активация: удаляем старые кэши ──
self.addEventListener('activate', event => {
    event.waitUntil(
        caches.keys().then(keys =>
            Promise.all(
                keys.filter(k => k !== CACHE).map(k => caches.delete(k))
            )
        ).then(() => self.clients.claim())
    );
});

// Домены, которые SW не трогает — браузер обрабатывает сам
const BYPASS_HOSTNAMES = [
    'firebaseapp.com',
    'googleapis.com',
    'gstatic.com',
    'firestore.googleapis.com',
    'identitytoolkit.googleapis.com',
    'imgbb.com',
    'i.ibb.co',       // ← CDN-домен imgbb (был пропущен — причина ошибки)
    'ibb.co',
    'fonts.googleapis.com',
    'fonts.gstatic.com',
];

function shouldBypass(url) {
    return BYPASS_HOSTNAMES.some(h => url.hostname.includes(h));
}

// ── Fetch: Network First для внешних запросов, Cache First для статики ──
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Пропускаем не-GET и внешние сервисы
    if (event.request.method !== 'GET' || shouldBypass(url)) {
        return;
    }

    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Кэшируем успешные ответы только для same-origin
                if (response.ok && url.origin === self.location.origin) {
                    const clone = response.clone();
                    caches.open(CACHE).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => {
                // Сеть недоступна — ищем в кэше
                return caches.match(event.request).then(cached => {
                    if (cached) return cached;

                    // Для HTML — отдаём главную как офлайн-заглушку
                    if (event.request.headers.get('accept')?.includes('text/html')) {
                        return caches.match('/index.html');
                    }

                    // ← Раньше здесь возвращался undefined → TypeError
                    // Теперь явно возвращаем 503, чтобы браузер получил корректный Response
                    return new Response('Офлайн: ресурс недоступен', {
                        status: 503,
                        statusText: 'Service Unavailable',
                        headers: { 'Content-Type': 'text/plain; charset=utf-8' }
                    });
                });
            })
    );
});

// ── Push-уведомления (задел на будущее) ──
self.addEventListener('push', event => {
    if (!event.data) return;
    const data = event.data.json();
    self.registration.showNotification(data.title || 'Вайб', {
        body: data.body || '',
        icon: '/icons/icon-192.png',
        badge: '/icons/icon-192.png',
        data: { url: data.url || '/' }
    });
});

self.addEventListener('notificationclick', event => {
    event.notification.close();
    event.waitUntil(
        clients.openWindow(event.notification.data?.url || '/')
    );
});