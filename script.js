import { auth, db, showNotification, getPlaceholderDataURL, toggleDropdownMenu, animateLoginTransition, animateLogoutTransition } from './firebase.js';
import { 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendEmailVerification,
    sendPasswordResetEmail
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
    onSnapshot,
    limit,
    where
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// DOM элементы
const feedbackBubble = document.getElementById('feedback-bubble');
const modalOverlay = document.getElementById('modal-overlay');
const writeReviewModal = document.getElementById('write-review-modal');
const loginModal = document.getElementById('login-modal');
const registerModal = document.getElementById('register-modal');
const closeButtons = document.querySelectorAll('.modal-close');
const latestGrid = document.getElementById('latest-reviews-grid');
const loginBtn = document.getElementById('login-btn');
const forgotPasswordBtn = document.getElementById('forgot-password-btn');
const notificationContainer = document.getElementById('notification-container');

const userAvatarContainer = document.getElementById('user-avatar-container');
const userAvatarImg = document.getElementById('user-avatar-img');
const dropdownMenu = document.getElementById('dropdown-menu');
const dropdownLogout = document.getElementById('dropdown-logout');

let currentUser = null;
let currentUserName = '';
let currentUserAvatar = null;

const REVIEW_MAX_LENGTH = 100;
const reviewCache = {};

// --- Попап полного текста отзыва ---
const fullPopup = document.createElement('div');
fullPopup.style.cssText = `
    display:none; position:fixed; inset:0; z-index:9999;
    background:rgba(0,0,0,0.75); backdrop-filter:blur(4px);
    align-items:center; justify-content:center;
`;
fullPopup.innerHTML = `
    <div style="background:var(--modal-bg); border:1px solid var(--glass-border);
        border-radius:24px; padding:32px; max-width:560px; width:92%;
        max-height:80vh; overflow-y:auto; position:relative;">
        <button id="fp-close" style="position:absolute;top:14px;right:16px;background:none;
            border:none;color:var(--text-dim);font-size:1.5rem;cursor:pointer;line-height:1;">&times;</button>
        <div id="fp-meta" style="display:flex;gap:14px;align-items:center;margin-bottom:14px;"></div>
        <div id="fp-stars" style="color:#fbbf24;font-size:1rem;letter-spacing:2px;margin-bottom:14px;"></div>
        <p id="fp-text" style="color:var(--text-secondary);font-size:1rem;line-height:1.7;margin:0;"></p>
        <div id="fp-date" style="font-size:0.75rem;color:var(--text-muted);margin-top:12px;"></div>
    </div>
`;
document.body.appendChild(fullPopup);
document.getElementById('fp-close').addEventListener('click', () => fullPopup.style.display = 'none');
fullPopup.addEventListener('click', e => { if (e.target === fullPopup) fullPopup.style.display = 'none'; });

function openFullPopup(r) {
    const date = r.date ? new Date(r.date.toDate()).toLocaleString() : 'только что';
    const avatarHtml = r.userAvatarUrl
        ? `<img src="${r.userAvatarUrl}" style="width:48px;height:48px;border-radius:50%;object-fit:cover;">`
        : `<div style="width:48px;height:48px;border-radius:50%;background:linear-gradient(135deg,#00f2ff,#7c4dff);display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:700;color:#fff;">${r.userName?.charAt(0).toUpperCase() || '?'}</div>`;
    document.getElementById('fp-meta').innerHTML = `${avatarHtml}<span style="font-weight:600;font-size:1.1rem;">${r.userName}</span>`;
    document.getElementById('fp-stars').textContent = '★'.repeat(r.rating) + '☆'.repeat(5 - r.rating);
    document.getElementById('fp-text').textContent = r.text;
    document.getElementById('fp-date').textContent = date;
    fullPopup.style.display = 'flex';
}

// // --- Уведомления ---
// function showNotification(message, type = 'info', duration = 4000) {
//     if (!notificationContainer) return;
//     const notification = document.createElement('div');
//     notification.className = `notification ${type}`;
//     notification.textContent = message;
//     notificationContainer.appendChild(notification);
//     setTimeout(() => {
//         notification.classList.add('fade-out');
//         setTimeout(() => notification.remove(), 300);
//     }, duration);
// }

// --- Анимация печати текста ---
function typeWriter(element, text, speed = 50, callback) {
    if (!element) return;
    let i = 0;
    element.innerHTML = '';
    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        } else if (callback) callback();
    }
    type();
}

// --- Загрузка отзывов с real-time обновлением ---
let lastReviews = [];
let totalReviewCount = 0;

function subscribeToReviews() {
    // Подписка на последние 3 для отображения
    const q = query(collection(db, 'reviews'), orderBy('date', 'desc'), limit(3));
    onSnapshot(q, (snapshot) => {
        const reviews = [];
        snapshot.forEach((doc) => {
            reviews.push({ id: doc.id, ...doc.data() });
        });
        animateReviewUpdate(reviews);
        lastReviews = reviews;
    });

    // Отдельная подписка на счётчик (только metadata)
    onSnapshot(collection(db, 'reviews'), (snapshot) => {
        const count = snapshot.size;
        if (window.updateReviewCounter) window.updateReviewCounter(count);
        totalReviewCount = count;
    });
}

// --- Анимация обновления карточек (ПЛАВНАЯ: новая слева, старые сдвиг) ---
function animateReviewUpdate(newReviews) {
    if (!latestGrid) return;
    
    // Если нет старых отзывов, просто рендерим
    if (lastReviews.length === 0) {
        renderLatestReviews(newReviews);
        lastReviews = newReviews;
        return;
    }
    
    // Находим новый отзыв (которого не было в lastReviews)
    const newReview = newReviews.find(r => !lastReviews.some(lr => lr.id === r.id));
    
    if (newReview) {
        const oldCards = Array.from(latestGrid.children);
        
        // Этап 1: старые карточки уезжают вправо, последняя затухает
        oldCards.forEach((card, index) => {
            if (!card || !card.style) return;
            card.style.transition = 'transform 0.5s ease, opacity 0.5s ease';
            card.style.transform = 'translateX(108%)';
            if (index === oldCards.length - 1) {
                card.style.opacity = '0';
            }
        });
        
        // Этап 2: ждём окончания (500 мс)
        setTimeout(() => {
            // Рендерим новые
            renderLatestReviews(newReviews);
            
            const newCards = Array.from(latestGrid.children);
            
            // Этап 3: готовим новую первую карточку (выезжает слева)
            // и сразу делаем остальные видимыми на своих местах
            newCards.forEach((card, i) => {
                if (!card || !card.style) return;
                card.style.transition = 'none'; // убираем transition на момент установки
                if (i === 0) {
                    // Первая карточка (новая) будет выезжать слева
                    card.style.transform = 'translateX(-33%)';
                    card.style.opacity = '0';
                } else {
                    // Остальные сразу на своих местах
                    card.style.transform = '';
                    card.style.opacity = '1';
                }
            });
            
            // force reflow
            void latestGrid.offsetHeight;
            
            // Этап 4: запускаем анимацию для первой карточки (выезд справа налево?)
            // По сути она должна приехать с -33% до 0
            if (newCards[0]) {
                newCards[0].style.transition = 'transform 0.5s ease, opacity 0.5s ease';
                newCards[0].style.transform = '';
                newCards[0].style.opacity = '1';
            }
            
            // Для остальных карточек ничего не делаем, они уже видны.
            
            lastReviews = newReviews;
        }, 500);
        
    } else {
        renderLatestReviews(newReviews);
        lastReviews = newReviews;
    }
}

// --- Рендер трёх последних отзывов ---
function renderLatestReviews(reviews) {
    if (!latestGrid) return;
    if (reviews.length === 0) {
        latestGrid.innerHTML = '<div style="color:var(--text-muted); text-align:center;">Пока нет отзывов.</div>';
        return;
    }
    
    let html = '';
    for (const r of reviews) {
        reviewCache[r.id] = r;
        const avatarHtml = r.userAvatarUrl
            ? `<img src="${r.userAvatarUrl}" alt="avatar" style="width:48px; height:48px; border-radius:50%; object-fit:cover;">`
            : `<div class="review-avatar">${r.userName ? r.userName.charAt(0).toUpperCase() : '?'}</div>`;

        const isLong = r.text.length > REVIEW_MAX_LENGTH;
        const displayText = isLong ? r.text.slice(0, REVIEW_MAX_LENGTH) + '\u2026' : r.text;
        const readMore = isLong
            ? `<button class="rv-read-more" data-id="${r.id}" style="background:none;border:none;color:var(--accent-color);font-size:0.85rem;cursor:pointer;padding:0;margin-top:6px;text-decoration:underline;font-family:inherit;display:block;">читать далее</button>`
            : '';

        html += `
            <div class="review-card">
                <div class="review-meta">
                    ${avatarHtml}
                    <div class="review-author">${r.userName}</div>
                </div>
                <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
                <p class="review-text">${displayText}</p>
                ${readMore}
            </div>
        `;
    }
    latestGrid.innerHTML = html;
    
    // Добавляем обработчики для кнопок "читать далее"
    latestGrid.querySelectorAll('.rv-read-more').forEach(btn => {
        btn.addEventListener('click', e => openFullPopup(reviewCache[e.target.dataset.id]));
    });
}

// --- Счётчик символов в форме отзыва ---
document.getElementById('review-text')?.addEventListener('input', e => {
    const counter = document.getElementById('review-char-count');
    if (counter) counter.textContent = e.target.value.length;
});

// --- Обработчик отправки отзыва ---
document.getElementById('write-review-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!currentUser) {
        showNotification('Необходимо войти', 'error');
        openModal(loginModal);
        return;
    }
    const ratingInput = document.querySelector('input[name="rating"]:checked');
    if (!ratingInput) { 
        showNotification('Поставьте оценку', 'error');
        return; 
    }
    const rating = parseInt(ratingInput.value);
    const text = document.getElementById('review-text').value.trim();
    if (!text) {
        showNotification('Напишите текст отзыва', 'error');
        return;
    }

    const submitBtn = e.target.querySelector('button[type="submit"]');
    submitBtn.classList.add('loading');
    submitBtn.disabled = true;

    try {
        // Проверка дублей
        const existingQ = query(collection(db, 'reviews'), where('userId', '==', currentUser.uid));
        const existingSnap = await getDocs(existingQ);
        if (!existingSnap.empty) {
            showNotification('Вы уже оставили отзыв. Его можно отредактировать на странице отзывов.', 'error', 6000);
            return;
        }

        const userDoc = await getDoc(doc(db, 'users', currentUser.uid));
        const userAvatarUrl = userDoc.exists() ? userDoc.data().avatarUrl : null;

        await addDoc(collection(db, 'reviews'), {
            userName: currentUserName || currentUser.email.split('@')[0],
            userEmail: currentUser.email,
            userId: currentUser.uid,
            userAvatarUrl: userAvatarUrl,
            rating: rating,
            text: text,
            date: serverTimestamp()
        });
        showNotification('Отзыв добавлен, спасибо!', 'success');
        document.getElementById('write-review-form').reset();
        document.querySelectorAll('input[name="rating"]').forEach(r => r.checked = false);
        closeAllModals();
    } catch (error) {
        console.error('Error adding review:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
});

// --- Регистрация ---
document.getElementById('register-form-step1').addEventListener('submit', async (e) => {
    e.preventDefault();
    const name = document.getElementById('register-name').value.trim();
    const email = document.getElementById('register-email').value.trim();
    const password = document.getElementById('register-password').value;
    const confirm = document.getElementById('register-confirm').value;

    if (password !== confirm) {
        showNotification('Пароли не совпадают', 'error');
        return;
    }

    try {
        const userCredential = await createUserWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        await sendEmailVerification(user);
        showNotification('Регистрация успешна! Письмо с подтверждением отправлено.', 'success');

        await setDoc(doc(db, 'users', user.uid), {
            name: name,
            email: email,
            createdAt: serverTimestamp()
        });

        closeAllModals();
    } catch (error) {
        console.error('Registration error:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    }
});

// --- Вход ---
document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
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
    } catch (error) {
        console.error('Login error:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    }
});

// --- Забыли пароль ---
forgotPasswordBtn.addEventListener('click', () => {
    const email = prompt('Введите ваш email для сброса пароля:');
    if (email) {
        sendPasswordResetEmail(auth, email)
            .then(() => showNotification('Письмо для сброса пароля отправлено!', 'success'))
            .catch((error) => showNotification('Ошибка: ' + error.message, 'error'));
    }
});

// --- Кнопка "Войти" ---
loginBtn.addEventListener('click', () => openModal(loginModal));

// --- Отслеживание аутентификации ---
onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        try {
            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                currentUserName = data.name;
                currentUserAvatar = data.avatarUrl || null;
            } else {
                currentUserName = user.email.split('@')[0];
                await setDoc(docRef, {
                    name: currentUserName,
                    email: user.email,
                    createdAt: serverTimestamp()
                });
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            currentUserName = user.email.split('@')[0];
        }

        animateLoginTransition(loginBtn, userAvatarContainer, userAvatarImg);
        loginBtn.style.display = 'none';

        if (currentUserAvatar) {
            userAvatarImg.src = currentUserAvatar;
        } else {
            userAvatarImg.src = getPlaceholderDataURL(currentUserName);
        }
    } else {
        currentUser = null;
        currentUserName = '';
        animateLogoutTransition(loginBtn, userAvatarContainer);
    }
});

// --- Управление модалками ---
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
    modalOverlay.style.display = 'none';
}

function openModal(modal) {
    closeAllModals();
    modalOverlay.style.display = 'flex';
    modal.classList.add('show');
}

feedbackBubble.addEventListener('click', () => {
    if (!currentUser) openModal(loginModal);
    else openModal(writeReviewModal);
});

closeButtons.forEach(btn => btn.addEventListener('click', closeAllModals));
modalOverlay.addEventListener('click', closeAllModals);

document.getElementById('switch-to-register').addEventListener('click', () => {
    closeAllModals();
    openModal(registerModal);
});

// --- Обработчики меню аватарки ---
userAvatarImg.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdownMenu(!dropdownMenu.classList.contains('show'));
});

document.addEventListener('click', (e) => {
    if (!userAvatarContainer.contains(e.target)) {
        dropdownMenu.classList.remove('show');
    }
});

dropdownLogout.addEventListener('click', async () => {
    try {
        toggleDropdownMenu(false);
        dropdownMenu.classList.remove('show');
        await signOut(auth);
        showNotification('Вы вышли', 'info');
    } catch (error) {
        showNotification('Ошибка: ' + error.message, 'error');
    }
});

// --- Настройки ---
const settingsModal   = document.getElementById('settings-modal');
const settingsMenuItem = document.getElementById('settings-menu-item');

settingsMenuItem?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDropdownMenu(false);
    openModal(settingsModal);
});

document.getElementById('close-settings')?.addEventListener('click', closeAllModals);

document.getElementById('theme-dark')?.addEventListener('click', () => {
    document.body.classList.remove('theme-light');
    localStorage.setItem('vibe-theme', 'dark');
    document.getElementById('theme-dark').classList.add('active');
    document.getElementById('theme-light').classList.remove('active');
});

document.getElementById('theme-light')?.addEventListener('click', () => {
    document.body.classList.add('theme-light');
    localStorage.setItem('vibe-theme', 'light');
    document.getElementById('theme-light').classList.add('active');
    document.getElementById('theme-dark').classList.remove('active');
});

document.getElementById('particle-count')?.addEventListener('change', e => {
    const count = parseInt(e.target.value);
    const val = JSON.stringify({ count });
    localStorage.setItem('vibe-particle-setting', val);
    window.dispatchEvent(new StorageEvent('storage', { key: 'vibe-particle-setting', newValue: val }));
});

// Применяем сохранённую тему при загрузке
(function loadSettings() {
    const theme = localStorage.getItem('vibe-theme') || 'dark';
    document.body.classList.toggle('theme-light', theme === 'light');
    document.getElementById('theme-dark')?.classList.toggle('active', theme !== 'light');
    document.getElementById('theme-light')?.classList.toggle('active', theme === 'light');
    const ps = localStorage.getItem('vibe-particle-setting');
    if (ps) {
        try { document.getElementById('particle-count').value = JSON.parse(ps).count; } catch {}
    }
}());

// --- Анимация при загрузке ---
window.addEventListener('load', () => {
    const subtitleEl = document.getElementById('main-subtitle');
    if (subtitleEl) {
        const originalText = subtitleEl.textContent;
        typeWriter(subtitleEl, originalText, 30);
    }
    const core = document.getElementById('vibe-core');
    if (core) {
        core.style.animation = 'orb-breathe 4s ease-in-out infinite';
    }
    
    // Запускаем real-time подписку на отзывы
    subscribeToReviews();
});