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
    doc,
    getDoc,
    updateDoc,
    collection,
    getDocs,
    query,
    where,
    writeBatch,
    Timestamp,
    setDoc,
    serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// Ваш API-ключ ImgBB
const IMGBB_API_KEY = '4f54b5702a59e82eef094194d0fc8936';

// DOM элементы
const feedbackBubble = document.getElementById('feedback-bubble');
const loginBtn = document.getElementById('login-btn');
const notificationContainer = document.getElementById('notification-container');
const profileContainer = document.getElementById('profile-container');

// Элементы аватарки и меню
const userAvatarContainer = document.getElementById('user-avatar-container');
const userAvatarImg = document.getElementById('user-avatar-img');
const dropdownMenu = document.getElementById('dropdown-menu');
const dropdownLogout = document.getElementById('dropdown-logout');

// Элементы админ-панели
const adminModalOverlay = document.getElementById('admin-modal-overlay');
const adminModal = document.getElementById('admin-modal');
const closeAdminModalBtn = document.getElementById('close-admin-modal');
const adminSearch = document.getElementById('admin-search');
const adminUsersList = document.getElementById('admin-users-list');

// Элементы редактора профиля
const editProfileOverlay = document.getElementById('edit-profile-overlay');
const editProfileModal = document.getElementById('edit-profile-modal');
const closeEditProfileBtn = document.getElementById('close-edit-profile');
const editProfileForm = document.getElementById('edit-profile-form');
const editNameInput = document.getElementById('edit-name');
const editAvatarInput = document.getElementById('edit-avatar');
const avatarImg = document.getElementById('avatar-img');
const avatarPlaceholder = document.getElementById('avatar-placeholder');

// Модалки
const modalOverlay = document.getElementById('modal-overlay');
const loginModal = document.getElementById('login-modal');
const registerModal = document.getElementById('register-modal');
const settingsModal = document.getElementById('settings-modal');
const closeSettings = document.getElementById('close-settings');
const themeDark = document.getElementById('theme-dark');
const themeLight = document.getElementById('theme-light');
const particleCountSelect = document.getElementById('particle-count');
const settingsMenuItem = document.getElementById('settings-menu-item');

let isAdmin = false;
let allUsers = [];
let currentUser = null;
let currentUserData = null;
let currentUserName = '';
let currentUserAvatar = null;

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

// Обработчик для закрытия меню при клике вне (уже есть в firebase.js, но можно оставить)
document.addEventListener('click', (e) => {
    if (userAvatarContainer && !userAvatarContainer.contains(e.target) && dropdownMenu.classList.contains('show')) {
        toggleDropdownMenu(false);
    }
});

// --- Обработчик кнопки отзыва ---
feedbackBubble.addEventListener('click', () => {
    if (!currentUser) openModal(loginModal);
    else openModal(writeReviewModal);
});

// =====================================================================
// АВАТАР-КРОППЕР
// Показывает превью, позволяет двигать и зуммировать область кропа
// =====================================================================

let cropState = {
    file:    null,
    img:     null,
    scale:   1,
    offsetX: 0,
    offsetY: 0,
    dragging: false,
    dragStartX: 0,
    dragStartY: 0,
    dragOriginX: 0,
    dragOriginY: 0,
};

// Создаём DOM кроппера (вставляется один раз)
function createCropperUI() {
    if (document.getElementById('avatar-cropper-wrap')) return;

    const wrap = document.createElement('div');
    wrap.id = 'avatar-cropper-wrap';
    wrap.style.cssText = 'display:none; margin-bottom:14px;';

    wrap.innerHTML = `
        <div style="position:relative; width:200px; height:200px; border-radius:50%;
             overflow:hidden; border:2px solid var(--border-accent);
             background:#111; cursor:grab; user-select:none; touch-action:none;
             margin: 0 auto 12px;" id="crop-viewport">
            <canvas id="crop-canvas" width="200" height="200"
                style="display:block; width:200px; height:200px;"></canvas>
            <div style="position:absolute;inset:0;border-radius:50%;
                box-shadow:0 0 0 9999px rgba(0,0,0,0.55);pointer-events:none;"></div>
        </div>
        <div style="display:flex; align-items:center; gap:10px; justify-content:center; margin-bottom:4px;">
            <span style="font-size:0.78rem; color:var(--text-muted);">🔍</span>
            <input type="range" id="crop-zoom" min="0.5" max="4" step="0.01" value="1"
                style="flex:1; max-width:160px; accent-color:var(--accent-color); cursor:pointer;
                       background:none; border:none; padding:0;">
            <span style="font-size:0.78rem; color:var(--text-muted);" id="crop-zoom-label">100%</span>
        </div>
        <div style="text-align:center; font-size:0.72rem; color:var(--text-muted);">
            Перетащи фото, чтобы выбрать область
        </div>
    `;

    // Вставляем перед полем выбора файла
    const fileInput = document.getElementById('edit-avatar');
    if (fileInput) fileInput.parentNode.insertBefore(wrap, fileInput.nextSibling);

    initCropEvents();
}

function initCropEvents() {
    const viewport = document.getElementById('crop-viewport');
    const zoomSlider = document.getElementById('crop-zoom');
    if (!viewport || !zoomSlider) return;

    // Зум слайдером
    zoomSlider.addEventListener('input', () => {
        cropState.scale = parseFloat(zoomSlider.value);
        document.getElementById('crop-zoom-label').textContent =
            Math.round(cropState.scale * 100) + '%';
        drawCrop();
    });

    // Зум колёсиком
    viewport.addEventListener('wheel', e => {
        e.preventDefault();
        cropState.scale = Math.min(4, Math.max(0.5,
            cropState.scale - e.deltaY * 0.001
        ));
        zoomSlider.value = cropState.scale;
        document.getElementById('crop-zoom-label').textContent =
            Math.round(cropState.scale * 100) + '%';
        drawCrop();
    }, { passive: false });

    // Мышь
    viewport.addEventListener('mousedown', e => {
        cropState.dragging   = true;
        cropState.dragStartX = e.clientX;
        cropState.dragStartY = e.clientY;
        cropState.dragOriginX = cropState.offsetX;
        cropState.dragOriginY = cropState.offsetY;
        viewport.style.cursor = 'grabbing';
    });
    document.addEventListener('mousemove', e => {
        if (!cropState.dragging) return;
        cropState.offsetX = cropState.dragOriginX + (e.clientX - cropState.dragStartX);
        cropState.offsetY = cropState.dragOriginY + (e.clientY - cropState.dragStartY);
        drawCrop();
    });
    document.addEventListener('mouseup', () => {
        cropState.dragging = false;
        if (viewport) viewport.style.cursor = 'grab';
    });

    // Touch
    viewport.addEventListener('touchstart', e => {
        if (e.touches.length === 1) {
            cropState.dragging   = true;
            cropState.dragStartX = e.touches[0].clientX;
            cropState.dragStartY = e.touches[0].clientY;
            cropState.dragOriginX = cropState.offsetX;
            cropState.dragOriginY = cropState.offsetY;
        }
    });
    viewport.addEventListener('touchmove', e => {
        if (!cropState.dragging || e.touches.length !== 1) return;
        e.preventDefault();
        cropState.offsetX = cropState.dragOriginX + (e.touches[0].clientX - cropState.dragStartX);
        cropState.offsetY = cropState.dragOriginY + (e.touches[0].clientY - cropState.dragStartY);
        drawCrop();
    }, { passive: false });
    viewport.addEventListener('touchend', () => { cropState.dragging = false; });
}

function drawCrop() {
    const canvas = document.getElementById('crop-canvas');
    if (!canvas || !cropState.img) return;
    const ctx = canvas.getContext('2d');
    const size = 200;

    ctx.clearRect(0, 0, size, size);

    const img = cropState.img;
    const scale = cropState.scale;

    // Рисуем изображение по центру с учётом смещения и масштаба
    const drawW = img.naturalWidth  * scale;
    const drawH = img.naturalHeight * scale;
    const x = size / 2 - drawW / 2 + cropState.offsetX;
    const y = size / 2 - drawH / 2 + cropState.offsetY;

    ctx.drawImage(img, x, y, drawW, drawH);
}

function loadImageToCropper(file) {
    cropState.file    = file;
    cropState.scale   = 1;
    cropState.offsetX = 0;
    cropState.offsetY = 0;

    const reader = new FileReader();
    reader.onload = ev => {
        const img = new Image();
        img.onload = () => {
            cropState.img = img;

            // Авто-масштаб чтобы заполнить круг
            const size = 200;
            const fitScale = Math.max(
                size / img.naturalWidth,
                size / img.naturalHeight
            );
            cropState.scale = fitScale;
            const zoomSlider = document.getElementById('crop-zoom');
            if (zoomSlider) {
                zoomSlider.value = Math.min(4, fitScale);
                document.getElementById('crop-zoom-label').textContent =
                    Math.round(cropState.scale * 100) + '%';
            }

            const wrap = document.getElementById('avatar-cropper-wrap');
            if (wrap) wrap.style.display = 'block';

            drawCrop();
        };
        img.src = ev.target.result;
    };
    reader.readAsDataURL(file);
}

// Экспортирует обрезанное изображение как Blob
function getCroppedBlob(mimeType = 'image/jpeg', quality = 0.9) {
    return new Promise(resolve => {
        const canvas = document.getElementById('crop-canvas');
        if (!canvas || !cropState.img) { resolve(null); return; }
        canvas.toBlob(resolve, mimeType, quality);
    });
}

// Слушаем выбор файла
document.getElementById('edit-avatar')?.addEventListener('change', e => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
        showNotification('Файл слишком большой (макс. 5 МБ)', 'error');
        return;
    }
    createCropperUI();
    loadImageToCropper(file);
});

// =====================================================================
// КОНЕЦ КРОППЕРА
// =====================================================================

// --- Загрузка на ImgBB ---
async function uploadToImgBB(file, userId) {
    const timestamp = Date.now();
    const safeFileName = file.name.replace(/[^a-zA-Z0-9.]/g, '_');
    const newFileName = `${userId}_${timestamp}_${safeFileName}`;
    const newFile = new File([file], newFileName, { type: file.type });

    const formData = new FormData();
    formData.append('image', newFile);

    const response = await fetch(`https://api.imgbb.com/1/upload?key=${IMGBB_API_KEY}`, {
        method: 'POST',
        body: formData
    });

    const data = await response.json();
    if (!data.success) {
        throw new Error(data.error?.message || 'Ошибка загрузки на ImgBB');
    }
    return data.data.url;
}

// --- Обновление аватарки в шапке (без моргания) ---
function updateHeaderAvatar(avatarUrl, userName) {
    if (!userAvatarContainer) return;
    userAvatarContainer.style.display = 'inline-block';

    if (avatarUrl) {
        userAvatarImg.src = getPlaceholderDataURL(userName);
        const img = new Image();
        img.onload = () => {
            userAvatarImg.src = avatarUrl;
        };
        img.onerror = () => {
            console.warn('Failed to load avatar, keeping placeholder');
        };
        img.src = avatarUrl;
    } else {
        userAvatarImg.src = getPlaceholderDataURL(userName);
    }
}

// --- Обновление всех отзывов пользователя ---
async function updateUserReviews(userId, newName, newAvatarUrl) {
    try {
        const reviewsQuery = query(collection(db, 'reviews'), where('userId', '==', userId));
        const querySnapshot = await getDocs(reviewsQuery);
        if (querySnapshot.empty) return;

        const batch = writeBatch(db);
        querySnapshot.forEach(docSnapshot => {
            const reviewRef = doc(db, 'reviews', docSnapshot.id);
            batch.update(reviewRef, {
                userName: newName,
                userAvatarUrl: newAvatarUrl || null
            });
        });
        await batch.commit();
        showNotification(`Обновлено ${querySnapshot.size} отзывов`, 'success');
    } catch (error) {
        console.error('ERROR in updateUserReviews:', error);
        showNotification('Ошибка при обновлении отзывов: ' + error.message, 'error');
    }
}

// --- Открытие редактора профиля ---
function openEditProfile() {
    if (!currentUserData) return;
    editNameInput.value = currentUserData.name || '';
    if (currentUserData.avatarUrl) {
        avatarImg.src = currentUserData.avatarUrl;
        avatarImg.style.display = 'block';
        avatarPlaceholder.style.display = 'none';
    } else {
        avatarImg.style.display = 'none';
        avatarPlaceholder.style.display = 'flex';
        avatarPlaceholder.textContent = currentUserData.name ? currentUserData.name.charAt(0).toUpperCase() : '?';
    }
    editProfileOverlay.style.display = 'flex';
    editProfileModal.style.display = 'block';
    editProfileModal.classList.add('show');
}

function closeEditProfile() {
    editProfileOverlay.style.display = 'none';
    editProfileModal.style.display = 'none';
    editProfileModal.classList.remove('show');
    // Сброс кроппера
    cropState.img = null;
    cropState.file = null;
    const wrap = document.getElementById('avatar-cropper-wrap');
    if (wrap) wrap.style.display = 'none';
    const canvas = document.getElementById('crop-canvas');
    if (canvas) canvas.getContext('2d').clearRect(0, 0, 200, 200);
}

closeEditProfileBtn?.addEventListener('click', closeEditProfile);
editProfileOverlay?.addEventListener('click', closeEditProfile);

// --- Обработка формы редактирования ---
editProfileForm?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const newName = editNameInput.value.trim();
    if (!newName) {
        showNotification('Имя не может быть пустым', 'error');
        return;
    }

    try {
        const updateData = { name: newName };
        let newAvatarUrl = currentUserData.avatarUrl;

        if (editAvatarInput.files.length > 0) {
            const file = editAvatarInput.files[0];
            if (file.size > 5 * 1024 * 1024) {
                showNotification('Файл слишком большой (макс. 5 МБ)', 'error');
                return;
            }
            showNotification('Загрузка аватарки...', 'info');

            // Если кроппер был использован — берём обрезанный blob,
            // иначе загружаем оригинал
            let uploadFile = file;
            if (cropState.img) {
                const blob = await getCroppedBlob('image/jpeg', 0.9);
                if (blob) {
                    uploadFile = new File([blob], file.name.replace(/\.[^.]+$/, '.jpg'), { type: 'image/jpeg' });
                }
            }

            newAvatarUrl = await uploadToImgBB(uploadFile, currentUser.uid);
            updateData.avatarUrl = newAvatarUrl;
        }

        await updateDoc(doc(db, 'users', currentUser.uid), updateData);
        await updateUserReviews(currentUser.uid, newName, newAvatarUrl);
        showNotification('Профиль обновлён', 'success');
        closeEditProfile();
        loadProfile(currentUser);
    } catch (error) {
        console.error('Error updating profile:', error);
        showNotification('Ошибка: ' + error.message, 'error');
    }
});

// --- Проверка истечения подписки ---
async function checkSubscriptionExpiry(user) {
    if (!user) return;
    try {
        const userRef = doc(db, 'users', user.uid);
        const userSnap = await getDoc(userRef);
        if (userSnap.exists()) {
            const data = userSnap.data();
            if (data.subscription && data.subscription.expires && data.subscription.plan !== 'free') {
                const expiryDate = data.subscription.expires.toDate ? data.subscription.expires.toDate() : new Date(data.subscription.expires);
                const now = new Date();
                if (expiryDate < now) {
                    await updateDoc(userRef, {
                        'subscription.plan': 'free',
                        'subscription.expires': null
                    });
                    showNotification('Срок подписки истёк, она сброшена на Free', 'info');
                    loadProfile(user);
                }
            }
        }
    } catch (error) {
        console.error('Error checking subscription expiry:', error);
    }
}

// --- Skeleton для профиля ---
function showProfileSkeleton() {
    profileContainer.innerHTML = `
        <div style="display:flex;align-items:center;gap:24px;margin-bottom:30px;">
            <div class="skeleton-line" style="width:60px;height:60px;border-radius:50%;flex-shrink:0;"></div>
            <div style="flex:1;">
                <div class="skeleton-line" style="width:45%;height:16px;margin-bottom:10px;"></div>
                <div class="skeleton-line" style="width:60%;height:12px;"></div>
            </div>
        </div>
        <div class="skeleton-line" style="height:44px;border-radius:12px;margin-bottom:10px;"></div>
        <div class="skeleton-line" style="height:44px;border-radius:12px;margin-bottom:10px;"></div>
        <div class="skeleton-line" style="height:44px;border-radius:12px;margin-bottom:24px;"></div>
        <div style="display:flex;gap:15px;justify-content:center;">
            <div class="skeleton-line" style="width:130px;height:40px;border-radius:20px;"></div>
            <div class="skeleton-line" style="width:160px;height:40px;border-radius:20px;"></div>
        </div>
    `;
}

// --- Загрузка профиля ---
async function loadProfile(user) {
    if (!user) {
        profileContainer.innerHTML = '<div style="text-align: center; color: var(--text-dim);">Пожалуйста, войдите в систему</div>';
        return;
    }

    try {
        const userDocRef = doc(db, 'users', user.uid);
        const userDoc = await getDoc(userDocRef);

        if (userDoc.exists()) {
            const userData = userDoc.data();
            currentUserData = userData;
            isAdmin = userData.role === 'admin';

            await checkSubscriptionExpiry(user);

            const updatedDoc = await getDoc(userDocRef);
            const updatedData = updatedDoc.data();
            const subscription = updatedData.subscription || { plan: 'free' };

            let expiresDisplay = 'бессрочно';
            if (subscription.plan === 'limitless') {
                expiresDisplay = '<span class="infinity-symbol">∞</span>';
            } else if (subscription.expires) {
                const expiryDate = subscription.expires.toDate ? subscription.expires.toDate() : new Date(subscription.expires);
                expiresDisplay = expiryDate.toLocaleString();
            }

            let subscriptionHtml = '';
            if (subscription.plan === 'free') subscriptionHtml = '<span class="subscription-badge" style="color: #aaa;">Free</span>';
            else if (subscription.plan === 'basic') subscriptionHtml = '<span class="subscription-badge" style="color: #00ff88;">Basic</span>';
            else if (subscription.plan === 'pro') subscriptionHtml = '<span class="subscription-badge" style="color: gold;">Pro</span>';
            else if (subscription.plan === 'limitless') subscriptionHtml = '<span class="subscription-badge" style="color: #ff66cc; border-color: #ff66cc;">✨ Limitless ✨</span>';
            else subscriptionHtml = '<span class="subscription-badge">Неизвестно</span>';

            let avatarHtml;
            if (updatedData.avatarUrl) {
                avatarHtml = `<img src="${updatedData.avatarUrl}" style="width:60px; height:60px; border-radius:50%; object-fit:cover; border:2px solid var(--accent);">`;
            } else {
                avatarHtml = `<div style="width:60px; height:60px; border-radius:50%; background:linear-gradient(135deg,var(--accent),var(--accent-2)); display:flex; align-items:center; justify-content:center; font-size:1.8rem; color:#fff;">${updatedData.name ? updatedData.name.charAt(0).toUpperCase() : '?'}</div>`;
            }

            let adminButtonHtml = '';
            if (isAdmin) {
                adminButtonHtml = '<button id="admin-panel-btn" class="reviews-btn" style="margin-left: 10px;">👑 Админ-панель</button>';
            }

            profileContainer.innerHTML = `
                <div style="display:flex; align-items:center; gap:24px; margin-bottom:30px;">
                    ${avatarHtml}
                    <div>
                        <h2 style="color:var(--accent); margin-bottom:5px;">${updatedData.name || 'Пользователь'}</h2>
                        <p style="color:var(--text-secondary);">${user.email}</p>
                    </div>
                </div>
                <div class="profile-field">
                    <span class="profile-label">UID:</span>
                    <span class="profile-value" style="font-size:0.8rem;">${user.uid}</span>
                </div>
                <div class="profile-field profile-field-subscription">
                    <span class="profile-label">Подписка:</span>
                    <span class="profile-value">${subscriptionHtml}</span>
                </div>
                <div class="profile-field">
                    <span class="profile-label">Действует до:</span>
                    <span class="profile-value">${expiresDisplay}</span>
                </div>
                <div style="margin-top:30px; display:flex; gap:15px; justify-content:center;">
                    <button id="edit-profile-btn" class="reviews-btn">Редактировать</button>
                    <button id="manage-subscription-btn" class="reviews-btn">Управление подпиской</button>
                    ${adminButtonHtml}
                </div>
            `;

            document.getElementById('edit-profile-btn').addEventListener('click', openEditProfile);
            document.getElementById('manage-subscription-btn').addEventListener('click', () => {
                window.location.href = 'pricing.html';
            });

            if (isAdmin) {
                document.getElementById('admin-panel-btn').addEventListener('click', openAdminPanel);
            }
        } else {
            profileContainer.innerHTML = '<div style="text-align: center; color: var(--text-dim);">Данные пользователя не найдены</div>';
        }
    } catch (error) {
        console.error('Error loading profile:', error);
        showNotification('Ошибка загрузки профиля', 'error');
    }
}

// --- Админ-панель ---
function openAdminPanel() {
    if (!adminModalOverlay || !adminModal) {
        showNotification('Ошибка: элементы админ-панели не найдены', 'error');
        return;
    }
    adminModalOverlay.style.display = 'flex';
    adminModal.style.display = 'block';
    adminModal.classList.add('show');
    loadAllUsers();
}

function closeAdminPanel() {
    adminModalOverlay.style.display = 'none';
    adminModal.style.display = 'none';
    adminModal.classList.remove('show');
}

closeAdminModalBtn?.addEventListener('click', closeAdminPanel);
adminModalOverlay?.addEventListener('click', closeAdminPanel);

if (adminSearch) {
    adminSearch.addEventListener('input', (e) => {
        const searchTerm = e.target.value.toLowerCase();
        renderUsersList(allUsers.filter(u => u.email?.toLowerCase().includes(searchTerm)));
    });
}

async function loadAllUsers() {
    try {
        const querySnapshot = await getDocs(collection(db, 'users'));
        allUsers = [];
        querySnapshot.forEach(doc => {
            allUsers.push({ id: doc.id, ...doc.data() });
        });
        renderUsersList(allUsers);
    } catch (error) {
        console.error('Error in loadAllUsers:', error);
        showNotification('Ошибка загрузки пользователей', 'error');
    }
}

function renderUsersList(users) {
    if (!adminUsersList) return;
    if (users.length === 0) {
        adminUsersList.innerHTML = '<p style="color: var(--text-dim); text-align: center;">Пользователи не найдены</p>';
        return;
    }

    let html = '';
    users.forEach(user => {
        const sub = user.subscription || { plan: 'free' };
        const currentPlan = sub.plan;
        let expiresValue = '';
        if (sub.expires) {
            let date;
            if (sub.expires.toDate) date = sub.expires.toDate();
            else date = new Date(sub.expires);
            if (!isNaN(date)) {
                const year = date.getFullYear();
                const month = String(date.getMonth() + 1).padStart(2, '0');
                const day = String(date.getDate()).padStart(2, '0');
                const hours = String(date.getHours()).padStart(2, '0');
                const minutes = String(date.getMinutes()).padStart(2, '0');
                expiresValue = `${year}-${month}-${day}T${hours}:${minutes}`;
            }
        }

        html += `
            <div class="admin-user-card" style="border:1px solid var(--glass-border); border-radius:16px; padding:15px; margin-bottom:15px;">
                <div style="display:flex; justify-content:space-between; flex-wrap:wrap; gap:10px;">
                    <div>
                        <div><strong>Email:</strong> ${user.email || '—'}</div>
                        <div><strong>Имя:</strong> ${user.name || '—'}</div>
                        <div><strong>Текущая подписка:</strong> ${currentPlan}</div>
                    </div>
                    <div style="min-width:250px;">
                        <select id="plan-${user.id}" class="admin-plan-select" style="width:100%; margin-bottom:5px;">
                            <option value="free" ${currentPlan==='free'?'selected':''}>Free</option>
                            <option value="basic" ${currentPlan==='basic'?'selected':''}>Basic</option>
                            <option value="pro" ${currentPlan==='pro'?'selected':''}>Pro</option>
                            <option value="limitless" ${currentPlan==='limitless'?'selected':''}>Limitless</option>
                        </select>
                        <input type="datetime-local" id="expires-${user.id}" class="admin-expires-input" value="${expiresValue}" style="width:100%; margin-bottom:5px;" ${currentPlan==='limitless'?'disabled':''}>
                        <button class="admin-save-btn" data-userid="${user.id}" style="width:100%;">Сохранить</button>
                    </div>
                </div>
            </div>
        `;
    });

    adminUsersList.innerHTML = html;

    document.querySelectorAll('.admin-plan-select').forEach(select => {
        select.addEventListener('change', (e) => {
            const userId = e.target.id.replace('plan-', '');
            const expiresInput = document.getElementById(`expires-${userId}`);
            if (e.target.value === 'limitless') {
                expiresInput.disabled = true;
                expiresInput.value = '';
            } else {
                expiresInput.disabled = false;
            }
        });
    });

    document.querySelectorAll('.admin-save-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const userId = e.target.dataset.userid;
            const planSelect = document.getElementById(`plan-${userId}`);
            const expiresInput = document.getElementById(`expires-${userId}`);
            const newPlan = planSelect.value;
            let newExpires = null;
            if (newPlan !== 'limitless' && expiresInput.value) {
                newExpires = new Date(expiresInput.value);
            }
            try {
                await updateDoc(doc(db, 'users', userId), {
                    subscription: { plan: newPlan, expires: newExpires }
                });
                showNotification(`Подписка обновлена на ${newPlan}`, 'success');
                loadAllUsers();
            } catch (error) {
                console.error('Error updating subscription:', error);
                showNotification('Ошибка: ' + error.message, 'error');
            }
        });
    });
}

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

// --- Слушаем состояние аутентификации ---
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        if (loginBtn) loginBtn.style.display = 'none';
        if (userAvatarContainer) {
            animateLoginTransition(loginBtn, userAvatarContainer, userAvatarImg);
        }

        try {
            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const data = docSnap.data();
                currentUserName = data.name || user.email.split('@')[0];
                currentUserAvatar = data.avatarUrl || null;
                updateHeaderAvatar(currentUserAvatar, currentUserName);
            } else {
                currentUserName = user.email.split('@')[0];
                await setDoc(docRef, {
                    name: currentUserName,
                    email: user.email,
                    createdAt: Timestamp.now()
                });
                updateHeaderAvatar(null, currentUserName);
            }
        } catch (error) {
            console.error('Error fetching user data:', error);
            currentUserName = user.email.split('@')[0];
            updateHeaderAvatar(null, currentUserName);
        }

        showProfileSkeleton();
        loadProfile(user);
    } else {
        currentUser = null;
        currentUserName = '';
        animateLogoutTransition(loginBtn, userAvatarContainer);
        profileContainer.innerHTML = '<div style="text-align: center; color: var(--text-dim); padding: 60px 0;">Войдите в аккаунт, чтобы посмотреть профиль</div>';
    }
});