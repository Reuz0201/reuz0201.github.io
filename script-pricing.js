import { auth, db, showNotification, getPlaceholderDataURL, toggleDropdownMenu, animateLoginTransition, animateLogoutTransition } from './firebase.js';
import { signOut, onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, sendEmailVerification, sendPasswordResetEmail } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { doc, getDoc, setDoc, serverTimestamp, collection, addDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// DOM элементы
const feedbackBubble = document.getElementById('feedback-bubble');
const writeReviewModal = document.getElementById('write-review-modal'); // <-- добавить
const loginBtn = document.getElementById('login-btn');
const userAvatarContainer = document.getElementById('user-avatar-container');
const userAvatarImg = document.getElementById('user-avatar-img');
const dropdownMenu = document.getElementById('dropdown-menu');
const dropdownLogout = document.getElementById('dropdown-logout');
const modalOverlay = document.getElementById('modal-overlay');
const loginModal = document.getElementById('login-modal');
const registerModal = document.getElementById('register-modal');
const settingsModal = document.getElementById('settings-modal');
const settingsMenuItem = document.getElementById('settings-menu-item');
const themeDark = document.getElementById('theme-dark');
const themeLight = document.getElementById('theme-light');
const particleCountSelect = document.getElementById('particle-count');
const closeSettings = document.getElementById('close-settings');

let currentUser = null;
let currentUserName = '';

// --- Управление модалками ---
function closeAllModals() {
    document.querySelectorAll('.modal').forEach(m => m.classList.remove('show'));
    if (modalOverlay) modalOverlay.style.display = 'none';
}

function openModal(modal) {
    closeAllModals();
    if (modalOverlay) modalOverlay.style.display = 'flex';
    modal.classList.add('show');
}

// --- Обработчики входа/регистрации ---
loginBtn.addEventListener('click', () => openModal(loginModal));

document.getElementById('switch-to-register')?.addEventListener('click', () => {
    closeAllModals();
    openModal(registerModal);
});

document.querySelectorAll('.modal-close').forEach(btn => btn.addEventListener('click', closeAllModals));
modalOverlay?.addEventListener('click', closeAllModals);

// --- Вход ---
document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        const userCredential = await signInWithEmailAndPassword(auth, email, password);
        const user = userCredential.user;
        if (!user.emailVerified) {
            await signOut(auth);
            showNotification('Email не подтверждён. Проверьте папку "Спам".', 'error', 8000);
            return;
        }
        showNotification('Вход выполнен', 'success');
        closeAllModals();
    } catch (error) {
        showNotification('Ошибка: ' + error.message, 'error');
    }
});

// --- Регистрация ---
document.getElementById('register-form-step1')?.addEventListener('submit', async (e) => {
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
        await setDoc(doc(db, 'users', user.uid), {
            name: name,
            email: email,
            createdAt: serverTimestamp()
        });
        await signOut(auth);
        showNotification('Регистрация успешна! Проверьте email для подтверждения.', 'info', 8000);
        closeAllModals();
    } catch (error) {
        showNotification('Ошибка: ' + error.message, 'error');
    }
});

// --- Забыли пароль ---
document.getElementById('forgot-password-btn')?.addEventListener('click', () => {
    const email = prompt('Введите ваш email для сброса пароля:');
    if (email) {
        sendPasswordResetEmail(auth, email)
            .then(() => showNotification('Письмо для сброса пароля отправлено!', 'success'))
            .catch((error) => showNotification('Ошибка: ' + error.message, 'error'));
    }
});

// --- Выход ---
dropdownLogout.addEventListener('click', async () => {
    try {
        await signOut(auth);
        showNotification('Вы вышли', 'info');
        toggleDropdownMenu(false);
    } catch (error) {
        showNotification('Ошибка: ' + error.message, 'error');
    }
});

// --- Аватарка и меню ---
userAvatarImg.addEventListener('click', (e) => {
    e.stopPropagation();
    toggleDropdownMenu(!dropdownMenu.classList.contains('show'));
});

// --- Отслеживание состояния аутентификации ---
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        if (!user.emailVerified) {
            await signOut(auth);
            showNotification('Email не подтверждён.', 'error', 8000);
            return;
        }

        try {
            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                currentUserName = data.name || user.email.split('@')[0];
                const avatarUrl = data.avatarUrl;
                if (avatarUrl) {
                    userAvatarImg.src = avatarUrl;
                } else {
                    userAvatarImg.src = getPlaceholderDataURL(currentUserName);
                }
            } else {
                currentUserName = user.email.split('@')[0];
                userAvatarImg.src = getPlaceholderDataURL(currentUserName);
                await setDoc(docRef, {
                    name: currentUserName,
                    email: user.email,
                    createdAt: serverTimestamp()
                });
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            currentUserName = user.email.split('@')[0];
            userAvatarImg.src = getPlaceholderDataURL(currentUserName);
        }

        animateLoginTransition(loginBtn, userAvatarContainer, userAvatarImg);
        loginBtn.style.display = 'none';
    } else {
        animateLogoutTransition(loginBtn, userAvatarContainer);
    }
});

// --- Обработчик кнопки отзыва ---
feedbackBubble.addEventListener('click', () => {
    if (!currentUser) openModal(loginModal);
    else openModal(writeReviewModal);
});

// --- Отправка отзыва ---
document.getElementById('write-review-form')?.addEventListener('submit', async (e) => {
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
            rating: parseInt(ratingInput.value),
            text,
            date: serverTimestamp()
        });
        showNotification('Спасибо за отзыв!', 'success');
        document.getElementById('write-review-form').reset();
        closeAllModals();
    } catch (error) {
        showNotification('Ошибка: ' + error.message, 'error');
    } finally {
        submitBtn.classList.remove('loading');
        submitBtn.disabled = false;
    }
});

// --- Настройки ---
function loadSettings() {
    const savedTheme = localStorage.getItem('vibe-theme') || 'dark';
    if (savedTheme === 'light') {
        document.body.classList.add('theme-light');
        themeDark?.classList.remove('active');
        themeLight?.classList.add('active');
    } else {
        document.body.classList.remove('theme-light');
        themeDark?.classList.add('active');
        themeLight?.classList.remove('active');
    }
    const savedParticles = localStorage.getItem('vibe-particle-setting');
    if (savedParticles) {
        try {
            const parsed = JSON.parse(savedParticles);
            particleCountSelect.value = parsed.count;
        } catch (e) {}
    }
}

settingsMenuItem?.addEventListener('click', (e) => {
    e.preventDefault();
    toggleDropdownMenu(false);
    openModal(settingsModal);
});

closeSettings?.addEventListener('click', closeAllModals);

themeDark?.addEventListener('click', () => {
    document.body.classList.remove('theme-light');
    localStorage.setItem('vibe-theme', 'dark');
    themeDark.classList.add('active');
    themeLight.classList.remove('active');
});

themeLight?.addEventListener('click', () => {
    document.body.classList.add('theme-light');
    localStorage.setItem('vibe-theme', 'light');
    themeLight.classList.add('active');
    themeDark.classList.remove('active');
});

particleCountSelect?.addEventListener('change', () => {
    const count = parseInt(particleCountSelect.value);
    localStorage.setItem('vibe-particle-setting', JSON.stringify({ count }));
    window.dispatchEvent(new StorageEvent('storage', {
        key: 'vibe-particle-setting',
        newValue: JSON.stringify({ count })
    }));
});

loadSettings();