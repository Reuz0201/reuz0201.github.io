// =============================================================
// МЕНЮ КУХНИ И БАРА — ГИД ПО СОСТАВУ (с модальной игрой)
// =============================================================

let kitchenData = [];
let barData = [];
let currentData = [];
let currentMenuType = 'kitchen';

// Прогресс для кухни и бара отдельно, при загрузке страницы пустой
let progress = {
  kitchen: [],
  bar: []
};

let gameStarted = false;
let deck = [];
let deckPointer = 0;
let current = null;
let streak = 0;
let revealMode = false;

// Порядок категорий для кухни
const CATEGORY_ORDER_KITCHEN = [
  "Поздний завтрак",
  "К вину",
  "Закуски",
  "Суп",
  "Салаты",
  "Рыба",
  "Мясо",
  "Паста",
  "Овощи",
  "Десерты",
  "Бранч",
  "Добавки к бранчу",
  "Ночное меню"
];

// Порядок категорий для бара
const CATEGORY_ORDER_BAR = [
  "Коктейли",
  "Шприцы",
  "Моктейли",
  "Чай",
  "Кофе",
  "Соки/Фреш",
  "Вода",
  "Пиво и сидр",
  "Ликёры и настойки",
  "Джин",
  "Текила и мескаль",
  "Писко",
  "Водка",
  "Соджу",
  "Коньяк / Арманьяк",
  "Кальвадос и граппа",
  "Виски",
  "Порто и херес",
  "Саке"
];

// ---------- Цвета категорий ----------
const categoryColors = {
  // Кухня
  'Закуски': '#d4a373',
  'Салаты': '#6a994e',
  'Супы': '#f4a261',
  'Рыба': '#4a8fe7',
  'Мясо': '#8d6b4b',
  'Паста': '#e9c46a',
  'Овощи': '#2b9348',
  'Десерты': '#d8a7b9',
  'Бранч': '#f9d56e',
  'Добавки к бранчу': '#b8a9c9',
  'Ночное меню': '#2d2d2d',
  'К вину': '#a33b3b',
  // Бар
  'Коктейли': '#3b7a9a',
  'Шприцы': '#b08d6b',
  'Моктейли': '#4c9f70',
  'Чай': '#7a9e6b',
  'Кофе': '#6b4a3a',
  'Соки/Фреш': '#e07a3a',
  'Вода': '#4a8bb5',
  'Пиво и сидр': '#c9a84a',
  'Ликёры и настойки': '#8a6b8a',
  'Джин': '#5a8a6b',
  'Текила и мескаль': '#b58a4a',
  'Писко': '#c97a4a',
  'Водка': '#8a8a8a',
  'Соджу': '#6b8a9a',
  'Коньяк / Арманьяк': '#7a5a3a',
  'Кальвадос и граппа': '#b57a4a',
  'Виски': '#8a6a4a',
  'Порто и херес': '#7a3a3a',
  'Саке': '#d4b08a'
};

// ---------- Fuzzy match ----------
function levenshteinDistance(a, b) {
  const matrix = [];
  for (let i = 0; i <= b.length; i++) {
    matrix[i] = [i];
  }
  for (let j = 0; j <= a.length; j++) {
    matrix[0][j] = j;
  }
  for (let i = 1; i <= b.length; i++) {
    for (let j = 1; j <= a.length; j++) {
      if (b[i-1] === a[j-1]) {
        matrix[i][j] = matrix[i-1][j-1];
      } else {
        matrix[i][j] = Math.min(
          matrix[i-1][j-1] + 1,
          matrix[i][j-1] + 1,
          matrix[i-1][j] + 1
        );
      }
    }
  }
  return matrix[b.length][a.length];
}

function fuzzyMatch(input, target) {
  const normInput = normalize(input);
  const normTarget = normalize(target);
  if (normInput === normTarget) return true;
  if (normInput.includes(normTarget) || normTarget.includes(normInput)) return true;
  const inputWords = normInput.split(' ');
  const targetWords = normTarget.split(' ');
  let matchCount = 0;
  for (let w of inputWords) {
    for (let t of targetWords) {
      if (w === t || levenshteinDistance(w, t) <= 2) {
        matchCount++;
        break;
      }
    }
  }
  return matchCount >= Math.min(inputWords.length, targetWords.length) * 0.6;
}

// ---------- загрузка данных ----------
async function loadAllData() {
  try {
    const [kitchenResp, barResp] = await Promise.all([
      fetch('menu.json'),
      fetch('bar.json')
    ]);
    if (!kitchenResp.ok) throw new Error('Ошибка загрузки menu.json');
    if (!barResp.ok) throw new Error('Ошибка загрузки bar.json');

    kitchenData = await kitchenResp.json();
    barData = await barResp.json();

    kitchenData.forEach((d, i) => { d.id = i; });
    barData.forEach((d, i) => { d.id = i + 1000; });

    initApp();
  } catch (error) {
    console.error('Ошибка загрузки данных:', error);
    document.body.innerHTML = '<p style="color:red;text-align:center;padding:40px;">❌ Ошибка загрузки данных. Проверьте файлы menu.json и bar.json.</p>';
  }
}

// ---------- утилиты ----------
function normalize(str) {
  return String(str || "")
    .toLowerCase()
    .replace(/ё/g, "е")
    .replace(/[.,;:!?()"«»']/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function escapeHtml(str) {
  const div = document.createElement("div");
  div.textContent = str;
  return div.innerHTML;
}

function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// ---------- инициализация ----------
function initApp() {
  const menuTypeBtns = document.querySelectorAll(".menu-type-btn");
  const winePlaceholder = document.getElementById("wine-placeholder");
  const dishGrid = document.getElementById("dish-grid");

  menuTypeBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      menuTypeBtns.forEach(b => b.classList.remove("is-active"));
      btn.classList.add("is-active");
      const type = btn.dataset.type;
      currentMenuType = type;

      const sub = document.getElementById("brand-sub");
      if (type === 'kitchen') {
        sub.textContent = `Кухня · ${kitchenData.length} блюд`;
        currentData = kitchenData;
        winePlaceholder.classList.add("hidden");
        dishGrid.classList.remove("hidden");
      } else if (type === 'bar') {
        sub.textContent = `Бар · ${barData.length} напитков`;
        currentData = barData;
        winePlaceholder.classList.add("hidden");
        dishGrid.classList.remove("hidden");
      } else if (type === 'wine') {
        sub.textContent = 'Вино · скоро';
        currentData = [];
        winePlaceholder.classList.remove("hidden");
        dishGrid.classList.add("hidden");
        document.getElementById("dish-grid").innerHTML = '';
        document.getElementById("category-chips").innerHTML = '';
        document.getElementById("browse-empty").classList.add("hidden");
        closeGameModal();
        return;
      }

      if (currentData.length) {
        buildCategoryChips();
        renderDishGrid();
        buildGameCategoryOptions();
        if (gameStarted) {
          startGame();
        }
      }
    });
  });

  document.getElementById("game-trigger-btn").addEventListener("click", openGameModal);
  document.getElementById("game-modal-close").addEventListener("click", closeGameModal);
  document.getElementById("game-modal-overlay").addEventListener("click", (e) => {
    if (e.target === e.currentTarget) closeGameModal();
  });

  const kitchenBtn = document.querySelector(".menu-type-btn[data-type='kitchen']");
  if (kitchenBtn) kitchenBtn.click();

  document.getElementById("search-input").addEventListener("input", renderDishGrid);
  buildGameCategoryOptions();
}

// ---------- BROWSE VIEW ----------
const dishGrid = document.getElementById("dish-grid");
const searchInput = document.getElementById("search-input");
const categoryChipsEl = document.getElementById("category-chips");
const browseEmpty = document.getElementById("browse-empty");
let activeCategory = "Все";

function getCategoryOrder() {
  if (currentMenuType === 'kitchen') {
    return ["Все", ...CATEGORY_ORDER_KITCHEN.filter(c => currentData.some(d => d.category === c))];
  } else if (currentMenuType === 'bar') {
    return ["Все", ...CATEGORY_ORDER_BAR.filter(c => currentData.some(d => d.category === c))];
  }
  return ["Все"];
}

function buildCategoryChips() {
  const cats = getCategoryOrder();
  categoryChipsEl.innerHTML = "";
  cats.forEach(cat => {
    const chip = document.createElement("button");
    chip.className = "chip" + (cat === activeCategory ? " is-active" : "");
    chip.textContent = cat;
    chip.addEventListener("click", () => {
      activeCategory = cat;
      document.querySelectorAll(".chip").forEach(c => c.classList.remove("is-active"));
      chip.classList.add("is-active");
      renderDishGrid();
    });
    categoryChipsEl.appendChild(chip);
  });
}

function ingredientLine(item) {
  const full = item.full;
  const label = item.label;
  if (full === label) return `<li>${escapeHtml(full)}</li>`;
  const idx = full.toLowerCase().indexOf(label.toLowerCase());
  if (idx === 0) {
    const rest = full.slice(label.length);
    return `<li><b>${escapeHtml(label)}</b>${escapeHtml(rest)}</li>`;
  }
  return `<li><b>${escapeHtml(label)}</b> — ${escapeHtml(full)}</li>`;
}

// ---------- ОСНОВНАЯ ФУНКЦИЯ РЕНДЕРИНГА (с цветными тегами вкуса) ----------
function renderDishGrid() {
  if (currentMenuType === 'wine') return;

  const query = normalize(searchInput.value);
  const filtered = currentData.filter(d => {
    if (activeCategory !== "Все" && d.category !== activeCategory) return false;
    if (!query) return true;
    const haystack = normalize(
      d.name + " " + (d.content || []).map(i => i.full).join(" ") + " " + (d.sauce || []).map(i => i.full).join(" ")
    );
    return haystack.includes(query);
  });

  browseEmpty.classList.toggle("hidden", filtered.length !== 0);
  dishGrid.innerHTML = filtered.map(d => {
    let badgeHtml = '';
    if (currentMenuType === 'bar' && d.number) {
      badgeHtml += `<span class="dish-number">${escapeHtml(d.number)}</span>`;
      if (d.icon) {
        badgeHtml += `<img src="assets/${d.icon}.svg" class="dish-icon" alt="иконка бокала">`;
      }
    }

    const catClass = 'cat-' + d.category.replace(/[^а-яa-z]/gi, '');
    
    // --- Генерация тегов вкуса (поддержка массива) ---
    const tasteValues = getTasteArray(d.taste);
    const tasteTagsHtml = tasteValues.map(t => 
      `<span class="taste-tag taste-${t}">${t}</span>`
    ).join('');

    // --- Генерация блока "С чем подавать" ---
    let pairingHtml = '';
    if (d.pairing) {
      const pairingContent = Array.isArray(d.pairing) 
        ? `<ul>${d.pairing.map(item => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` 
        : `<p>${escapeHtml(d.pairing)}</p>`;
      pairingHtml = `
        <div class="comp-block pairing-block">
          <h4>🍷 С чем подавать</h4>
          ${pairingContent}
        </div>`;
    }

    return `
    <article class="dish-card">
      <div class="card-top">
        <span class="ticket-no">№${String(d.id % 1000 + 1).padStart(3, "0")}</span>
        <span class="cat-tag ${catClass}">${escapeHtml(d.category)}</span>
      </div>
      <div class="dish-header">
        <div class="dish-info">
          <h3 class="dish-name">${escapeHtml(d.name)}</h3>
          ${tasteTagsHtml ? `<div class="taste-tags">${tasteTagsHtml}</div>` : ''}
        </div>
        <div class="dish-badge">${badgeHtml}</div>
      </div>
      ${d.content && d.content.length ? `
      <div class="comp-block content-block">
        <h4>Состав</h4>
        <ul>${d.content.map(ingredientLine).join("")}</ul>
      </div>` : ''}
      ${d.sauce && d.sauce.length ? `
      <div class="comp-block sauce-block">
        <h4>Соус <span class="sub">(заправка)</span></h4>
        <ul>${d.sauce.map(ingredientLine).join("")}</ul>
      </div>` : ''}
      ${pairingHtml}
    </article>
  `}).join("");
}

// ---------- GAME MODAL ----------
const gameModalOverlay = document.getElementById("game-modal-overlay");
const gameCategorySelect = document.getElementById("game-category");
const statLearned = document.getElementById("stat-learned");
const statStreak = document.getElementById("stat-streak");
const statRemaining = document.getElementById("stat-remaining");
const gameCardEl = document.getElementById("game-card");
const gameCompleteEl = document.getElementById("game-complete");
const gameTicketNo = document.getElementById("game-ticket-no");
const gameCatTag = document.getElementById("game-cat-tag");
const gameDishName = document.getElementById("game-dish-name");
const dishBadge = document.getElementById("dish-badge");
const dotsContentEl = document.getElementById("dots-content");
const dotsSauceEl = document.getElementById("dots-sauce");
const listContentEl = document.getElementById("list-content");
const listSauceEl = document.getElementById("list-sauce");
const groupSauceEl = document.getElementById("group-sauce");
const guessForm = document.getElementById("guess-form");
const guessInput = document.getElementById("guess-input");
const feedbackEl = document.getElementById("game-feedback");
const btnReveal = document.getElementById("btn-reveal");
const btnSkip = document.getElementById("btn-skip");
const btnNext = document.getElementById("btn-next");
const completeDishName = document.getElementById("complete-dish-name");

const CHECK_SVG = '<svg viewBox="0 0 10 10" fill="none"><path d="M1.5 5.2L3.8 7.5L8.5 2.5" stroke="#191308" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/></svg>';

function buildGameCategoryOptions() {
  const cats = getCategoryOrder();
  gameCategorySelect.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

function openGameModal() {
  if (currentMenuType === 'wine') return;
  gameModalOverlay.classList.add("active");
  document.body.style.overflow = "hidden";
  startGame();
}

function closeGameModal() {
  gameModalOverlay.classList.remove("active");
  document.body.style.overflow = "";
  gameStarted = false;
}

function getProgressKey() {
  return currentMenuType === 'kitchen' ? 'kitchen' : 'bar';
}

function getLearned() {
  return progress[getProgressKey()] || [];
}

function updateLearnedStat() {
  statLearned.textContent = getLearned().length;
}

function buildDeck() {
  const cat = gameCategorySelect.value;
  const pool = currentData.filter(d => cat === "Все" || d.category === cat);
  const eligible = pool.filter(d => d.content && d.content.length > 0);
  deck = shuffle(eligible.map(d => d.id));
  deckPointer = 0;
  updateRemainingStat();
}

function updateRemainingStat() {
  statRemaining.textContent = Math.max(deck.length - deckPointer, 0);
}

function startGame() {
  if (currentMenuType === 'wine' || !currentData.length) return;
  gameStarted = true;
  buildDeck();
  updateLearnedStat();
  nextCard();
}

gameCategorySelect.addEventListener("change", () => {
  if (!gameStarted) return;
  buildDeck();
  nextCard();
});

// ---------- ОСНОВНАЯ ФУНКЦИЯ nextCard (с цветными тегами вкуса) ----------
function nextCard() {
  gameCompleteEl.classList.add("hidden");
  gameCardEl.classList.remove("hidden");
  revealMode = false;
  btnReveal.textContent = "Показать состав";
  feedbackEl.textContent = "\u00a0";
  feedbackEl.className = "game-feedback";

  if (deckPointer >= deck.length) {
    deck = shuffle(deck);
    deckPointer = 0;
  }
  if (deck.length === 0) {
    gameDishName.textContent = "В этой категории нет блюд с ингредиентами";
    listContentEl.innerHTML = "";
    listSauceEl.innerHTML = "";
    dotsContentEl.innerHTML = "";
    dotsSauceEl.innerHTML = "";
    dishBadge.innerHTML = '';
    guessForm.style.display = 'none';
    feedbackEl.textContent = 'Выберите другую категорию';
    feedbackEl.className = 'game-feedback info';
    const oldTags = document.querySelector('.game-card .taste-tags');
    if (oldTags) oldTags.remove();
    return;
  }
  guessForm.style.display = 'flex';

  const dishId = deck[deckPointer];
  deckPointer++;
  updateRemainingStat();

  const dish = currentData.find(d => d.id === dishId);
  if (!dish) { nextCard(); return; }

  current = {
    dish,
    contentState: (dish.content || []).map(i => ({ ...i, found: false })),
    sauceState: (dish.sauce || []).map(i => ({ ...i, found: false })),
  };

  gameTicketNo.textContent = "№" + String(dish.id % 1000 + 1).padStart(3, "0");
  gameCatTag.textContent = dish.category;
  const catClass = 'cat-' + dish.category.replace(/[^а-яa-z]/gi, '');
  gameCatTag.className = 'cat-tag ' + catClass;

  gameDishName.textContent = dish.name;

  // --- Генерация тегов вкуса (поддержка массива) ---
  const oldTags = document.querySelector('.game-card .taste-tags');
  if (oldTags) oldTags.remove();

  const tasteValues = getTasteArray(dish.taste);
  if (currentMenuType === 'kitchen' && tasteValues.length > 0) {
    const container = document.createElement('div');
    container.className = 'taste-tags';
    tasteValues.forEach(t => {
      const tag = document.createElement('span');
      tag.className = 'taste-tag taste-' + t;
      tag.textContent = t;
      container.appendChild(tag);
    });
    const nameEl = document.getElementById('game-dish-name');
    nameEl.parentNode.insertBefore(container, nameEl.nextSibling);
  }

  let badgeHtml = '';
  if (currentMenuType === 'bar' && dish.number) {
    badgeHtml += `<span class="dish-number">${escapeHtml(dish.number)}</span>`;
    if (dish.icon) {
      badgeHtml += `<img src="assets/${dish.icon}.svg" class="dish-icon" alt="иконка бокала">`;
    }
  }
  dishBadge.innerHTML = badgeHtml;

  groupSauceEl.style.display = (dish.sauce && dish.sauce.length) ? "" : "none";

  renderDots();
  renderGuessLists();
  guessInput.value = "";
  setTimeout(() => {
    guessInput.focus();
    if (window.innerWidth <= 640) {
      guessInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
  }, 200);
}

function renderDots() {
  dotsContentEl.innerHTML = current.contentState.map(i =>
    `<span class="dot ${i.found ? "filled" : ""}">${CHECK_SVG}</span>`
  ).join("");
  dotsSauceEl.innerHTML = current.sauceState.map(i =>
    `<span class="dot ${i.found ? "filled" : ""}">${CHECK_SVG}</span>`
  ).join("");
}

function renderGuessLists() {
  listContentEl.innerHTML = current.contentState.map(i => guessListItem(i)).join("");
  listSauceEl.innerHTML = current.sauceState.map(i => guessListItem(i)).join("");
}

function guessListItem(item) {
  const shown = item.found || revealMode;
  const cls = ["", item.found ? "found" : "", revealMode && !item.found ? "revealed" : ""].join(" ").trim();
  const text = shown ? escapeHtml(item.full) : "— пока не угадано —";
  const icon = item.found ? CHECK_SVG : "";
  return `<li class="${cls}"><span class="slot-icon">${icon}</span><span class="ingredient-text">${text}</span></li>`;
}

function allFound() {
  return current.contentState.every(i => i.found) && current.sauceState.every(i => i.found);
}

function tryGuess(raw) {
  const norm = normalize(raw);
  if (!norm) return;

  const pools = [
    { state: current.contentState },
    { state: current.sauceState },
  ];

  for (const pool of pools) {
    for (const item of pool.state) {
      if (item.found) continue;
      if (fuzzyMatch(raw, item.label)) {
        item.found = true;
        streak++;
        statStreak.textContent = streak;
        renderDots();
        renderGuessLists();
        feedbackEl.textContent = "Верно — «" + item.label + "»";
        feedbackEl.className = "game-feedback ok";
        guessInput.value = "";

        if (allFound()) {
          const key = getProgressKey();
          if (!progress[key].includes(current.dish.id)) {
            progress[key].push(current.dish.id);
            updateLearnedStat();
          }
          setTimeout(showComplete, 350);
        }
        return;
      }
    }
  }

  const alreadyGuessed = [...current.contentState, ...current.sauceState]
    .some(i => i.found && fuzzyMatch(raw, i.label));

  streak = 0;
  statStreak.textContent = 0;
  guessInput.classList.remove("shake");
  void guessInput.offsetWidth;
  guessInput.classList.add("shake");

  if (alreadyGuessed) {
    feedbackEl.textContent = "Этот ингредиент уже угадан";
    feedbackEl.className = "game-feedback info";
  } else {
    feedbackEl.textContent = "Не совпадает, попробуйте ещё";
    feedbackEl.className = "game-feedback bad";
  }
}

function showComplete() {
  gameCardEl.classList.add("hidden");
  gameCompleteEl.classList.remove("hidden");
  completeDishName.textContent = current.dish.name;
}

guessForm.addEventListener("submit", (e) => {
  e.preventDefault();
  tryGuess(guessInput.value);
});

btnReveal.addEventListener("click", () => {
  revealMode = !revealMode;
  btnReveal.textContent = revealMode ? "Скрыть состав" : "Показать состав";
  renderGuessLists();
});

btnSkip.addEventListener("click", nextCard);
btnNext.addEventListener("click", nextCard);

// ---------- SWIPE SUPPORT ----------
let touchStartX = 0;
let touchStartY = 0;
const SWIPE_THRESHOLD = 60;

gameCardEl.addEventListener('touchstart', (e) => {
  const touch = e.touches[0];
  touchStartX = touch.clientX;
  touchStartY = touch.clientY;
}, { passive: true });

gameCardEl.addEventListener('touchend', (e) => {
  if (!touchStartX) return;
  const touchEnd = e.changedTouches[0];
  const dx = touchEnd.clientX - touchStartX;
  const dy = touchEnd.clientY - touchStartY;
  if (Math.abs(dy) > Math.abs(dx) * 1.2) return;
  if (Math.abs(dx) < SWIPE_THRESHOLD) return;

  if (dx > 0) {
    btnReveal.click();
  } else {
    btnSkip.click();
  }
  touchStartX = 0;
}, { passive: true });

function getTasteArray(taste) {
  if (!taste) return [];
  if (Array.isArray(taste)) return taste;
  return [taste];
}

// ---------- СТАРТ! ----------
loadAllData();