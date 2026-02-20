import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { 
    getAuth, 
    signOut,
    onAuthStateChanged 
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { 
    getFirestore, 
    doc,
    getDoc,
    updateDoc,
    collection,
    getDocs,
    query,
    where,
    writeBatch,
    Timestamp
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

// Ваш API-ключ ImgBB
const IMGBB_API_KEY = '4f54b5702a59e82eef094194d0fc8936';

// DOM элементы
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

let isAdmin = false;
let allUsers = [];
let currentUser = null;
let currentUserData = null;
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

// --- Загрузка на ImgBB с уникальным именем файла ---
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

// --- Генерация заглушки (canvas с буквой) ---
function getPlaceholderDataURL(userName) {
    const canvas = document.createElement('canvas');
    canvas.width = 40;
    canvas.height = 40;
    const ctx = canvas.getContext('2d');
    ctx.fillStyle = 'var(--accent-color)';
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

// --- Обновление аватарки в шапке (без моргания) ---
function updateHeaderAvatar(avatarUrl, userName) {
    if (!userAvatarContainer) return;
    userAvatarContainer.style.display = 'inline-block';

    if (avatarUrl) {
        // Сначала показываем заглушку
        userAvatarImg.src = getPlaceholderDataURL(userName);
        // Фоново загружаем реальное изображение
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
    console.log('=== updateUserReviews called ===');
    console.log('Parameters:', { userId, newName, newAvatarUrl });
    try {
        const reviewsQuery = query(collection(db, 'reviews'), where('userId', '==', userId));
        const querySnapshot = await getDocs(reviewsQuery);
        console.log(`Query found ${querySnapshot.size} reviews`);
        
        if (querySnapshot.empty) {
            console.log('No reviews found for this user');
            return;
        }

        const batch = writeBatch(db);
        querySnapshot.forEach(docSnapshot => {
            const reviewRef = doc(db, 'reviews', docSnapshot.id);
            batch.update(reviewRef, {
                userName: newName,
                userAvatarUrl: newAvatarUrl || null
            });
        });
        
        await batch.commit();
        console.log('Batch commit successful');
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
        let newAvatarUrl = currentUserData.avatarUrl; // по умолчанию старая

        if (editAvatarInput.files.length > 0) {
            const file = editAvatarInput.files[0];
            if (file.size > 5 * 1024 * 1024) {
                showNotification('Файл слишком большой (макс. 5 МБ)', 'error');
                return;
            }
            showNotification('Загрузка аватарки...', 'info');
            newAvatarUrl = await uploadToImgBB(file, currentUser.uid);
            updateData.avatarUrl = newAvatarUrl;
        }

        // Обновляем документ пользователя
        await updateDoc(doc(db, 'users', currentUser.uid), updateData);

        console.log('User document updated, now updating reviews...');
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
                // Для поля "Действует до:" используем увеличенный символ бесконечности
                expiresDisplay = '<span class="infinity-symbol">∞</span>';
            } else if (subscription.expires) {
                const expiryDate = subscription.expires.toDate ? subscription.expires.toDate() : new Date(subscription.expires);
                expiresDisplay = expiryDate.toLocaleString();
            }

            let subscriptionHtml = '';
            if (subscription.plan === 'free') {
                subscriptionHtml = '<span class="subscription-badge" style="color: #aaa;">Free</span>';
            } else if (subscription.plan === 'basic') {
                subscriptionHtml = '<span class="subscription-badge" style="color: #00ff88;">Basic</span>';
            } else if (subscription.plan === 'pro') {
                subscriptionHtml = '<span class="subscription-badge" style="color: gold;">Pro</span>';
            } else if (subscription.plan === 'limitless') {
                subscriptionHtml = '<span class="subscription-badge" style="color: #ff66cc; border-color: #ff66cc;">✨ Limitless ✨</span>';
            } else {
                subscriptionHtml = '<span class="subscription-badge">Неизвестно</span>';
            }

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

// --- Админ-панель (без изменений) ---
function openAdminPanel() {
    if (!adminModalOverlay || !adminModal) {
        console.error('Admin modal elements not found');
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

// --- Аутентификация и управление меню ---
if (loginBtn) {
    loginBtn.addEventListener('click', () => window.location.href = 'index.html');
} else {
    console.error('loginBtn not found');
}

if (dropdownLogout) {
    dropdownLogout.addEventListener('click', async () => {
        try {
            await signOut(auth);
            showNotification('Вы вышли', 'info');
            window.location.href = 'index.html';
        } catch (error) {
            showNotification('Ошибка: ' + error.message, 'error');
        }
    });
}

// Открытие/закрытие меню при клике на аватарку
if (userAvatarImg) {
    userAvatarImg.addEventListener('click', (e) => {
        e.stopPropagation();
        dropdownMenu.classList.toggle('show');
    });
}

// Закрытие меню при клике вне его
document.addEventListener('click', (e) => {
    if (userAvatarContainer && !userAvatarContainer.contains(e.target)) {
        dropdownMenu.classList.remove('show');
    }
});

// --- Слушаем состояние аутентификации ---
onAuthStateChanged(auth, async (user) => {
    currentUser = user;
    if (user) {
        // Скрываем кнопку входа, показываем аватарку
        if (loginBtn) loginBtn.style.display = 'none';
        if (userAvatarContainer) userAvatarContainer.style.display = 'inline-block';

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

        loadProfile(user);
    } else {
        currentUser = null;
        currentUserName = '';
        if (loginBtn) loginBtn.style.display = 'block';
        if (userAvatarContainer) userAvatarContainer.style.display = 'none';
        profileContainer.innerHTML = '<div style="text-align: center; color: var(--text-dim);">Пожалуйста, войдите в систему</div>';
    }
});