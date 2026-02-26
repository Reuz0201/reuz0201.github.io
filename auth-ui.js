// auth-ui.js — единый модуль авторизации и UI для всех страниц
// Подключай так: import { initAuth } from './auth-ui.js';

import { auth, db, showNotification, getPlaceholderDataURL, toggleDropdownMenu, animateLoginTransition, animateLogoutTransition } from './firebase.js';
import {
    signOut,
    onAuthStateChanged,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendEmailVerification,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
    doc, getDoc, setDoc, serverTimestamp,
    collection, addDoc, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// ── Состояние ──
export let currentUser     = null;
export let currentUserName = '';
export let currentUserRole = 'user';

// Коллбэки для страниц, которые хотят реагировать на смену auth-состояния
const onLoginCallbacks  = [];
const onLogoutCallbacks = [];

export function onUserLogin(fn)  { onLoginCallbacks.push(fn); }
export function onUserLogout(fn) { onLogoutCallbacks.push(fn); }

// ── Модалки ──
export function openModal(modal) {
    closeAllModals();
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.style.display = 'flex';
    if (modal) modal.classList.add('show');
}

export function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
    const overlay = document.getElementById('modal-overlay');
    if (overlay) overlay.style.display = 'none';
}

// ── Настройки (тема + частицы) ──
export function loadSettings() {
    const theme = localStorage.getItem('vibe-theme') || 'dark';
    document.body.classList.toggle('theme-light', theme === 'light');
    const btnDark  = document.getElementById('theme-dark');
    const btnLight = document.getElementById('theme-light');
    if (btnDark)  btnDark.classList.toggle('active',  theme !== 'light');
    if (btnLight) btnLight.classList.toggle('active', theme === 'light');

    const ps = localStorage.getItem('vibe-particle-setting');
    if (ps) {
        try {
            const sel = document.getElementById('particle-count');
            if (sel) sel.value = JSON.parse(ps).count;
        } catch {}
    }
}

function bindSettings() {
    document.getElementById('theme-dark')?.addEventListener('click', () => {
        document.body.classList.remove('theme-light');
        localStorage.setItem('vibe-theme', 'dark');
        document.getElementById('theme-dark')?.classList.add('active');
        document.getElementById('theme-light')?.classList.remove('active');
    });
    document.getElementById('theme-light')?.addEventListener('click', () => {
        document.body.classList.add('theme-light');
        localStorage.setItem('vibe-theme', 'light');
        document.getElementById('theme-light')?.classList.add('active');
        document.getElementById('theme-dark')?.classList.remove('active');
    });
    document.getElementById('particle-count')?.addEventListener('change', e => {
        const count = parseInt(e.target.value);
        const val = JSON.stringify({ count });
        localStorage.setItem('vibe-particle-setting', val);
        window.dispatchEvent(new StorageEvent('storage', { key: 'vibe-particle-setting', newValue: val }));
    });
    document.getElementById('close-settings')?.addEventListener('click', closeAllModals);
    document.getElementById('settings-menu-item')?.addEventListener('click', e => {
        e.preventDefault();
        toggleDropdownMenu(false);
        openModal(document.getElementById('settings-modal'));
    });
}

// ── Отзыв (feedback bubble) ──
function bindFeedbackBubble() {
    document.getElementById('feedback-bubble')?.addEventListener('click', () => {
        if (!currentUser) openModal(document.getElementById('login-modal'));
        else             openModal(document.getElementById('write-review-modal'));
    });

    document.getElementById('write-review-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        if (!currentUser) { openModal(document.getElementById('login-modal')); return; }
        const ratingInput = document.querySelector('input[name="rating"]:checked');
        if (!ratingInput) { showNotification('Поставьте оценку', 'error'); return; }
        const text = document.getElementById('review-text')?.value.trim();
        if (!text) { showNotification('Напишите текст', 'error'); return; }

        const btn = e.target.querySelector('button[type="submit"]');
        btn.classList.add('loading'); btn.disabled = true;
        try {
            const existing = await getDocs(query(collection(db, 'reviews'), where('userId', '==', currentUser.uid)));
            if (!existing.empty) {
                showNotification('Вы уже оставили отзыв. Его можно отредактировать на странице отзывов.', 'error', 6000);
                return;
            }
            const userDoc   = await getDoc(doc(db, 'users', currentUser.uid));
            const avatarUrl = userDoc.exists() ? userDoc.data().avatarUrl : null;
            await addDoc(collection(db, 'reviews'), {
                userName:     currentUserName || currentUser.email.split('@')[0],
                userEmail:    currentUser.email,
                userId:       currentUser.uid,
                userAvatarUrl: avatarUrl,
                rating:       parseInt(ratingInput.value),
                text,
                date:         serverTimestamp()
            });
            showNotification('Спасибо за отзыв!', 'success');
            document.getElementById('write-review-form')?.reset();
            closeAllModals();
        } catch (err) { showNotification('Ошибка: ' + err.message, 'error'); }
        finally { btn.classList.remove('loading'); btn.disabled = false; }
    });
}

// ── Вход/Регистрация/Выход ──
function bindAuth() {
    const loginBtn      = document.getElementById('login-btn');
    const loginModal    = document.getElementById('login-modal');
    const registerModal = document.getElementById('register-modal');
    const modalOverlay  = document.getElementById('modal-overlay');

    loginBtn?.addEventListener('click', () => openModal(loginModal));

    document.getElementById('switch-to-register')?.addEventListener('click', () => {
        closeAllModals(); openModal(registerModal);
    });

    document.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', closeAllModals));
    modalOverlay?.addEventListener('click', closeAllModals);

    // Вход
    document.getElementById('login-form')?.addEventListener('submit', async e => {
        e.preventDefault();
        const email = document.getElementById('login-email').value;
        const pass  = document.getElementById('login-password').value;
        try {
            const cred = await signInWithEmailAndPassword(auth, email, pass);
            if (!cred.user.emailVerified) {
                await signOut(auth);
                showNotification('Email не подтверждён. Проверьте «Спам».', 'error', 8000);
                return;
            }
            showNotification('Вход выполнен', 'success');
            closeAllModals();
        } catch (err) { showNotification('Ошибка: ' + err.message, 'error'); }
    });

    // Регистрация
    document.getElementById('register-form-step1')?.addEventListener('submit', async e => {
        e.preventDefault();
        const name  = document.getElementById('register-name').value.trim();
        const email = document.getElementById('register-email').value.trim();
        const pass  = document.getElementById('register-password').value;
        const conf  = document.getElementById('register-confirm').value;
        if (pass !== conf) { showNotification('Пароли не совпадают', 'error'); return; }
        try {
            const cred = await createUserWithEmailAndPassword(auth, email, pass);
            await sendEmailVerification(cred.user);
            await setDoc(doc(db, 'users', cred.user.uid), { name, email, createdAt: serverTimestamp() });
            await signOut(auth);
            showNotification('Подтвердите email (проверьте «Спам»).', 'info', 8000);
            closeAllModals();
        } catch (err) { showNotification('Ошибка: ' + err.message, 'error'); }
    });

    // Забыли пароль
    document.getElementById('forgot-password-btn')?.addEventListener('click', () => {
        const email = prompt('Введите email для сброса:');
        if (email) sendPasswordResetEmail(auth, email)
            .then(()  => showNotification('Письмо отправлено!', 'success'))
            .catch(err => showNotification('Ошибка: ' + err.message, 'error'));
    });

    // Выход
    document.getElementById('dropdown-logout')?.addEventListener('click', async () => {
        await signOut(auth);
        showNotification('Вы вышли', 'info');
        toggleDropdownMenu(false);
    });

    // Аватарка
    document.getElementById('user-avatar-img')?.addEventListener('click', e => {
        e.stopPropagation();
        const menu = document.getElementById('dropdown-menu');
        toggleDropdownMenu(!menu?.classList.contains('show'));
    });
}

// ── Auth state observer ──
function bindAuthState(options = {}) {
    const loginBtn            = document.getElementById('login-btn');
    const userAvatarContainer = document.getElementById('user-avatar-container');
    const userAvatarImg       = document.getElementById('user-avatar-img');

    onAuthStateChanged(auth, async user => {
        if (user) {
            if (!user.emailVerified) { await signOut(auth); return; }
            currentUser = user;

            try {
                const snap = await getDoc(doc(db, 'users', user.uid));
                if (snap.exists()) {
                    const d = snap.data();
                    currentUserName = d.name || user.email.split('@')[0];
                    currentUserRole = d.role || 'user';
                    if (userAvatarImg) userAvatarImg.src = d.avatarUrl || getPlaceholderDataURL(currentUserName);
                } else {
                    currentUserName = user.email.split('@')[0];
                    currentUserRole = 'user';
                    if (userAvatarImg) userAvatarImg.src = getPlaceholderDataURL(currentUserName);
                    await setDoc(doc(db, 'users', user.uid), {
                        name: currentUserName, email: user.email, createdAt: serverTimestamp()
                    });
                }
            } catch {
                currentUserName = user.email.split('@')[0];
                if (userAvatarImg) userAvatarImg.src = getPlaceholderDataURL(currentUserName);
            }

            animateLoginTransition(loginBtn, userAvatarContainer, userAvatarImg);
            if (loginBtn) loginBtn.style.display = 'none';

            onLoginCallbacks.forEach(fn => fn(user, currentUserName, currentUserRole));
            if (options.onLogin) options.onLogin(user, currentUserName, currentUserRole);

        } else {
            currentUser     = null;
            currentUserName = '';
            currentUserRole = 'user';
            animateLogoutTransition(loginBtn, userAvatarContainer);

            onLogoutCallbacks.forEach(fn => fn());
            if (options.onLogout) options.onLogout();
        }
    });
}

// ── Главная точка входа ──
// Вызывай initAuth() в каждом page-script вместо дублирования кода
// options.onLogin(user, name, role) — коллбэк при входе
// options.onLogout()               — коллбэк при выходе
export function initAuth(options = {}) {
    bindAuth();
    bindSettings();
    bindFeedbackBubble();
    loadSettings();
    bindAuthState(options);
}
