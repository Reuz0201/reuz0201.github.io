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
            // Не блокируем установку если какой-то файл не загрузился
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

// ── Fetch: Network First для Firebase/API, Cache First для статики ──
self.addEventListener('fetch', event => {
    const url = new URL(event.request.url);

    // Firebase, Google Fonts, CDN — всегда сеть
    if (
        url.hostname.includes('firebaseapp.com') ||
        url.hostname.includes('googleapis.com') ||
        url.hostname.includes('gstatic.com') ||
        url.hostname.includes('firestore.googleapis.com') ||
        url.hostname.includes('identitytoolkit') ||
        url.hostname.includes('imgbb.com') ||
        event.request.method !== 'GET'
    ) {
        return; // браузер обрабатывает сам
    }

    // Стратегия: сначала сеть, при ошибке — кэш
    event.respondWith(
        fetch(event.request)
            .then(response => {
                // Кэшируем успешные ответы (только same-origin)
                if (response.ok && url.origin === self.location.origin) {
                    const clone = response.clone();
                    caches.open(CACHE).then(cache => cache.put(event.request, clone));
                }
                return response;
            })
            .catch(() => {
                // Сеть недоступна — берём из кэша
                return caches.match(event.request).then(cached => {
                    if (cached) return cached;
                    // Для HTML-страниц — офлайн-заглушка из главной
                    if (event.request.headers.get('accept')?.includes('text/html')) {
                        return caches.match('/index.html');
                    }
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
