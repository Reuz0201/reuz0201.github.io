// firebase.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyB2h26sAkkhHwUJdx6eeVxz6fY9qVG8bZM",
    authDomain: "vibedb-71371.firebaseapp.com",
    projectId: "vibedb-71371",
    storageBucket: "vibedb-71371.firebasestorage.app",
    messagingSenderId: "893073137943",
    appId: "1:893073137943:web:a228669285bfa5c6485752"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Контейнер для уведомлений (создаётся один раз)
let notificationContainer = document.getElementById('notification-container');
if (!notificationContainer) {
    notificationContainer = document.createElement('div');
    notificationContainer.id = 'notification-container';
    notificationContainer.className = 'notification-container';
    document.body.appendChild(notificationContainer);
}

// Функция показа уведомлений
export function showNotification(message, type = 'info', duration = 4000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notificationContainer.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

// Генерация заглушки аватарки (canvas с буквой)
export function getPlaceholderDataURL(userName) {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = getComputedStyle(document.body).getPropertyValue('--accent-color').trim() || '#00f2ff';
    ctx.beginPath();
    ctx.arc(20, 20, 20, 0, 2 * Math.PI);
    ctx.fill();
    ctx.fillStyle = '#fff';
    ctx.font = '20px Inter';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText((userName || '?').charAt(0).toUpperCase(), 20, 20);
    return canvas.toDataURL();
}

// --- Управление выпадающим меню (глобальное) ---

// Позиционирует меню под аватаркой
function positionDropdownMenu() {
    const avatar = document.getElementById('user-avatar-img');
    const menu = document.getElementById('dropdown-menu');
    if (!avatar || !menu) return;

    const rect = avatar.getBoundingClientRect();
    menu.style.left = rect.right - menu.offsetWidth + 'px';
    menu.style.top = rect.bottom + 5 + 'px';
}

// Показывает или скрывает меню
export function toggleDropdownMenu(show) {
    const menu = document.getElementById('dropdown-menu');
    if (!menu) return;
    if (show) {
        positionDropdownMenu();
        menu.classList.add('show');
    } else {
        menu.classList.remove('show');
    }
}


// Глобальный обработчик клика для закрытия меню при клике вне его
document.addEventListener('click', (e) => {
    const menu = document.getElementById('dropdown-menu');
    const avatarContainer = document.getElementById('user-avatar-container');
    if (!menu || !avatarContainer) return;

    if (!menu.contains(e.target) && !avatarContainer.contains(e.target)) {
        menu.classList.remove('show');
    }
});

// Красивый кастомный confirm диалог
export function showConfirm(message, confirmText = 'Удалить', cancelText = 'Отмена') {
    return new Promise((resolve) => {
        // Удаляем старый если есть
        const old = document.getElementById('custom-confirm-overlay');
        if (old) old.remove();

        const overlay = document.createElement('div');
        overlay.id = 'custom-confirm-overlay';
        overlay.style.cssText = `
            position:fixed;inset:0;z-index:99999;
            background:rgba(0,0,0,0.7);backdrop-filter:blur(6px);
            display:flex;align-items:center;justify-content:center;
            animation:fadeIn 0.15s ease;
        `;

        overlay.innerHTML = `
            <div style="
                background:var(--modal-bg,#1a1d21);
                border:1px solid rgba(255,255,255,0.1);
                border-radius:20px;padding:28px 32px;
                max-width:360px;width:90%;
                text-align:center;
                animation:slideUp 0.2s cubic-bezier(0.2,0.9,0.3,1);
            ">
                <div style="font-size:2rem;margin-bottom:12px;">🗑️</div>
                <p style="color:var(--text-main,#f5f5f7);font-size:1rem;margin:0 0 24px;line-height:1.5;">${message}</p>
                <div style="display:flex;gap:12px;justify-content:center;">
                    <button id="cc-cancel" style="
                        flex:1;padding:10px 16px;border-radius:12px;
                        background:rgba(255,255,255,0.05);
                        border:1px solid rgba(255,255,255,0.1);
                        color:var(--text-secondary,#b0b3b8);
                        cursor:pointer;font-size:0.9rem;font-family:Inter,sans-serif;
                        transition:background 0.15s;
                    ">${cancelText}</button>
                    <button id="cc-confirm" style="
                        flex:1;padding:10px 16px;border-radius:12px;
                        background:rgba(255,80,80,0.15);
                        border:1px solid rgba(255,80,80,0.4);
                        color:#ff6b6b;
                        cursor:pointer;font-size:0.9rem;font-weight:600;font-family:Inter,sans-serif;
                        transition:background 0.15s;
                    ">${confirmText}</button>
                </div>
            </div>
        `;

        document.body.appendChild(overlay);

        // Закрытие по клику вне
        overlay.addEventListener('click', (e) => {
            if (e.target === overlay) { overlay.remove(); resolve(false); }
        });

        document.getElementById('cc-cancel').addEventListener('click', () => {
            overlay.remove(); resolve(false);
        });
        document.getElementById('cc-confirm').addEventListener('click', () => {
            overlay.remove(); resolve(true);
        });
    });
}

// Анимированный переход кнопка "Войти" → аватарка
export function animateLoginTransition(loginBtn, avatarContainer, avatarImg) {
    if (!loginBtn || !avatarContainer) return;

    // Скрываем кнопку с анимацией
    loginBtn.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
    loginBtn.style.opacity = '0';
    loginBtn.style.transform = 'scale(0.8)';

    setTimeout(() => {
        loginBtn.style.display = 'none';
        loginBtn.style.opacity = '';
        loginBtn.style.transform = '';

        // Показываем аватарку с анимацией
        avatarContainer.style.display = 'inline-block';
        avatarContainer.style.opacity = '0';
        avatarContainer.style.transform = 'scale(0.6)';
        avatarContainer.style.transition = 'opacity 0.35s ease, transform 0.35s cubic-bezier(0.2,1.5,0.5,1)';

        requestAnimationFrame(() => {
            requestAnimationFrame(() => {
                avatarContainer.style.opacity = '1';
                avatarContainer.style.transform = 'scale(1)';
                avatarContainer.classList.add('loaded');
                // Небольшой звоночек — glow эффект
                if (avatarImg) {
                    avatarImg.style.boxShadow = '0 0 20px var(--accent-color)';
                    setTimeout(() => { avatarImg.style.boxShadow = ''; }, 700);
                }
            });
        });
    }, 250);
}

// Анимированный переход аватарка → кнопка "Войти" (при выходе)
export function animateLogoutTransition(loginBtn, avatarContainer) {
    if (!loginBtn || !avatarContainer) return;

    avatarContainer.style.transition = 'opacity 0.2s ease, transform 0.2s ease';
    avatarContainer.style.opacity = '0';
    avatarContainer.style.transform = 'scale(0.7)';

    setTimeout(() => {
        avatarContainer.classList.remove('loaded');
        avatarContainer.style.display = 'none';
        avatarContainer.style.opacity = '';
        avatarContainer.style.transform = '';

        loginBtn.style.display = 'block';
        loginBtn.style.opacity = '0';
        loginBtn.style.transform = 'scale(0.8)';
        loginBtn.style.transition = 'opacity 0.25s ease, transform 0.25s ease';
        requestAnimationFrame(() => requestAnimationFrame(() => {
            loginBtn.style.opacity = '1';
            loginBtn.style.transform = 'scale(1)';
        }));
    }, 200);
}

export { auth, db };