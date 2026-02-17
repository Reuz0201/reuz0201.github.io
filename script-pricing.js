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

// Ваш конфиг Firebase (скопируйте из index.html)
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
initParticles();

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
animate();

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