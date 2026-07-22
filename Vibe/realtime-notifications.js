// realtime-notifications.js
// Слушает новые отзывы через onSnapshot и показывает уведомление
// Подключай: import { initRealtimeNotifications } from './realtime-notifications.js';

import { db } from './firebase.js';
import {
    collection, query, orderBy, limit, onSnapshot
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

let initialized   = false;
let initialLoad   = true;
let latestDocId   = null;
let unsubscribeFn = null;

/**
 * Запускает слушатель новых отзывов.
 * @param {Object}   options
 * @param {Function} options.onNew(review) — коллбэк при новом отзыве
 * @param {boolean}  options.showToast     — показывать всплывашку (по умолчанию true)
 */
export function initRealtimeNotifications(options = {}) {
    if (initialized) return;
    initialized = true;

    const { onNew, showToast = true } = options;

    const q = query(collection(db, 'reviews'), orderBy('date', 'desc'), limit(1));

    unsubscribeFn = onSnapshot(q, snapshot => {
        if (initialLoad) {
            // Первый вызов — просто запоминаем последний ID, не показываем уведомление
            snapshot.forEach(d => { latestDocId = d.id; });
            initialLoad = false;
            return;
        }

        snapshot.docChanges().forEach(change => {
            if (change.type === 'added') {
                const doc    = change.doc;
                const review = { id: doc.id, ...doc.data() };

                // Не уведомлять о том же документе
                if (doc.id === latestDocId) return;
                latestDocId = doc.id;

                if (showToast) showReviewToast(review);
                if (onNew)     onNew(review);
            }
        });
    });
}

export function stopRealtimeNotifications() {
    if (unsubscribeFn) {
        unsubscribeFn();
        unsubscribeFn = null;
        initialized   = false;
        initialLoad   = true;
    }
}

// ── Всплывашка о новом отзыве ──
function showReviewToast(review) {
    // Используем стандартный контейнер уведомлений
    let container = document.getElementById('notification-container');
    if (!container) {
        container = document.createElement('div');
        container.id = 'notification-container';
        container.className = 'notification-container';
        document.body.appendChild(container);
    }

    const stars = '★'.repeat(review.rating || 5) + '☆'.repeat(5 - (review.rating || 5));
    const name  = review.userName || 'Пользователь';
    const short = (review.text || '').slice(0, 60) + ((review.text?.length > 60) ? '…' : '');

    const toast = document.createElement('div');
    toast.className = 'notification info';
    toast.style.cssText = `
        display: flex; flex-direction: column; gap: 4px;
        cursor: pointer; max-width: 320px;
    `;
    toast.innerHTML = `
        <div style="display:flex;align-items:center;gap:8px;">
            <span style="font-size:1rem;">✨</span>
            <strong style="font-size:0.88rem;color:var(--accent-color);">Новый отзыв — ${name}</strong>
        </div>
        <div style="font-size:0.75rem;color:#fbbf24;letter-spacing:1px;">${stars}</div>
        <div style="font-size:0.82rem;color:var(--text-secondary);">${short}</div>
    `;

    // Клик по тосту — перейти на страницу отзывов
    toast.addEventListener('click', () => {
        window.location.href = 'reviews.html';
    });

    container.appendChild(toast);
    setTimeout(() => {
        toast.classList.add('fade-out');
        setTimeout(() => toast.remove(), 300);
    }, 6000);
}
