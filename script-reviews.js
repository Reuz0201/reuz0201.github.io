// script-reviews.js
import { auth, db, showNotification, getPlaceholderDataURL, toggleDropdownMenu, showConfirm, animateLoginTransition, animateLogoutTransition } from './firebase.js';
import {
    signOut,
    onAuthStateChanged,
    sendPasswordResetEmail,
    signInWithEmailAndPassword,
    createUserWithEmailAndPassword,
    sendEmailVerification
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import {
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    doc,
    setDoc,
    getDoc,
    serverTimestamp,
    limit,
    startAfter,
    deleteDoc,
    updateDoc,
    where,
    arrayUnion,
    arrayRemove,
    getCountFromServer
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// ── DOM ──
const feedbackBubble = document.getElementById('feedback-bubble');
const loginBtn        = document.getElementById('login-btn');
const modalOverlay    = document.getElementById('modal-overlay');
const loginModal      = document.getElementById('login-modal');
const registerModal   = document.getElementById('register-modal');
const writeReviewModal= document.getElementById('write-review-modal');
const editReviewModal = document.getElementById('edit-review-modal');
const replyModal      = document.getElementById('reply-modal');
const settingsModal   = document.getElementById('settings-modal');
const userAvatarContainer = document.getElementById('user-avatar-container');
const userAvatarImg   = document.getElementById('user-avatar-img');
const dropdownLogout  = document.getElementById('dropdown-logout');
const settingsMenuItem= document.getElementById('settings-menu-item');
const grid            = document.getElementById('reviews-full-grid');
const loadMoreBtn     = document.getElementById('load-more-btn');

const REVIEW_MAX_LENGTH = 200;
const PAGE_SIZE = 12;

let currentUser = null;
let currentUserName = '';
let currentUserRole = 'user';
let lastVisible = null;
let allLoaded = false;
let loading = false;
let currentFilter = 'all';
let currentSort = 'newest';   // 'newest' | 'popular'
const reviewCache = {};

// ── Сохранение/восстановление позиции скролла ──
const SS_KEY = 'vibe-reviews-scroll';

function saveScrollState() {
    sessionStorage.setItem(SS_KEY, JSON.stringify({
        scrollY: window.scrollY,
        filter: currentFilter,
        sort: currentSort
    }));
}

function restoreScrollState() {
    try {
        const saved = JSON.parse(sessionStorage.getItem(SS_KEY));
        if (!saved) return false;
        // Восстанавливаем фильтр и сортировку
        currentFilter = saved.filter || 'all';
        currentSort   = saved.sort   || 'newest';
        // Подсвечиваем активные кнопки
        document.querySelectorAll('.filter-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.filter === currentFilter);
        });
        document.querySelectorAll('.sort-btn').forEach(b => {
            b.classList.toggle('active', b.dataset.sort === currentSort);
        });
        return saved.scrollY > 100 ? saved.scrollY : false;
    } catch { return false; }
}

// Сохраняем позицию при уходе со страницы
window.addEventListener('beforeunload', saveScrollState);
// Также при клике на ссылки (page-transitions перехватывает их)
document.addEventListener('click', e => {
    if (e.target.closest('a')) saveScrollState();
});

// ── Статистика ──
async function loadStats() {
    try {
        const snap = await getDocs(collection(db, 'reviews'));
        if (snap.empty) return;
        let total = 0, sum = 0, fives = 0;
        snap.forEach(d => {
            const r = d.data();
            total++;
            sum += r.rating || 0;
            if (r.rating === 5) fives++;
        });
        document.getElementById('stat-count').textContent = total;
        document.getElementById('stat-avg').textContent = (sum / total).toFixed(1);
        document.getElementById('stat-five').textContent = Math.round(fives / total * 100) + '%';
        document.getElementById('reviews-stats').style.opacity = '1';
        updateFaviconBadge(total);
    } catch (e) { console.error(e); }
}

// ── Загрузка отзывов ──
async function loadReviews(reset = true) {
    if (loading || (allLoaded && !reset)) return;
    loading = true;

    if (reset) {
        lastVisible = null;
        allLoaded = false;
        grid.innerHTML = renderSkeletons(4);
        loadMoreBtn.style.display = 'none';
    }

    try {
        let reviews = [];

        if (currentFilter !== 'all' || currentSort === 'popular') {
            // Для фильтра или сортировки по популярности — грузим всё
            const q = query(collection(db, 'reviews'), orderBy('date', 'desc'));
            const snap = await getDocs(q);
            snap.forEach(d => reviews.push({ id: d.id, ...d.data() }));

            if (currentFilter !== 'all')
                reviews = reviews.filter(r => String(r.rating) === currentFilter);

            if (currentSort === 'popular')
                reviews.sort((a, b) => (b.likes?.length || 0) - (a.likes?.length || 0));

            allLoaded = true;
            loadMoreBtn.style.display = 'none';
        } else {
            // Обычная пагинация по дате
            let q = query(collection(db, 'reviews'), orderBy('date', 'desc'), limit(PAGE_SIZE));
            if (!reset && lastVisible)
                q = query(collection(db, 'reviews'), orderBy('date', 'desc'), startAfter(lastVisible), limit(PAGE_SIZE));
            const snap = await getDocs(q);
            snap.forEach(d => reviews.push({ id: d.id, ...d.data() }));
            if (reviews.length < PAGE_SIZE) allLoaded = true;
            if (reviews.length > 0) lastVisible = snap.docs[snap.docs.length - 1];
            loadMoreBtn.style.display = allLoaded ? 'none' : 'block';
            loadMoreBtn.disabled = false;
        }

        if (reset) renderGrid(reviews);
        else appendGrid(reviews);

    } catch (e) {
        console.error(e);
        showNotification('Ошибка загрузки', 'error');
    } finally {
        loading = false;
    }
}

function renderSkeletons(n) {
    return Array(n).fill(0).map(() => `
        <div class="rv-skeleton">
            <div style="display:flex;gap:12px;align-items:center;">
                <div class="skeleton-line" style="width:44px;height:44px;border-radius:50%;flex-shrink:0;"></div>
                <div style="flex:1;"><div class="skeleton-line" style="width:55%;"></div></div>
            </div>
            <div class="skeleton-line" style="width:30%;"></div>
            <div class="skeleton-line"></div>
            <div class="skeleton-line" style="width:75%;"></div>
        </div>`).join('');
}

function renderGrid(reviews) {
    if (reviews.length === 0) {
        grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;padding:60px 0;color:var(--text-dim);">
            ${currentFilter === 'all' ? 'Отзывов пока нет.' : 'Нет отзывов с такой оценкой.'}
        </div>`;
        return;
    }
    grid.innerHTML = reviews.map(r => renderCard(r)).join('');
    attachCardHandlers();
}

function appendGrid(reviews) {
    if (reviews.length === 0) return;
    grid.insertAdjacentHTML('beforeend', reviews.map(r => renderCard(r)).join(''));
    attachCardHandlers();
}

function renderCard(r) {
    reviewCache[r.id] = r;
    const date = r.date ? new Date(r.date.toDate()).toLocaleDateString('ru-RU', { day:'numeric', month:'long', year:'numeric' }) : '';
    const avatarHtml = r.userAvatarUrl
        ? `<img src="${r.userAvatarUrl}" alt="avatar">`
        : (r.userName ? r.userName.charAt(0).toUpperCase() : '?');

    const canEdit = currentUser && (currentUser.uid === r.userId || currentUserRole === 'admin');
    // Admin or owner can reply
    const canReply = currentUser && (currentUserRole === 'admin' || currentUser.uid === r.userId);

    const actionsHtml = canEdit ? `
        <div class="rv-actions">
            <button class="rv-action-btn edit-review-btn"
                data-id="${r.id}" data-rating="${r.rating}"
                data-text="${r.text.replace(/"/g, '&quot;')}">✏️ Ред.</button>
            <button class="rv-action-btn delete-review-btn" data-id="${r.id}">🗑️ Удалить</button>
            ${canReply ? `<button class="rv-action-btn reply-review-btn" data-id="${r.id}" data-author="${r.userName}">↩️ Ответить</button>` : ''}
        </div>` : '';

    const isLong = r.text.length > REVIEW_MAX_LENGTH;
    const displayText = isLong ? r.text.slice(0, REVIEW_MAX_LENGTH) + '…' : r.text;
    const readMore = isLong
        ? `<button class="rv-read-more" data-id="${r.id}">читать далее</button>` : '';

    // Лайки
    const likes = r.likes || [];
    const likedByMe = currentUser && likes.includes(currentUser.uid);
    const likeCount = likes.length;

    // Ответ автора
    const replyHtml = r.reply ? `
        <div class="rv-reply">
            <div class="rv-reply-header">
                <span class="rv-reply-badge">👑 Автор</span>
                <span class="rv-reply-date">${r.replyDate ? new Date(r.replyDate.toDate()).toLocaleDateString('ru-RU') : ''}</span>
            </div>
            <p class="rv-reply-text">${r.reply}</p>
        </div>` : '';

    return `
        <div class="rv-card" data-id="${r.id}">
            <div class="rv-header">
                <div class="rv-avatar">${avatarHtml}</div>
                <span class="rv-name">${r.userName}</span>
                <span class="rv-date">${date}</span>
            </div>
            <div class="rv-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5 - r.rating)}</div>
            <p class="rv-text">${displayText}</p>
            ${readMore}
            ${replyHtml}
            <div class="rv-footer">
                <button class="rv-like-btn ${likedByMe ? 'liked' : ''}" data-id="${r.id}">
                    ${likedByMe ? '👍' : '👍'} <span class="rv-like-count">${likeCount > 0 ? likeCount : ''}</span>
                    <span class="rv-like-label">${likedByMe ? 'Полезно' : 'Полезный отзыв'}</span>
                </button>
            </div>
            ${actionsHtml}
        </div>`;
}

function attachCardHandlers() {
    grid.querySelectorAll('.rv-read-more').forEach(btn => {
        btn.addEventListener('click', e => {
            openFullPopup(reviewCache[e.target.dataset.id], e.target);
        });
    });
    grid.querySelectorAll('.edit-review-btn').forEach(btn => {
        btn.addEventListener('click', e => {
            const b = e.target;
            openEditModal(b.dataset.id, b.dataset.rating, b.dataset.text);
        });
    });
    grid.querySelectorAll('.delete-review-btn').forEach(btn => {
        btn.addEventListener('click', async e => {
            const id = e.target.dataset.id;
            const confirmed = await showConfirm('Удалить этот отзыв?', 'Удалить', 'Отмена');
            if (!confirmed) return;
            try {
                await deleteDoc(doc(db, 'reviews', id));
                showNotification('Отзыв удалён', 'success');
                loadReviews(true);
                loadStats();
            } catch (err) { showNotification('Ошибка: ' + err.message, 'error'); }
        });
    });

    // ── Лайки ──
    grid.querySelectorAll('.rv-like-btn').forEach(btn => {
        btn.addEventListener('click', async () => {
            if (!currentUser) { openModal(loginModal); return; }
            const id = btn.dataset.id;
            const r = reviewCache[id];
            if (!r) return;
            const likes = r.likes || [];
            const alreadyLiked = likes.includes(currentUser.uid);
            const newLikes = alreadyLiked
                ? likes.filter(uid => uid !== currentUser.uid)
                : [...likes, currentUser.uid];
            // Optimistic update
            reviewCache[id] = { ...r, likes: newLikes };
            btn.classList.toggle('liked', !alreadyLiked);
            const countEl = btn.querySelector('.rv-like-count');
            const labelEl = btn.querySelector('.rv-like-label');
            countEl.textContent = newLikes.length > 0 ? newLikes.length : '';
            labelEl.textContent = !alreadyLiked ? 'Полезно' : 'Полезный отзыв';
            // Animate
            btn.style.transform = 'scale(1.2)';
            setTimeout(() => btn.style.transform = '', 200);
            try {
                await updateDoc(doc(db, 'reviews', id), {
                    likes: alreadyLiked ? arrayRemove(currentUser.uid) : arrayUnion(currentUser.uid)
                });
            } catch (err) {
                // Rollback
                reviewCache[id] = r;
                btn.classList.toggle('liked', alreadyLiked);
                countEl.textContent = likes.length > 0 ? likes.length : '';
                showNotification('Ошибка: ' + err.message, 'error');
            }
        });
    });

    // ── Ответы (кнопка) ──
    grid.querySelectorAll('.reply-review-btn').forEach(btn => {
        btn.addEventListener('click', () => {
            const id = btn.dataset.id;
            const author = btn.dataset.author;
            const r = reviewCache[id];
            document.getElementById('reply-preview').textContent = `↩️ Ответ для ${author}: «${r?.text?.slice(0, 60)}${r?.text?.length > 60 ? '…' : ''}»`;
            document.getElementById('reply-text').value = r?.reply || '';
            document.getElementById('reply-char-count').textContent = r?.reply?.length || 0;
            currentReplyId = id;
            openModal(replyModal);
        });
    });
}

// ── Полный текст отзыва ──
const rvFullPopup  = document.getElementById('rv-full-popup');
const rvFullMeta   = document.getElementById('rv-full-meta');
const rvFullStars  = document.getElementById('rv-full-stars');
const rvFullText   = document.getElementById('rv-full-text');
const rvFullDate   = document.getElementById('rv-full-date');
const rvFullClose  = document.getElementById('rv-full-close');

function openFullPopup(r, triggerEl) {
    if (!r) return;
    const date = r.date ? new Date(r.date.toDate()).toLocaleString('ru-RU') : '';
    const avatarHtml = r.userAvatarUrl
        ? `<img src="${r.userAvatarUrl}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">`
        : `<div class="rv-avatar">${r.userName?.charAt(0).toUpperCase() || '?'}</div>`;
    rvFullMeta.innerHTML = `${avatarHtml}<span style="font-weight:600;">${r.userName}</span>`;
    rvFullStars.textContent = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
    rvFullText.textContent  = r.text;
    rvFullDate.textContent  = date;

    const inner = document.getElementById('rv-full-inner');

    if (triggerEl) {
        // Получаем координаты кнопки "читать далее" относительно вьюпорта
        const rect   = triggerEl.getBoundingClientRect();
        const originX = rect.left + rect.width  / 2;
        const originY = rect.top  + rect.height / 2;

        // Задаём transform-origin как точку откуда "вылетает" попап
        const vpW = window.innerWidth;
        const vpH = window.innerHeight;
        const pctX = ((originX / vpW) * 100).toFixed(1) + '%';
        const pctY = ((originY / vpH) * 100).toFixed(1) + '%';

        // Сначала показываем оверлей
        rvFullPopup.style.display = 'flex';
        rvFullPopup.style.opacity = '0';
        rvFullPopup.style.transition = 'opacity 0.25s ease';

        // Карточку — из точки нажатия
        inner.style.transition = 'none';
        inner.style.transformOrigin = `${pctX} ${pctY}`;
        inner.style.transform  = `scale(0.08) translate(${(originX - vpW/2) * 8}px, ${(originY - vpH/2) * 8}px)`;
        inner.style.opacity    = '0';

        // force reflow
        void inner.offsetHeight;

        // Запускаем анимацию
        inner.style.transition = 'transform 0.38s cubic-bezier(0.2, 1.1, 0.4, 1), opacity 0.25s ease';
        inner.style.transform  = 'scale(1) translate(0, 0)';
        inner.style.opacity    = '1';
        inner.style.transformOrigin = 'center center';

        rvFullPopup.style.opacity = '1';
    } else {
        // Фолбэк — простое появление
        inner.style.transition = 'transform 0.3s ease, opacity 0.3s ease';
        inner.style.transform  = 'scale(0.9)';
        inner.style.opacity    = '0';
        rvFullPopup.style.display = 'flex';
        void inner.offsetHeight;
        inner.style.transform = 'scale(1)';
        inner.style.opacity   = '1';
    }
}

function closeFullPopup() {
    const inner = document.getElementById('rv-full-inner');
    inner.style.transition = 'transform 0.2s ease, opacity 0.18s ease';
    inner.style.transform  = 'scale(0.92)';
    inner.style.opacity    = '0';
    rvFullPopup.style.transition = 'opacity 0.2s ease';
    rvFullPopup.style.opacity    = '0';
    setTimeout(() => {
        rvFullPopup.style.display   = 'none';
        rvFullPopup.style.opacity   = '';
        inner.style.transform = '';
        inner.style.opacity   = '';
    }, 200);
}

rvFullClose.addEventListener('click', closeFullPopup);
rvFullPopup.addEventListener('click', e => { if (e.target === rvFullPopup) closeFullPopup(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeFullPopup(); });

// ── Фильтр ──
document.getElementById('reviews-filter').addEventListener('click', e => {
    const btn = e.target.closest('.filter-btn');
    if (!btn) return;
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentFilter = btn.dataset.filter;
    loadReviews(true);
});

// ── Сортировка ──
document.getElementById('reviews-sort').addEventListener('click', e => {
    const btn = e.target.closest('.sort-btn');
    if (!btn) return;
    document.querySelectorAll('.sort-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentSort = btn.dataset.sort;
    loadReviews(true);
});

// ── Favicon badge (счётчик на вкладке) ──
function updateFaviconBadge(count) {
    const canvas = document.createElement('canvas');
    canvas.width = 32; canvas.height = 32;
    const ctx = canvas.getContext('2d');

    // Базовый favicon — буква В на тёмном фоне
    ctx.fillStyle = '#0f1113';
    ctx.beginPath();
    ctx.roundRect(0, 0, 32, 32, 8);
    ctx.fill();

    ctx.fillStyle = '#00f2ff';
    ctx.font = 'bold 20px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('В', 16, 17);

    // Badge с числом
    if (count > 0) {
        const label = count > 99 ? '99+' : String(count);
        const badgeW = label.length > 1 ? 18 : 14;
        ctx.fillStyle = '#ff4d4d';
        ctx.beginPath();
        ctx.roundRect(32 - badgeW, 0, badgeW, 14, 5);
        ctx.fill();
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 9px Inter, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(label, 32 - badgeW / 2, 7);
    }

    let link = document.querySelector("link[rel~='icon']");
    if (!link) { link = document.createElement('link'); link.rel = 'icon'; document.head.appendChild(link); }
    link.href = canvas.toDataURL();
}

// ── Загрузить ещё ──
loadMoreBtn.addEventListener('click', () => {
    loadMoreBtn.disabled = true;
    loadReviews(false);
});

// ── Обработчик кнопки отзыва ──
feedbackBubble.addEventListener('click', () => {
    if (!currentUser) openModal(loginModal);
    else openModal(writeReviewModal);
});

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

// ── Написать отзыв ──
document.getElementById('write-review-form').addEventListener('submit', async e => {
    e.preventDefault();
    if (!currentUser) { openModal(loginModal); return; }
    const ratingInput = document.querySelector('input[name="rating"]:checked');
    if (!ratingInput) { showNotification('Поставьте оценку', 'error'); return; }
    const text = document.getElementById('review-text').value.trim();
    if (!text) { showNotification('Напишите текст отзыва', 'error'); return; }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
        // Проверка: уже есть отзыв от этого пользователя?
        const existingQ = query(collection(db, 'reviews'), where('userId', '==', currentUser.uid));
        const existingSnap = await getDocs(existingQ);
        if (!existingSnap.empty) {
            showNotification('Вы уже оставили отзыв. Можно отредактировать его в списке.', 'error', 6000);
            submitBtn.classList.remove('loading');
            submitBtn.disabled = false;
            return;
        }

        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userAvatarUrl = userDoc.exists() ? userDoc.data().avatarUrl : null;
        await addDoc(collection(db, 'reviews'), {
            userName: currentUserName || currentUser.email.split('@')[0],
            userEmail: currentUser.email,
            userId: currentUser.uid,
            userAvatarUrl: userAvatarUrl,
            rating: parseInt(ratingInput.value),
            text,
            date: serverTimestamp()
        });
        showNotification('Спасибо за отзыв!', 'success');
        document.getElementById('write-review-form').reset();
        closeAllModals();
        loadReviews(true);
        loadStats();
    } catch (err) {
        showNotification('Ошибка: ' + err.message, 'error');
    } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
});

// ── Ответ на отзыв ──
let currentReplyId = null;
document.getElementById('reply-text').addEventListener('input', e => {
    document.getElementById('reply-char-count').textContent = e.target.value.length;
});
document.getElementById('reply-form').addEventListener('submit', async e => {
    e.preventDefault();
    const text = document.getElementById('reply-text').value.trim();
    if (!text || !currentReplyId) return;
    const btn = e.target.querySelector('button[type="submit"]');
    btn.classList.add('loading'); btn.disabled = true;
    try {
        await updateDoc(doc(db, 'reviews', currentReplyId), {
            reply: text,
            replyDate: serverTimestamp()
        });
        showNotification('Ответ добавлен!', 'success');
        closeAllModals();
        loadReviews(true);
    } catch (err) { showNotification('Ошибка: ' + err.message, 'error'); }
    finally { btn.classList.remove('loading'); btn.disabled = false; }
});

// ── Редактировать отзыв ──
let editReviewId = null;
function openEditModal(id, rating, text) {
    editReviewId = id;
    const r = document.querySelector(`input[name="edit-rating"][value="${rating}"]`);
    if (r) r.checked = true;
    document.getElementById('edit-review-text').value = text;
    document.getElementById('edit-char-count').textContent = text.length;
    openModal(editReviewModal);
}
document.getElementById('edit-review-text').addEventListener('input', e => {
    document.getElementById('edit-char-count').textContent = e.target.value.length;
});
document.getElementById('edit-review-form').addEventListener('submit', async e => {
    e.preventDefault();
    const ratingInput = document.querySelector('input[name="edit-rating"]:checked');
    if (!ratingInput) { showNotification('Поставьте оценку', 'error'); return; }
    const text = document.getElementById('edit-review-text').value.trim();
    if (!text) { showNotification('Напишите текст', 'error'); return; }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
        await updateDoc(doc(db, 'reviews', editReviewId), {
            rating: parseInt(ratingInput.value), text, date: serverTimestamp()
        });
        showNotification('Отзыв обновлён', 'success');
        closeAllModals();
        loadReviews(true);
    } catch (err) {
        showNotification('Ошибка: ' + err.message, 'error');
    } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
});

// ── Вход ──
loginBtn.addEventListener('click', () => openModal(loginModal));
document.getElementById('forgot-password-btn').addEventListener('click', () => {
    const email = prompt('Введите ваш email для сброса пароля:');
    if (email) sendPasswordResetEmail(auth, email)
        .then(() => showNotification('Письмо отправлено!', 'success'))
        .catch(err => showNotification('Ошибка: ' + err.message, 'error'));
});
document.getElementById('login-form').addEventListener('submit', async e => {
    e.preventDefault();
    const email    = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;
    try {
        const cred = await signInWithEmailAndPassword(auth, email, password);
        if (!cred.user.emailVerified) {
            await signOut(auth);
            showNotification('Email не подтверждён. Проверьте папку «Спам».', 'error', 8000);
            return;
        }
        showNotification('Вход выполнен', 'success');
        closeAllModals();
    } catch (err) { showNotification('Ошибка: ' + err.message, 'error'); }
});

// ── Регистрация ──
document.getElementById('register-form-step1').addEventListener('submit', async e => {
    e.preventDefault();
    const name     = document.getElementById('register-name').value.trim();
    const email    = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm  = document.getElementById('register-confirm').value;
    if (password !== confirm) { showNotification('Пароли не совпадают', 'error'); return; }
    try {
        const cred = await createUserWithEmailAndPassword(auth, email, password);
        await sendEmailVerification(cred.user);
        await setDoc(doc(db, 'users', cred.user.uid), { name, email, createdAt: serverTimestamp() });
        await signOut(auth);
        showNotification('Подтвердите email (проверьте папку «Спам»).', 'info', 8000);
        closeAllModals();
    } catch (err) { showNotification('Ошибка: ' + err.message, 'error'); }
});

// ── Auth state ──
let reviewsInitiallyLoaded = false;
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
                userAvatarImg.src = d.avatarUrl || getPlaceholderDataURL(currentUserName);
            } else {
                currentUserName = user.email.split('@')[0];
                userAvatarImg.src = getPlaceholderDataURL(currentUserName);
                await setDoc(doc(db, 'users', user.uid), { name: currentUserName, email: user.email, createdAt: serverTimestamp() });
            }
        } catch {
            currentUserName = user.email.split('@')[0];
            userAvatarImg.src = getPlaceholderDataURL(currentUserName);
        }
        animateLoginTransition(loginBtn, userAvatarContainer, userAvatarImg);
        loginBtn.style.display = 'none';
        // Перерисовываем только если уже загружены (чтобы показать кнопки редактирования)
        if (reviewsInitiallyLoaded) loadReviews(true);
    } else {
        currentUser = null;
        currentUserName = '';
        currentUserRole = 'user';
        animateLogoutTransition(loginBtn, userAvatarContainer);
    }
});

feedbackBubble.addEventListener('click', () => {
    if (!currentUser) openModal(loginModal);
    else openModal(writeReviewModal);
});

// ── Аватарка / меню ──
userAvatarImg.addEventListener('click', e => {
    e.stopPropagation();
    const menu = document.getElementById('dropdown-menu');
    toggleDropdownMenu(!menu.classList.contains('show'));
});
dropdownLogout.addEventListener('click', async () => {
    await signOut(auth);
    showNotification('Вы вышли', 'info');
    toggleDropdownMenu(false);
});
settingsMenuItem?.addEventListener('click', e => {
    e.preventDefault();
    toggleDropdownMenu(false);
    openModal(settingsModal);
});

// ── Настройки ──
function loadSettings() {
    const theme = localStorage.getItem('vibe-theme') || 'dark';
    document.body.classList.toggle('theme-light', theme === 'light');
    document.getElementById('theme-dark').classList.toggle('active', theme !== 'light');
    document.getElementById('theme-light').classList.toggle('active', theme === 'light');
    const ps = localStorage.getItem('vibe-particle-setting');
    if (ps) { try { document.getElementById('particle-count').value = JSON.parse(ps).count; } catch {} }
}
document.getElementById('theme-dark').addEventListener('click', () => {
    document.body.classList.remove('theme-light');
    localStorage.setItem('vibe-theme', 'dark');
    document.getElementById('theme-dark').classList.add('active');
    document.getElementById('theme-light').classList.remove('active');
});
document.getElementById('theme-light').addEventListener('click', () => {
    document.body.classList.add('theme-light');
    localStorage.setItem('vibe-theme', 'light');
    document.getElementById('theme-light').classList.add('active');
    document.getElementById('theme-dark').classList.remove('active');
});
document.getElementById('particle-count').addEventListener('change', e => {
    const count = parseInt(e.target.value);
    localStorage.setItem('vibe-particle-setting', JSON.stringify({ count }));
    window.dispatchEvent(new StorageEvent('storage', { key: 'vibe-particle-setting', newValue: JSON.stringify({ count }) }));
});
document.getElementById('close-settings').addEventListener('click', closeAllModals);

loadSettings();

// ── Инициализация ──
loadStats();

const savedScrollY = restoreScrollState();
loadReviews(true).then(() => {
    reviewsInitiallyLoaded = true;
    if (savedScrollY) {
        // Небольшая задержка чтобы DOM успел отрендериться
        setTimeout(() => {
            window.scrollTo({ top: savedScrollY, behavior: 'instant' });
        }, 80);
    }
    // Чистим сохранёнку чтобы следующий визит начинался сначала
    sessionStorage.removeItem(SS_KEY);
});