// background.js
(function() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return; // если канвас не найден, ничего не делаем

    const ctx = canvas.getContext('2d');
    let particles = [];
    let mouse = { x: null, y: null };
    let lastClick = { x: null, y: null, time: 0 };

    // Отслеживание мыши
    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    // Эффект ряби при клике
    window.addEventListener('click', (e) => {
        const ripple = document.createElement('div');
        ripple.className = 'ripple';
        ripple.style.left = `${e.clientX}px`;
        ripple.style.top = `${e.clientY}px`;
        document.body.appendChild(ripple);
        setTimeout(() => ripple.remove(), 800);
        lastClick.x = e.clientX;
        lastClick.y = e.clientY;
        lastClick.time = Date.now();
    });

    // Подгон размера канваса под окно
    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
    }
    window.addEventListener('resize', resize);
    resize();

    // Класс частицы
    class Particle {
        constructor() {
            this.baseX = Math.random() * canvas.width;
            this.baseY = Math.random() * canvas.height;
            this.x = this.baseX;
            this.y = this.baseY;
            this.speedX = (Math.random() - 0.5) * 0.4;
            this.speedY = (Math.random() - 0.5) * 0.4;
            this.size = 2;
        }
        update() {
            if (mouse.x) {
                this.x = this.baseX + (mouse.x - canvas.width / 2) * 0.03;
                this.y = this.baseY + (mouse.y - canvas.height / 2) * 0.03;
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

    // Инициализация частиц
    function initParticles() {
        particles = [];
        for (let i = 0; i < 75; i++) particles.push(new Particle());
    }
    initParticles();

    // Анимация
    function animate() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        const now = Date.now();
        const clickElapsed = now - lastClick.time;

        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();

            // Рисование линий между частицами
            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < 170) {
                    let alpha = 0.3 * (1 - d / 170);
                    let lineWidth = 1;

                    // Эффект волны от клика
                    if (clickElapsed < 800 && lastClick.x !== null) {
                        const distToClick = Math.sqrt((particles[i].x - lastClick.x) ** 2 + (particles[i].y - lastClick.y) ** 2);
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
})();