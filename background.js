// background.js — фон на всю страницу с параллаксом орбов
(function () {
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');

    // ── Настройки ──
    let particleCount = 80;
    let mouse = { x: window.innerWidth / 2, y: window.innerHeight / 2 };
    let lastImpulse = { x: null, y: null, time: 0 };
    let paused = false;
    let scrollY = 0;

    // Загрузка настроек из localStorage
    try {
        const saved = localStorage.getItem('vibe-particle-setting');
        if (saved) {
            particleCount = JSON.parse(saved).count;
        } else if (window.innerWidth < 768) {
            particleCount = 25;
        }
    } catch (e) {}

    window.addEventListener('storage', e => {
        if (e.key === 'vibe-particle-setting') {
            try { particleCount = JSON.parse(e.newValue).count; initAll(); } catch {}
        }
    });

    // ── Получить полную высоту страницы ──
    function getPageHeight() {
        return Math.max(
            document.body.scrollHeight,
            document.documentElement.scrollHeight,
            document.body.offsetHeight,
            document.documentElement.offsetHeight
        );
    }

    // ── Размеры канваса = полная страница ──
    function resize() {
        canvas.width  = window.innerWidth;
        canvas.height = getPageHeight();
        initAll();
    }

    window.addEventListener('resize', resize);

    // Пересчитываем если страница меняется (динамический контент)
    const resizeObserver = new ResizeObserver(() => {
        const newH = getPageHeight();
        if (Math.abs(canvas.height - newH) > 10) {
            canvas.height = newH;
            initAll();
        }
    });
    resizeObserver.observe(document.body);

    // ── Мышь (позиция в документе) ──
    window.addEventListener('mousemove', e => {
        mouse.x = e.clientX;
        mouse.y = e.clientY + window.scrollY;
    }, { passive: true });

    window.addEventListener('scroll', () => {
        scrollY = window.scrollY;
    }, { passive: true });

    // ── Импульсы ──
    function triggerImpulse() {
        const x = Math.random() * canvas.width;
        const y = scrollY + Math.random() * window.innerHeight;
        lastImpulse = { x, y, time: Date.now() };

        const ripple = document.createElement('div');
        ripple.className = 'ripple';
        ripple.style.cssText = `left:${x}px;top:${y - scrollY}px;position:fixed;`;
        document.body.appendChild(ripple);
        setTimeout(() => ripple.remove(), 800);
    }
    setInterval(triggerImpulse, 5000);
    setTimeout(triggerImpulse, 1800);

    // ════════════════════════════════════
    // НЕОНОВЫЕ ОРБ-СФЕРЫ (привязаны к вьюпорту + параллакс)
    // ════════════════════════════════════
    const ORBS = [];

    class Orb {
        constructor(xRatio, yRatio, r, color, speed, parallaxFactor) {
            this.xRatio = xRatio;
            this.yRatio = yRatio;
            this.r = r;
            this.color = color;
            this.speed = speed;
            this.parallaxFactor = parallaxFactor;
            this.t = Math.random() * Math.PI * 2;
        }

        draw() {
            this.t += this.speed;
            const breathe = 1 + 0.08 * Math.sin(this.t);

            const cx = this.xRatio * canvas.width
                     + (mouse.x - canvas.width  / 2) * 0.015;
            // Орб плывёт вместе со скроллом, но немного медленнее (параллакс)
            const cy = scrollY * (1 - this.parallaxFactor)
                     + this.yRatio * window.innerHeight
                     + (mouse.y - scrollY - window.innerHeight / 2) * 0.015;

            const radius = this.r * breathe;
            const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
            grad.addColorStop(0,   this.color.replace('A)', '0.18)'));
            grad.addColorStop(0.5, this.color.replace('A)', '0.07)'));
            grad.addColorStop(1,   this.color.replace('A)', '0)'));

            ctx.beginPath();
            ctx.arc(cx, cy, radius, 0, Math.PI * 2);
            ctx.fillStyle = grad;
            ctx.fill();
        }
    }

    function initOrbs() {
        ORBS.length = 0;
        const c1 = 'hsla(186,100%,50%,A)';
        const c2 = 'hsla(262,100%,65%,A)';
        const c3 = 'hsla(186,80%,40%,A)';
        const s  = Math.min(canvas.width, window.innerHeight);

        ORBS.push(new Orb(0.15, 0.2,  s * 0.38, c1, 0.003, 0.3));
        ORBS.push(new Orb(0.82, 0.55, s * 0.42, c2, 0.002, 0.15));
        ORBS.push(new Orb(0.45, 0.85, s * 0.3,  c3, 0.004, 0.45));
        ORBS.push(new Orb(0.7,  0.1,  s * 0.25, c2, 0.005, 0.1));
    }

    // ════════════════════════════════════
    // ЧАСТИЦЫ — по всей высоте страницы
    // ════════════════════════════════════
    let particles = [];

    function getScaledCount() {
        if (particleCount === 0) return 0;
        const ratio = canvas.height / window.innerHeight;
        return Math.min(Math.round(particleCount * Math.min(ratio, 4)), 400);
    }

    class Particle {
        constructor() {
            this.reset();
        }
        reset() {
            this.baseX = Math.random() * canvas.width;
            this.baseY = Math.random() * canvas.height;
            this.x = this.baseX;
            this.y = this.baseY;
            this.vx = (Math.random() - 0.5) * 0.35;
            this.vy = (Math.random() - 0.5) * 0.35;
            this.mouseStrength = 0.012 + Math.random() * 0.018;
            this.size = 1.2 + Math.random() * 1.2;
            this.opacity = 0.3 + Math.random() * 0.4;
        }
        update() {
            this.baseX += this.vx;
            this.baseY += this.vy;

            if (this.baseX > canvas.width  + 10) this.baseX = -10;
            if (this.baseX < -10)                 this.baseX = canvas.width  + 10;
            if (this.baseY > canvas.height + 10)  this.baseY = -10;
            if (this.baseY < -10)                 this.baseY = canvas.height + 10;

            const mx = mouse.x - canvas.width  / 2;
            const my = mouse.y - canvas.height / 2;
            this.x = this.baseX + mx * this.mouseStrength;
            this.y = this.baseY + my * this.mouseStrength;
        }
        draw() {
            ctx.beginPath();
            ctx.arc(this.x, this.y, this.size, 0, Math.PI * 2);
            ctx.fillStyle = `rgba(0, 242, 255, ${this.opacity})`;
            ctx.fill();
        }
    }

    function initParticles() {
        particles = [];
        const count = getScaledCount();
        for (let i = 0; i < count; i++) particles.push(new Particle());
    }

    function initAll() {
        initOrbs();
        initParticles();
    }

    new MutationObserver(() => initOrbs())
        .observe(document.body, { attributes: true, attributeFilter: ['class'] });

    // ════════════════════════════════════
    // ОСНОВНОЙ LOOP
    // ════════════════════════════════════
    document.addEventListener('visibilitychange', () => { paused = document.hidden; });

    function animate() {
        requestAnimationFrame(animate);
        if (paused) return;

        // Очищаем только видимую полосу + буфер — не весь канвас (оптимизация)
        const buffer = 200;
        ctx.clearRect(0, scrollY - buffer, canvas.width, window.innerHeight + buffer * 2);

        // 1. Орбы
        ORBS.forEach(orb => orb.draw());

        if (particleCount === 0) return;

        // 2. Обновляем все частицы
        particles.forEach(p => p.update());

        // 3. Рисуем только видимые частицы
        const top    = scrollY - buffer;
        const bottom = scrollY + window.innerHeight + buffer;
        const visible = particles.filter(p => p.y >= top && p.y <= bottom);

        const now = Date.now();
        const impulseElapsed = now - lastImpulse.time;

        for (let i = 0; i < visible.length; i++) {
            visible[i].draw();
            for (let j = i + 1; j < visible.length; j++) {
                const dx = visible[i].x - visible[j].x;
                const dy = visible[i].y - visible[j].y;
                const d  = Math.sqrt(dx * dx + dy * dy);

                if (d < 160) {
                    let alpha     = 0.28 * (1 - d / 160);
                    let lineWidth = 0.8;

                    if (impulseElapsed < 900 && lastImpulse.x !== null) {
                        const di = Math.hypot(
                            visible[i].x - lastImpulse.x,
                            visible[i].y - lastImpulse.y
                        );
                        const wave = (impulseElapsed / 900) * 550;
                        if (Math.abs(di - wave) < 55) {
                            alpha *= 4;
                            lineWidth = 1.8;
                        }
                    }

                    ctx.beginPath();
                    ctx.strokeStyle = `rgba(0, 242, 255, ${alpha})`;
                    ctx.lineWidth   = lineWidth;
                    ctx.moveTo(visible[i].x, visible[i].y);
                    ctx.lineTo(visible[j].x, visible[j].y);
                    ctx.stroke();
                }
            }
        }
    }

    resize();
    animate();

    window.updateReviewCounter = function (count) {
        const el = document.getElementById('review-count');
        if (!el) return;
        const cur = parseInt(el.textContent) || 0;
        if (count > cur) {
            let s = cur;
            const iv = setInterval(() => {
                el.textContent = ++s;
                if (s >= count) clearInterval(iv);
            }, 50);
        } else {
            el.textContent = count;
        }
    };
})();