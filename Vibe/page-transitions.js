// page-transitions.js
// Подключай на всех страницах: <script src="page-transitions.js" defer></script>

(function () {
    'use strict';

    // ── 1. Анимированный логотип ──
    function initAnimatedLogo() {
        const logos = document.querySelectorAll('.logo');
        logos.forEach(logo => {
            const text = logo.textContent.trim();
            if (logo.dataset.animated) return; // не двойной init
            logo.dataset.animated = '1';

            logo.innerHTML = text.split('').map(
                ch => `<span class="logo-char">${ch}</span>`
            ).join('');
        });
    }

    // ── 2. Плавный переход при уходе со страницы ──
    function initPageTransitions() {
        document.addEventListener('click', e => {
            const link = e.target.closest('a');
            if (!link) return;

            const href = link.getAttribute('href');
            if (!href) return;

            // Пропускаем: внешние ссылки, якоря, javascript:, download, новые вкладки
            if (
                href.startsWith('http') ||
                href.startsWith('#') ||
                href.startsWith('javascript') ||
                href.startsWith('mailto') ||
                link.target === '_blank' ||
                link.hasAttribute('download') ||
                e.ctrlKey || e.metaKey || e.shiftKey
            ) return;

            e.preventDefault();
            const destination = href;

            document.body.classList.add('page-exit');
            setTimeout(() => {
                window.location.href = destination;
            }, 240);
        });
    }

    // ── 3. Scroll-to-top при переходе на новую страницу ──
    if ('scrollRestoration' in history) {
        history.scrollRestoration = 'manual';
    }
    window.addEventListener('pageshow', () => {
        window.scrollTo(0, 0);
    });

    // ── Init ──
    document.addEventListener('DOMContentLoaded', () => {
        initAnimatedLogo();
        initPageTransitions();
    });
})();
