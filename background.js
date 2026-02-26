// background.js
(function() {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    let particles = [];
    let mouse = { x: null, y: null };
    let lastImpulse = { x: null, y: null, time: 0 };
    let particleCount = 90;

    // Загружаем настройки из localStorage
    try {
        const saved = localStorage.getItem('vibe-particle-setting');
        if (saved) {
            const parsed = JSON.parse(saved);
            particleCount = parsed.count;
        } else {
            if (window.innerWidth < 768) particleCount = 30;
        }
    } catch (e) {
        console.warn('Failed to load particle setting', e);
    }

    // Слушаем изменения настроек
    window.addEventListener('storage', (e) => {
        if (e.key === 'vibe-particle-setting') {
            try {
                const parsed = JSON.parse(e.newValue);
                particleCount = parsed.count;
                initParticles();
            } catch (err) {}
        }
    });

    window.addEventListener('mousemove', (e) => {
        mouse.x = e.clientX;
        mouse.y = e.clientY;
    });

    // Автоматический импульс в случайной точке экрана каждые 4 секунды
    function triggerAutoImpulse() {
        const x = Math.random() * canvas.width;
        const y = Math.random() * canvas.height;

        // Визуальный ripple эффект
        const ripple = document.createElement('div');
        ripple.className = 'ripple';
        ripple.style.left = `${x}px`;
        ripple.style.top = `${y}px`;
        document.body.appendChild(ripple);
        setTimeout(() => ripple.remove(), 800);

        // Обновляем точку импульса для частиц
        lastImpulse.x = x;
        lastImpulse.y = y;
        lastImpulse.time = Date.now();
    }

    // Запускаем автоимпульсы
    setInterval(triggerAutoImpulse, 4000);
    // Первый импульс немного с задержкой чтобы частицы успели инициализироваться
    setTimeout(triggerAutoImpulse, 1500);

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

    function initParticles() {
        particles = [];
        if (particleCount === 0) return;
        for (let i = 0; i < particleCount; i++) particles.push(new Particle());
    }

    function resize() {
        canvas.width = window.innerWidth;
        canvas.height = window.innerHeight;
        initParticles();
    }

    window.addEventListener('resize', resize);
    resize();

    let paused = false;
    document.addEventListener('visibilitychange', () => {
        paused = document.hidden;
    });

    function animate() {
        requestAnimationFrame(animate);
        if (paused) return;
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        if (particleCount === 0) return;
        const now = Date.now();
        const impulseElapsed = now - lastImpulse.time;

        for (let i = 0; i < particles.length; i++) {
            particles[i].update();
            particles[i].draw();

            for (let j = i + 1; j < particles.length; j++) {
                const dx = particles[i].x - particles[j].x;
                const dy = particles[i].y - particles[j].y;
                const d = Math.sqrt(dx * dx + dy * dy);
                if (d < 170) {
                    let alpha = 0.3 * (1 - d / 170);
                    let lineWidth = 1;

                    if (impulseElapsed < 800 && lastImpulse.x !== null) {
                        const distToImpulse = Math.sqrt(
                            (particles[i].x - lastImpulse.x) ** 2 +
                            (particles[i].y - lastImpulse.y) ** 2
                        );
                        const waveRadius = (impulseElapsed / 800) * 600;
                        if (Math.abs(distToImpulse - waveRadius) < 60) {
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
    }
    animate();
})();