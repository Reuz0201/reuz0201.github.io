import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { 
    getAuth, 
    createUserWithEmailAndPassword,
    signInWithEmailAndPassword,
    signOut,
    onAuthStateChanged,
    sendEmailVerification,
    sendPasswordResetEmail
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { 
    getFirestore, 
    collection,
    addDoc,
    getDocs,
    query,
    orderBy,
    doc,
    setDoc,
    getDoc,
    serverTimestamp 
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

const firebaseConfig = {
    apiKey: "AIzaSyB2h26sAkkhHwUJdx6eeVxz6fY9qVG8bZM",
    authDomain: "vibedb-71371.firebaseapp.com",
    projectId: "vibedb-71371",
    storageBucket: "vibedb-71371.firebasestorage.app",
    messagingSenderId: "893073137943",
    appId: "1:893073137943:web:a228669285bfa5c6485752",
    measurementId: "G-BP4CLBJB55"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM элементы
const reviewsBtn = document.getElementById('reviews-btn');
const feedbackBubble = document.getElementById('feedback-bubble');
const modalOverlay = document.getElementById('modal-overlay');
const reviewsModal = document.getElementById('reviews-modal');
const writeReviewModal = document.getElementById('write-review-modal');
const loginModal = document.getElementById('login-modal');
const registerModal = document.getElementById('register-modal');
const closeButtons = document.querySelectorAll('.modal-close');
const reviewsList = document.getElementById('reviews-list');
const latestGrid = document.getElementById('latest-reviews-grid');
const loginBtn = document.getElementById('login-btn');
const forgotPasswordBtn = document.getElementById('forgot-password-btn');
const notificationContainer = document.getElementById('notification-container');

// Новые элементы для аватарки и меню
const userAvatarContainer = document.getElementById('user-avatar-container');
const userAvatarImg = document.getElementById('user-avatar-img');
const dropdownMenu = document.getElementById('dropdown-menu');
const dropdownLogout = document.getElementById('dropdown-logout');

let currentUser = null;
let currentUserName = '';
let currentUserAvatar = null;

// --- Уведомления ---
function showNotification(message, type = 'info', duration = 4000) {
    if (!notificationContainer) return;
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notificationContainer.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => notification.remove(), 300);
    }, duration);
}

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

// --- Загрузка отзывов ---
async function loadReviews() {
    try {
        const q = query(collection(db, 'reviews'), orderBy('date', 'desc'));
        const querySnapshot = await getDocs(q);
        const reviews = [];
        querySnapshot.forEach((doc) => {
            reviews.push({ id: doc.id, ...doc.data() });
        });
        renderReviewsList(reviews);
        renderLatestReviews(reviews.slice(0, 3));
    } catch (error) {
        console.error('Ошибка загрузки отзывов:', error);
        showNotification('Ошибка загрузки отзывов', 'error');
    }
}

// --- Рендер всех отзывов в модалке ---
async function renderReviewsList(reviews) {
    if (reviews.length === 0) {
        reviewsList.innerHTML = '<p style="color:var(--text-muted); text-align:center;">Пока нет отзывов. Будьте первым!</p>';
        return;
    }
    let html = '';
    for (const r of reviews) {
        const date = r.date ? new Date(r.date.toDate()).toLocaleString() : 'только что';
        const avatarHtml = r.userAvatarUrl
            ? `<img src="${r.userAvatarUrl}" style="width:48px; height:48px; border-radius:50%; object-fit:cover;">`
            : `<div class="review-avatar">${r.userName ? r.userName.charAt(0).toUpperCase() : '?'}</div>`;
        html += `
            <div style="border-bottom:1px solid var(--border); padding:24px 0;">
                <div style="display:flex; gap:15px; align-items:center; margin-bottom:12px;">
                    ${avatarHtml}
                    <div>
                        <div style="font-weight:600; font-size:1.1rem;">${r.userName}</div>
                    </div>
                </div>
                <div style="color:#fbbf24; font-size:1rem; letter-spacing:2px; margin-bottom:12px;">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
                <p style="color:var(--text-secondary); font-size:1rem; line-height:1.6;">${r.text}</p>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:8px;">${date}</div>
            </div>
        `;
    }
    reviewsList.innerHTML = html;
}

// --- Рендер трёх последних отзывов на главной ---
async function renderLatestReviews(reviews) {
    if (reviews.length === 0) {
        latestGrid.innerHTML = '<div style="color:var(--text-muted); text-align:center;">Пока нет отзывов.</div>';
        return;
    }
    let html = '';
    for (const r of reviews) {
        const avatarHtml = r.userAvatarUrl
            ? `<img src="${r.userAvatarUrl}" alt="avatar" style="width:48px; height:48px; border-radius:50%; object-fit:cover;">`
            : `<div class="review-avatar">${r.userName ? r.userName.charAt(0).toUpperCase() : '?'}</div>`;
        html += `
            <div class="review-card">
                <div class="review-meta">
                    ${avatarHtml}
                    <div class="review-author">${r.userName}</div>
                </div>
                <div class="review-stars">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</div>
                <p class="review-text">${r.text}</p>
            </div>
        `;
    }
    latestGrid.innerHTML = html;
}

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

    try {
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
        loadReviews();
    } catch (error) {
        console.error('Error adding review:', error);
        showNotification('Ошибка: ' + error.message, 'error');
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
        await signInWithEmailAndPassword(auth, email, password);
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

        // Показываем аватарку, скрываем кнопку входа
        userAvatarContainer.style.display = 'inline-block';
        loginBtn.style.display = 'none';

        // Устанавливаем аватарку или заглушку
        if (currentUserAvatar) {
            userAvatarImg.src = currentUserAvatar;
        } else {
            // Генерация заглушки (первая буква имени в кружке)
            const canvas = document.createElement('canvas');
            canvas.width = 40;
            canvas.height = 40;
            const ctx = canvas.getContext('2d');
            ctx.fillStyle = '#00f2ff'; // цвет акцента
            ctx.beginPath();
            ctx.arc(20, 20, 20, 0, 2 * Math.PI);
            ctx.fill();
            ctx.fillStyle = '#fff';
            ctx.font = '20px Inter';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(currentUserName.charAt(0).toUpperCase(), 20, 20);
            userAvatarImg.src = canvas.toDataURL();
        }
    } else {
        currentUser = null;
        currentUserName = '';
        userAvatarContainer.style.display = 'none';
        loginBtn.style.display = 'block';
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

// --- Обработчики кнопок ---
reviewsBtn.addEventListener('click', () => {
    loadReviews();
    openModal(reviewsModal);
});

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
    dropdownMenu.classList.toggle('show');
});

document.addEventListener('click', (e) => {
    if (!userAvatarContainer.contains(e.target)) {
        dropdownMenu.classList.remove('show');
    }
});

dropdownLogout.addEventListener('click', async () => {
    try {
        await signOut(auth);
        showNotification('Вы вышли', 'info');
        dropdownMenu.classList.remove('show');
    } catch (error) {
        showNotification('Ошибка: ' + error.message, 'error');
    }
});

// --- Анимация при загрузке ---
window.addEventListener('load', () => {
    const titleEl = document.getElementById('main-title');
    const subtitleEl = document.getElementById('main-subtitle');
    
    // Анимируем подзаголовок
    if (subtitleEl) {
        const originalText = subtitleEl.textContent;
        typeWriter(subtitleEl, originalText, 30);
    }
    const core = document.getElementById('vibe-core');
    if (core) {
        core.style.animation = 'orb-breathe 4s ease-in-out infinite';
    }
    loadReviews();
});