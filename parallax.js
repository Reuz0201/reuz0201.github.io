// parallax.js – РАБОТАЕТ НА ВСЕХ СТРАНИЦАХ

document.addEventListener('DOMContentLoaded', function() {
  
  // =============================================
  // 0. Проверка на мобилку
  // =============================================
  const isMobile = window.matchMedia("(max-width: 768px)").matches;
  
  // =============================================
  // 1. Умный фон (только если есть куда)
  // =============================================
  function initSmartBackground() {
    if (isMobile) return;
    
    const oldOverlay = document.getElementById('smart-bg-overlay');
    if (oldOverlay) oldOverlay.remove();
    
    const overlay = document.createElement('div');
    overlay.id = 'smart-bg-overlay';
    overlay.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      pointer-events: none;
      z-index: -1;
      mix-blend-mode: overlay;
      transition: background 0.1s ease;
    `;
    document.body.appendChild(overlay);
    
    let mouseX = 0, mouseY = 0;
    let targetX = 0, targetY = 0;
    
    document.addEventListener('mousemove', (e) => {
      targetX = e.clientX;
      targetY = e.clientY;
    });
    
    function animate() {
      mouseX += (targetX - mouseX) * 0.05;
      mouseY += (targetY - mouseY) * 0.05;
      
      const x = mouseX / window.innerWidth;
      const y = mouseY / window.innerHeight;
      
      const hue = 180 + (x * 60 - 30);
      const saturation = 70 + y * 30;
      
      overlay.style.background = `
        radial-gradient(circle at ${mouseX}px ${mouseY}px, 
        hsla(${hue}, ${saturation}%, 70%, 0.05) 0%, 
        transparent 70%)
      `;
      
      requestAnimationFrame(animate);
    }
    animate();
  }

  // =============================================
  // 2. Анимация появления (для всех карточек, кроме отзывов)
  // =============================================
  function initRevealOnScroll() {
    const elements = document.querySelectorAll(
      '.card, .pricing-card, .rv-card, .latest-reviews-header, .features, .pricing-section, .profile-info'
    ); // Убрали .review-card

    if (elements.length === 0) return;

    elements.forEach(el => {
      if (el.classList.contains('reveal-init')) return;
      el.classList.add('reveal-init');

      el.style.opacity = '0';
      el.style.transform = 'translateY(30px)';
      el.style.transition = 'opacity 0.8s cubic-bezier(0.2, 0.9, 0.3, 1), transform 0.8s cubic-bezier(0.2, 0.9, 0.3, 1)';
    });

    function checkReveal() {
      elements.forEach(el => {
        const rect = el.getBoundingClientRect();
        const windowHeight = window.innerHeight;

        const isVisible = rect.top < windowHeight * 0.9 && rect.bottom > 0;

        if (isVisible) {
          el.style.opacity = '1';
          el.style.transform = 'translateY(0)';
        }
      });
    }

    window.addEventListener('scroll', checkReveal, { passive: true });
    window.addEventListener('resize', checkReveal, { passive: true });

    setTimeout(checkReveal, 100);
    setTimeout(checkReveal, 500);
  }

  // =============================================
  // 3. Кастомный курсор (везде одинаковый)
  // =============================================
  function initCustomCursor() {
    if (isMobile) return;
    
    document.body.style.cursor = 'none';
    
    const cursor = document.createElement('div');
    cursor.id = 'custom-cursor';
    cursor.style.cssText = `
      position: absolute;
      width: 8px;
      height: 8px;
      background: var(--accent-color, #00f2ff);
      border-radius: 50%;
      pointer-events: none;
      z-index: 99999;
      transform: translate(-50%, -50%);
      transition: width 0.2s, height 0.2s, background 0.2s;
      box-shadow: 0 0 15px var(--accent-color, #00f2ff);
    `;
    document.body.appendChild(cursor);
    
    const trail = document.createElement('div');
    trail.id = 'cursor-trail';
    trail.style.cssText = `
      position: absolute;
      width: 24px;
      height: 24px;
      border: 1px solid var(--accent-color, #00f2ff);
      border-radius: 50%;
      pointer-events: none;
      z-index: 99998;
      transform: translate(-50%, -50%);
      opacity: 0.4;
      transition: width 0.2s, height 0.2s, border-color 0.2s;
    `;
    document.body.appendChild(trail);
    
    function updateCursorPosition(e) {
      const scrollX = window.scrollX || window.pageXOffset;
      const scrollY = window.scrollY || window.pageYOffset;
      
      cursor.style.left = (e.clientX + scrollX) + 'px';
      cursor.style.top = (e.clientY + scrollY) + 'px';
      trail.style.left = (e.clientX + scrollX) + 'px';
      trail.style.top = (e.clientY + scrollY) + 'px';
    }
    
    document.addEventListener('mousemove', updateCursorPosition);
    
    const clickables = document.querySelectorAll('button, a, .review-card, .card, .pricing-card, .rv-card, .feedback-bubble, .reviews-btn, .login-btn, .user-avatar');
    
    clickables.forEach(el => {
      el.addEventListener('mouseenter', () => {
        cursor.style.width = '16px';
        cursor.style.height = '16px';
        cursor.style.background = 'white';
        cursor.style.boxShadow = '0 0 20px white';
        trail.style.width = '32px';
        trail.style.height = '32px';
        trail.style.borderColor = 'white';
        trail.style.opacity = '0.6';
      });
      
      el.addEventListener('mouseleave', () => {
        cursor.style.width = '8px';
        cursor.style.height = '8px';
        cursor.style.background = 'var(--accent-color, #00f2ff)';
        cursor.style.boxShadow = '0 0 15px var(--accent-color, #00f2ff)';
        trail.style.width = '24px';
        trail.style.height = '24px';
        trail.style.borderColor = 'var(--accent-color, #00f2ff)';
        trail.style.opacity = '0.4';
      });
    });
  }

  // =============================================
  // 4. Магнитные кнопки
  // =============================================
  function initMagneticButtons() {
    if (isMobile) return;
    
    const buttons = document.querySelectorAll('.reviews-btn, .login-btn, .feedback-bubble, .write-review-fab');
    
    buttons.forEach(btn => {
      btn.addEventListener('mousemove', (e) => {
        const rect = btn.getBoundingClientRect();
        const x = e.clientX - rect.left - rect.width / 2;
        const y = e.clientY - rect.top - rect.height / 2;
        
        btn.style.transform = `translate(${x * 0.15}px, ${y * 0.15}px)`;
        btn.style.transition = 'transform 0.1s';
      });
      
      btn.addEventListener('mouseleave', () => {
        btn.style.transform = 'translate(0, 0)';
        btn.style.transition = 'transform 0.3s ease';
      });
    });
  }

  // =============================================
  // 5. Индикатор скролла
  // =============================================
  function initScrollIndicator() {
    const indicator = document.createElement('div');
    indicator.id = 'scroll-indicator';
    indicator.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      height: 2px;
      width: 0%;
      background: linear-gradient(90deg, var(--accent-color), var(--accent-2));
      box-shadow: 0 0 10px var(--accent-color);
      z-index: 10000;
      transition: width 0.1s;
    `;
    document.body.appendChild(indicator);
    
    function updateIndicator() {
      const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
      const height = document.documentElement.scrollHeight - document.documentElement.clientHeight;
      const scrolled = (winScroll / height) * 100;
      indicator.style.width = scrolled + '%';
    }
    
    window.addEventListener('scroll', updateIndicator);
    updateIndicator();
  }

  // =============================================
  // 6. Печатная машинка для заголовка (ТОЛЬКО НА ГЛАВНОЙ)
  // =============================================
  function initTypewriter() {
    const titleElement = document.getElementById('main-title');
    if (!titleElement) return; // если нет элемента - пропускаем
    
    const words = [
      "Простота", "Порядок", "Интеллект",
      "Скорость", "Точность", "Стиль",
      "Умный", "Быстрый", "Надёжный",
      "Интуитивный", "Понятный", "Лёгкий",
      "Мощный", "Гибкий", "Адаптивный",
      "Дружелюбный", "Заботливый", "Внимательный",
      "Эффективный", "Продуктивный", "Удобный",
      "Современный", "Технологичный", "Инновационный",
      "Безупречный", "Идеальный", "Совершенный"
    ];
    
    let currentWords = ["Простота", "Порядок", "Интеллект"];
    let isDeleting = false;
    
    function getRandomThreeWords() {
      const shuffled = [...words].sort(() => 0.5 - Math.random());
      return shuffled.slice(0, 3);
    }
    
    function type() {
      const fullText = currentWords.join('. ') + '.';
      const currentText = titleElement.textContent;
      
      if (isDeleting) {
        titleElement.textContent = fullText.substring(0, currentText.length - 1);
        
        if (titleElement.textContent === '') {
          isDeleting = false;
          currentWords = getRandomThreeWords();
        }
      } else {
        const targetText = fullText;
        if (currentText.length < targetText.length) {
          titleElement.textContent = targetText.substring(0, currentText.length + 1);
        } else {
          setTimeout(() => {
            isDeleting = true;
          }, 3000);
        }
      }
      
      setTimeout(type, isDeleting ? 30 : 60);
    }
    
    setTimeout(type, 1000);
  }

  // =============================================
  // 7. Акселерометр для мобилок
  // =============================================
  function initAccelerometer() {
    if (!isMobile) return;
    
    const canvas = document.getElementById('bg-canvas');
    if (!canvas) return;
    
    window.addEventListener('deviceorientation', (event) => {
      const gamma = event.gamma || 0;
      const beta = event.beta || 0;
      
      canvas.style.transform = `translate(${gamma * 0.3}px, ${beta * 0.2}px)`;
    }, true);
  }

  // =============================================
  // 8. Tap-эффект с вибрацией
  // =============================================
  function initTapVibration() {
    if (!isMobile) return;
    
    const cards = document.querySelectorAll('.review-card, .card, .pricing-card, .rv-card, button, a, .user-avatar');
    
    cards.forEach(card => {
      card.addEventListener('click', () => {
        if (window.navigator && window.navigator.vibrate) {
          window.navigator.vibrate(15);
        }
      });
    });
  }

  // =============================================
  // 9. Обновление счётчика отзывов (ТОЛЬКО НА ГЛАВНОЙ)
  // =============================================
  window.updateReviewCounter = function(count) {
    const counterElement = document.getElementById('review-count');
    if (!counterElement) return;
    
    const currentCount = parseInt(counterElement.textContent) || 0;
    
    if (count > currentCount) {
      let step = currentCount;
      const interval = setInterval(() => {
        step++;
        counterElement.textContent = step;
        if (step >= count) {
          clearInterval(interval);
        }
      }, 50);
    } else {
      counterElement.textContent = count;
    }
  };

  // =============================================
  // ЗАПУСК ВСЕХ ФУНКЦИЙ
  // =============================================
  
  initSmartBackground();     // работает везде
  initRevealOnScroll();      // работает везде
  initCustomCursor();        // работает везде
  initMagneticButtons();     // работает везде (где есть кнопки)
  initScrollIndicator();     // работает везде
  initTypewriter();          // сработает только на главной
  initAccelerometer();       // только на мобилках
  initTapVibration();        // только на мобилках

  // Наблюдаем за новыми элементами (для динамических страниц)
  const observer = new MutationObserver(() => {
    initRevealOnScroll();
    if (isMobile) {
      initTapVibration();
    }
  });
  
  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
});