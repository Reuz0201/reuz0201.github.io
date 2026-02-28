// script-download.js
import { auth, db, showNotification, getPlaceholderDataURL, toggleDropdownMenu } from './firebase.js';
import { signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc, query, where, getDocs, orderBy } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// ── Загрузка Changelog из Firestore ──
const TAG_COLORS = {
    new:      '#00f2ff',
    fix:      '#ff6b6b',
    improve:  '#fbbf24',
    remove:   '#a78bfa',
    security: '#34d399',
};
const TAG_LABELS = {
    new:      '✨ Новое',
    fix:      '🔧 Исправление',
    improve:  '⚡ Улучшение',
    remove:   '🗑 Удалено',
    security: '🔒 Безопасность',
};

async function loadChangelog() {
    const container = document.getElementById('changelog-container');
    if (!container) return;

    try {
        const q = query(collection(db, 'changelog'), orderBy('createdAt', 'desc'));
        const snap = await getDocs(q);

        if (snap.empty) {
            container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:24px 0;">Записей пока нет</p>';
            return;
        }

        let html = '';
        snap.forEach(d => {
            const entry = d.data();

            // Теги
            const tagsHtml = (entry.tags || []).map(t => {
                const color = TAG_COLORS[t] || '#888';
                const label = TAG_LABELS[t] || t;
                return `<span class="tag" style="
                    background:${color}18;
                    color:${color};
                    border:1px solid ${color}40;
                    border-radius:20px;
                    padding:2px 10px;
                    font-size:0.72rem;
                    font-weight:500;
                    letter-spacing:0.3px;
                ">${label}</span>`;
            }).join('');

            // Список изменений
            const changesHtml = (entry.changes || [])
                .map(c => `<li>${c}</li>`)
                .join('');

            html += `
                <div class="changelog-item">
                    <div class="changelog-version">
                        <div class="ver">${entry.version}</div>
                        <div class="date">${entry.date || ''}</div>
                    </div>
                    <div class="changelog-content">
                        <h4>${entry.title}</h4>
                        ${tagsHtml ? `<div class="changelog-tags" style="display:flex;flex-wrap:wrap;gap:6px;margin-bottom:12px;">${tagsHtml}</div>` : ''}
                        <ul class="changelog-list">${changesHtml}</ul>
                    </div>
                </div>
            `;
        });

        container.innerHTML = html;
    } catch (err) {
        console.error('Changelog load error:', err);
        container.innerHTML = '<p style="color:var(--text-muted);text-align:center;padding:24px 0;">Не удалось загрузить changelog</p>';
    }
}

loadChangelog();

const loginBtn            = document.getElementById('login-btn');
const userAvatarContainer = document.getElementById('user-avatar-container');
const userAvatarImg       = document.getElementById('user-avatar-img');
const dropdownMenu        = document.getElementById('dropdown-menu');
const dropdownLogout      = document.getElementById('dropdown-logout');
const modalOverlay        = document.getElementById('modal-overlay');
const loginModal          = document.getElementById('login-modal');
const registerModal       = document.getElementById('register-modal');
const settingsModal       = document.getElementById('settings-modal');
const feedbackBubble      = document.getElementById('feedback-bubble');
const writeReviewModal    = document.getElementById('write-review-modal');

let currentUser     = null;
let currentUserName = '';

// ── Модалки ──
function openModal(m) {
    closeAllModals();
    modalOverlay.style.display = 'flex';
    m.classList.add('show');
}
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
    modalOverlay.style.display = 'none';
}
document.querySelectorAll('.modal-close').forEach(b => b.addEventListener('click', closeAllModals));
modalOverlay.addEventListener('click', closeAllModals);
document.getElementById('switch-to-register').addEventListener('click', () => { closeAllModals(); openModal(registerModal); });

// ── Вход ──
loginBtn.addEventListener('click', () => openModal(loginModal));
document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const pass  = document.getElementById('login-password').value;
    try {
        const cred = await signInWithEmailAndPassword(auth, email, pass);
        if (!cred.user.emailVerified) { await signOut(auth); showNotification('Email не подтверждён.', 'error', 6000); return; }
        showNotification('Вход выполнен', 'success');
        closeAllModals();
    } catch (err) { showNotification('Ошибка: ' + err.message, 'error'); }
});

// ── Регистрация ──
document.getElementById('register-form-step1').addEventListener('submit', async e => {
    e.preventDefault();
    const name = document.getElementById('register-name').value.trim();
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

// ── Забыли пароль ──
document.getElementById('forgot-password-btn').addEventListener('click', () => {
    const email = prompt('Введите email для сброса:');
    if (email) sendPasswordResetEmail(auth, email)
        .then(() => showNotification('Письмо отправлено!', 'success'))
        .catch(err => showNotification('Ошибка: ' + err.message, 'error'));
});

// ── Отзыв ──
feedbackBubble.addEventListener('click', () => {
    if (!currentUser) openModal(loginModal);
    else openModal(writeReviewModal);
});

document.getElementById('write-review-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!currentUser) { openModal(loginModal); return; }
    const ratingInput = document.querySelector('input[name="rating"]:checked');
    if (!ratingInput) { showNotification('Поставьте оценку', 'error'); return; }
    const text = document.getElementById('review-text').value.trim();
    if (!text) { showNotification('Напишите текст', 'error'); return; }
    const btn = e.target.querySelector('button[type="submit"]');
    btn.classList.add('loading'); btn.disabled = true;
    try {
        const existing = await getDocs(query(collection(db, 'reviews'), where('userId', '==', currentUser.uid)));
        if (!existing.empty) { showNotification('Вы уже оставили отзыв.', 'error', 6000); return; }
        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const avatarUrl = userDoc.exists() ? userDoc.data().avatarUrl : null;
        await addDoc(collection(db, 'reviews'), {
            userName: currentUserName || currentUser.email.split('@')[0],
            userEmail: currentUser.email, userId: currentUser.uid,
            userAvatarUrl: avatarUrl, rating: parseInt(ratingInput.value), text, date: serverTimestamp()
        });
        showNotification('Спасибо за отзыв!', 'success');
        document.getElementById('write-review-form').reset();
        closeAllModals();
    } catch (err) { showNotification('Ошибка: ' + err.message, 'error'); }
    finally { btn.classList.remove('loading'); btn.disabled = false; }
});

// ── Аватарка / меню ──
userAvatarImg.addEventListener('click', e => {
    e.stopPropagation();
    toggleDropdownMenu(!dropdownMenu.classList.contains('show'));
});
dropdownLogout.addEventListener('click', async () => {
    await signOut(auth); showNotification('Вы вышли', 'info'); toggleDropdownMenu(false);
});
document.getElementById('settings-menu-item').addEventListener('click', e => {
    e.preventDefault(); toggleDropdownMenu(false); openModal(settingsModal);
});

// ── Настройки ──
function loadSettings() {
    const t = localStorage.getItem('vibe-theme') || 'dark';
    document.body.classList.toggle('theme-light', t === 'light');
    document.getElementById('theme-dark').classList.toggle('active', t !== 'light');
    document.getElementById('theme-light').classList.toggle('active', t === 'light');
    const ps = localStorage.getItem('vibe-particle-setting');
    if (ps) try { document.getElementById('particle-count').value = JSON.parse(ps).count; } catch {}
}
document.getElementById('theme-dark').addEventListener('click', () => {
    document.body.classList.remove('theme-light'); localStorage.setItem('vibe-theme', 'dark');
    document.getElementById('theme-dark').classList.add('active');
    document.getElementById('theme-light').classList.remove('active');
});
document.getElementById('theme-light').addEventListener('click', () => {
    document.body.classList.add('theme-light'); localStorage.setItem('vibe-theme', 'light');
    document.getElementById('theme-light').classList.add('active');
    document.getElementById('theme-dark').classList.remove('active');
});
document.getElementById('particle-count').addEventListener('change', e => {
    const count = parseInt(e.target.value);
    localStorage.setItem('vibe-particle-setting', JSON.stringify({ count }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'vibe-particle-setting', newValue: JSON.stringify({ count }) }));
});
document.getElementById('close-settings').addEventListener('click', closeAllModals);

// ── Auth state ──
onAuthStateChanged(auth, async user => {
    if (user) {
        if (!user.emailVerified) { await signOut(auth); return; }
        currentUser = user;
        try {
            const snap = await getDoc(doc(db, 'users', user.uid));
            currentUserName = snap.exists() ? (snap.data().name || user.email.split('@')[0]) : user.email.split('@')[0];
            userAvatarImg.src = (snap.exists() && snap.data().avatarUrl) ? snap.data().avatarUrl : getPlaceholderDataURL(currentUserName);
        } catch { currentUserName = user.email.split('@')[0]; userAvatarImg.src = getPlaceholderDataURL(currentUserName); }
        userAvatarContainer.style.display = 'inline-block';
        setTimeout(() => userAvatarContainer.classList.add('loaded'), 50);
        loginBtn.style.display = 'none';
    } else {
        currentUser = null;
        userAvatarContainer.classList.remove('loaded');
        userAvatarContainer.style.display = 'none';
        loginBtn.style.display = 'block';
    }
});

loadSettings();
