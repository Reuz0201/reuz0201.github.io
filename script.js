import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAnalytics } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-analytics.js";
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
const userMenu = document.getElementById('user-menu');
const userNameSpan = document.getElementById('user-name');
const logoutBtn = document.getElementById('logout-btn');
const loginBtn = document.getElementById('login-btn');
const forgotPasswordBtn = document.getElementById('forgot-password-btn');
const notificationContainer = document.getElementById('notification-container');

let currentUser = null;
let currentUserName = '';

// --- Функция показа уведомлений ---
function showNotification(message, type = 'info', duration = 4000) {
    const notification = document.createElement('div');
    notification.className = `notification ${type}`;
    notification.textContent = message;
    notificationContainer.appendChild(notification);

    // Удаляем через duration
    setTimeout(() => {
        notification.classList.add('fade-out');
        setTimeout(() => {
            notification.remove();
        }, 300);
    }, duration);
}

// --- Печать текста ---
const titleText = "Простота. Порядок. Интеллект.";
const subText = "Ваш персональный ассистент, созданный для помощи и облегчения жизни. Вайб - сила💪";
function typeWriter(element, text, speed, callback) {
    let i = 0;
    element.innerHTML = "";
    function type() {
        if (i < text.length) {
            element.innerHTML += text.charAt(i);
            i++;
            setTimeout(type, speed);
        } else if (callback) callback();
    }
    type();
}

// --- Канвас (частицы) ---
const canvas = document.getElementById('bg-canvas');
const ctx = canvas.getContext('2d');
let particles = [];
let mouse = { x: null, y: null };
let lastClick = { x: null, y: null, time: 0 };

window.addEventListener('mousemove', (e) => { mouse.x = e.clientX; mouse.y = e.clientY; });
window.addEventListener('click', (e) => {
    const ripple = document.createElement('div');
    ripple.className = 'ripple';
    ripple.style.left = `${e.clientX}px`;
    ripple.style.top = `${e.clientY}px`;
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 800);
    lastClick.x = e.clientX; lastClick.y = e.clientY; lastClick.time = Date.now();
});

function resize() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener('resize', resize);
resize();

class Particle {
    constructor() {
        this.baseX = Math.random() * canvas.width;
        this.baseY = Math.random() * canvas.height;
        this.x = this.baseX; this.y = this.baseY;
        this.speedX = (Math.random() - 0.5) * 0.4;
        this.speedY = (Math.random() - 0.5) * 0.4;
        this.size = 2;
    }
    update() {
        if (mouse.x) {
            this.x = this.baseX + (mouse.x - canvas.width/2) * 0.03;
            this.y = this.baseY + (mouse.y - canvas.height/2) * 0.03;
        }
        this.baseX += this.speedX;
        this.baseY += this.speedY;
        if (this.baseX > canvas.width || this.baseX < 0) this.speedX *= -1;
        if (this.baseY > canvas.height || this.baseY < 0) this.speedY *= -1;
    }
    draw() {
        ctx.fillStyle = 'rgba(0, 242, 255, 0.4)';
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
        ctx.fill();
    }
}

function initParticles() {
    particles = [];
    for (let i = 0; i < 75; i++) particles.push(new Particle());
}

function animate() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const now = Date.now();
    const clickElapsed = now - lastClick.time;
    for (let i = 0; i < particles.length; i++) {
        particles[i].update();
        particles[i].draw();
        for (let j = i + 1; j < particles.length; j++) {
            const dx = particles[i].x - particles[j].x;
            const dy = particles[i].y - particles[j].y;
            const d = Math.sqrt(dx*dx + dy*dy);
            if (d < 170) {
                let alpha = 0.3 * (1 - d/170);
                let lineWidth = 1;
                if (clickElapsed < 800 && lastClick.x !== null) {
                    const distToClick = Math.sqrt((particles[i].x - lastClick.x)**2 + (particles[i].y - lastClick.y)**2);
                    const waveRadius = (clickElapsed / 800) * 600;
                    if (Math.abs(distToClick - waveRadius) < 60) {
                        alpha *= 3.5;
                        lineWidth = 2;
                    }
                }
                ctx.strokeStyle = `rgba(0, 242, 255, ${alpha})`;
                ctx.lineWidth = lineWidth;
                ctx.beginPath();
                ctx.moveTo(particles[i].x, particles[i].y);
                ctx.lineTo(particles[j].x, particles[j].y);
                ctx.stroke();
            }
        }
    }
    requestAnimationFrame(animate);
}
initParticles();
animate();

// --- Функции работы с Firebase ---

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

function renderReviewsList(reviews) {
    if (reviews.length === 0) {
        reviewsList.innerHTML = '<p class="text-dim">Пока нет отзывов. Будьте первым!</p>';
        return;
    }
    let html = '';
    reviews.forEach(r => {
        const date = r.date ? new Date(r.date.toDate()).toLocaleString() : 'только что';
        html += `
            <div class="review-item">
                <div class="review-header">
                    <span>${r.userName}</span>
                    <span class="review-rating">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
                </div>
                <div class="review-text">${r.text}</div>
                <div class="review-date">${date}</div>
            </div>
        `;
    });
    reviewsList.innerHTML = html;
}

function renderLatestReviews(reviews) {
    if (reviews.length === 0) {
        latestGrid.innerHTML = '<div class="no-reviews-message">Пока нет отзывов. Будьте первым!</div>';
        return;
    }
    let html = '';
    reviews.forEach(r => {
        const date = r.date ? new Date(r.date.toDate()).toLocaleDateString() : 'только что';
        html += `
            <div class="review-card">
                <div class="review-card-header">
                    <span class="review-card-name">${r.userName}</span>
                    <span class="review-card-rating">${'★'.repeat(r.rating)}${'☆'.repeat(5-r.rating)}</span>
                </div>
                <div class="review-card-text">${r.text}</div>
                <div class="review-card-date">${date}</div>
            </div>
        `;
    });
    latestGrid.innerHTML = html;
}

// --- Обработчики событий ---

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
    if (!text) return;

    try {
        await addDoc(collection(db, 'reviews'), {
            userName: currentUserName || currentUser.email.split('@')[0],
            userEmail: currentUser.email,
            rating: rating,
            text: text,
            date: serverTimestamp()
        });
        showNotification('Отзыв добавлен, спасибо!', 'success');
        document.getElementById('write-review-form').reset();
        closeAllModals();
        loadReviews();
    } catch (error) {
        showNotification('Ошибка: ' + error.message, 'error');
    }
});

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
        showNotification('Ошибка: ' + error.message, 'error');
    }
});

document.getElementById('login-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        await signInWithEmailAndPassword(auth, email, password);
        showNotification('Вход выполнен', 'success');
        closeAllModals();
    } catch (error) {
        showNotification('Ошибка: ' + error.message, 'error');
    }
});

logoutBtn.addEventListener('click', async () => {
    try {
        await signOut(auth);
        showNotification('Вы вышли', 'info');
    } catch (error) {
        showNotification('Ошибка: ' + error.message, 'error');
    }
});

forgotPasswordBtn.addEventListener('click', () => {
    const email = prompt('Введите ваш email для сброса пароля:');
    if (email) {
        sendPasswordResetEmail(auth, email)
            .then(() => {
                showNotification('Письмо для сброса пароля отправлено! Проверьте почту.', 'success');
            })
            .catch((error) => {
                showNotification('Ошибка: ' + error.message, 'error');
            });
    }
});

// Кнопка "Войти"
loginBtn.addEventListener('click', () => {
    openModal(loginModal);
});

// Отслеживание состояния аутентификации
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
            console.error('Ошибка получения имени:', error);
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

reviewsBtn.addEventListener('click', () => {
    loadReviews();
    openModal(reviewsModal);
});

feedbackBubble.addEventListener('click', () => {
    if (!currentUser) {
        openModal(loginModal);
    } else {
        openModal(writeReviewModal);
    }
});

closeButtons.forEach(btn => {
    btn.addEventListener('click', closeAllModals);
});

modalOverlay.addEventListener('click', closeAllModals);

document.getElementById('switch-to-register').addEventListener('click', () => {
    openModal(registerModal);
});

// При загрузке страницы
window.onload = () => {
    typeWriter(document.getElementById('main-title'), titleText, 50, () => {
        typeWriter(document.getElementById('main-subtitle'), subText, 30);
    });
    loadReviews();
};