import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-analytics.js";
import { 
    getAuth, 
    signOut,
    onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { 
    getFirestore, 
    doc,
    getDoc
} from "https://www.gstatic.com/firebasejs/12.9.0/firebase-firestore.js";

// Ваш конфиг Firebase
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
const analytics = getAnalytics(app);
const auth = getAuth(app);
const db = getFirestore(app);

// DOM элементы
const userMenu = document.getElementById('user-menu');
const userNameSpan = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');
const loginBtn = document.getElementById('login-btn');
const notificationContainer = document.getElementById('notification-container');

let currentUser = null;
let currentUserName = '';

// --- Функция показа уведомлений ---
function showNotification(message, type = 'info', duration = 4000) {
    if (!notificationContainer) return;
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notificationContainer.appendChild(notification);
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, duration);
}

// --- Аутентификация ---
loginBtn.addEventListener('click', () => {
    showNotification('Пожалуйста, войдите на главной странице', 'info');
    setTimeout(() => {
        window.location.href = 'index.html';
    }, 2000);
});

logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        showNotification('Вы вышли', 'info');
    } catch (error) {
        showNotification('Ошибка: ' + error.message, 'error');
    }
});

onAuthStateChanged(auth, async (user) => {
    if (user) {
        currentUser = user;
        try {
            const docRef = doc(db, 'users', user.uid);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                currentUserName = docSnap.data().name;
            } else {
                currentUserName = user.email.split('@')[0];
            }
        } catch (error) {
            console.error('Error fetching user name:', error);
            currentUserName = user.email.split('@')[0];
        }
        userMenu.style.display = 'flex';
        userNameSpan.textContent = currentUserName;
        loginBtn.style.display = 'none';
    } else {
        currentUser = null;
        currentUserName = '';
        userMenu.style.display = 'none';
        loginBtn.style.display = 'block';
    }
});