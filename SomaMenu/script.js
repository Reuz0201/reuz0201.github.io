// =============================================================
// МЕНЮ КУХНИ — ГИД ПО СОСТАВУ (загрузка из menu.json)
// =============================================================

let DISHES = [];
let progress = { learned: [] };
let gameStarted = false;
let deck = [];
let deckPointer = 0;
let current = null;
let streak = 0;
let revealMode = false;
const STORAGE_KEY = "menu-guide-progress-v1";

const CATEGORY_ORDER = [
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

// ---------- загрузка данных ----------
async function loadDishes() {
  try {
    const response = await fetch('menu.json');
    if (!response.ok) throw new Error('Ошибка загрузки menu.json');
    const data = await response.json();
    DISHES = data;
    DISHES.forEach((d, i) => { d.id = i; });
    loadProgress();
    initApp();
  } catch (error) {
    console.error('Не удалось загрузить меню:', error);
    document.body.innerHTML = '<p style="color:red;text-align:center;padding:40px;">❌ Ошибка загрузки данных. Проверьте файл menu.json.</p>';
  }
}

// ---------- прогресс ----------
function loadProgress() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (saved) progress = saved;
  } catch (e) {}
}
function saveProgress() {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(progress)); } catch (e) {}
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
  const switchButtons = document.querySelectorAll(".switch-btn");
  const browseView = document.getElementById("browse-view");
  const gameView = document.getElementById("game-view");

  switchButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      switchButtons.forEach(b => { b.classList.remove("is-active"); b.setAttribute("aria-selected", "false"); });
      btn.classList.add("is-active");
      btn.setAttribute("aria-selected", "true");
      const view = btn.dataset.view;
      browseView.classList.toggle("hidden", view !== "browse");
      gameView.classList.toggle("hidden", view !== "game");
      if (view === "game" && !gameStarted) startGame();
    });
  });

  buildCategoryChips();
  renderDishGrid();
  document.getElementById("search-input").addEventListener("input", renderDishGrid);

  buildGameCategoryOptions();
  if (!gameView.classList.contains("hidden")) startGame();
}

// ---------- BROWSE VIEW ----------
const dishGrid = document.getElementById("dish-grid");
const searchInput = document.getElementById("search-input");
const categoryChipsEl = document.getElementById("category-chips");
const browseEmpty = document.getElementById("browse-empty");
let activeCategory = "Все";

function buildCategoryChips() {
  const cats = ["Все", ...CATEGORY_ORDER.filter(c => DISHES.some(d => d.category === c))];
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

function renderDishGrid() {
  const query = normalize(searchInput.value);
  const filtered = DISHES.filter(d => {
    if (activeCategory !== "Все" && d.category !== activeCategory) return false;
    if (!query) return true;
    const haystack = normalize(
      d.name + " " + d.content.map(i => i.full).join(" ") + " " + d.sauce.map(i => i.full).join(" ")
    );
    return haystack.includes(query);
  });

  browseEmpty.classList.toggle("hidden", filtered.length !== 0);
  dishGrid.innerHTML = filtered.map(d => `
    <article class="dish-card">
      <div class="card-top">
        <span class="ticket-no">№${String(d.id + 1).padStart(3, "0")}</span>
        <span class="cat-tag">${escapeHtml(d.category)}</span>
      </div>
      <h3 class="dish-name">${escapeHtml(d.name)}</h3>
      <div class="comp-block content-block">
        <h4>Содержимое</h4>
        <ul>${d.content.map(ingredientLine).join("")}</ul>
      </div>
      ${d.sauce.length ? `
      <div class="comp-block sauce-block">
        <h4>Соус <span class="sub">(заправка)</span></h4>
        <ul>${d.sauce.map(ingredientLine).join("")}</ul>
      </div>` : ""}
    </article>
  `).join("");
}

// ---------- GAME VIEW ----------
const gameCategorySelect = document.getElementById("game-category");
const statLearned = document.getElementById("stat-learned");
const statStreak = document.getElementById("stat-streak");
const statRemaining = document.getElementById("stat-remaining");

const gameCardEl = document.getElementById("game-card");
const gameCompleteEl = document.getElementById("game-complete");
const gameTicketNo = document.getElementById("game-ticket-no");
const gameCatTag = document.getElementById("game-cat-tag");
const gameDishName = document.getElementById("game-dish-name");
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
  const cats = ["Все категории", ...CATEGORY_ORDER.filter(c => DISHES.some(d => d.category === c))];
  gameCategorySelect.innerHTML = cats.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

function buildDeck() {
  const cat = gameCategorySelect.value;
  const pool = DISHES.filter(d => cat === "Все категории" || d.category === cat);
  deck = shuffle(pool.map(d => d.id));
  deckPointer = 0;
  updateRemainingStat();
}

function updateRemainingStat() {
  statRemaining.textContent = Math.max(deck.length - deckPointer, 0);
}

function updateLearnedStat() {
  statLearned.textContent = progress.learned.length;
}

function startGame() {
  gameStarted = true;
  buildDeck();
  updateLearnedStat();
  nextCard();
}

gameCategorySelect.addEventListener("change", () => {
  buildDeck();
  nextCard();
});

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
    gameDishName.textContent = "Нет блюд в этой категории";
    listContentEl.innerHTML = "";
    listSauceEl.innerHTML = "";
    dotsContentEl.innerHTML = "";
    dotsSauceEl.innerHTML = "";
    return;
  }

  const dishId = deck[deckPointer];
  deckPointer++;
  updateRemainingStat();

  const dish = DISHES[dishId];
  current = {
    dish,
    contentState: dish.content.map(i => ({ ...i, found: false })),
    sauceState: dish.sauce.map(i => ({ ...i, found: false })),
  };

  gameTicketNo.textContent = "№" + String(dish.id + 1).padStart(3, "0");
  gameCatTag.textContent = dish.category;
  gameDishName.textContent = dish.name;

  groupSauceEl.style.display = dish.sauce.length ? "" : "none";

  renderDots();
  renderGuessLists();
  guessInput.value = "";
  // автофокус и прокрутка к полю ввода (для мобильных)
  setTimeout(() => {
    guessInput.focus();
    // на мобильных клавиатура может перекрыть поле, прокрутим к нему
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
      if (normalize(item.label) === norm) {
        item.found = true;
        streak++;
        statStreak.textContent = streak;
        renderDots();
        renderGuessLists();
        feedbackEl.textContent = "Верно — «" + item.label + "»";
        feedbackEl.className = "game-feedback ok";
        guessInput.value = "";

        if (allFound()) {
          if (!progress.learned.includes(current.dish.id)) {
            progress.learned.push(current.dish.id);
            saveProgress();
            updateLearnedStat();
          }
          setTimeout(showComplete, 350);
        }
        return;
      }
    }
  }

  const alreadyGuessed = [...current.contentState, ...current.sauceState]
    .some(i => i.found && normalize(i.label) === norm);

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

// ---------- SWIPE SUPPORT (мобильная навигация) ----------
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
  // если вертикальное смещение больше, не считаем свайпом
  if (Math.abs(dy) > Math.abs(dx) * 1.2) return;
  if (Math.abs(dx) < SWIPE_THRESHOLD) return;

  if (dx > 0) {
    // свайп вправо → показать состав (как кнопка Reveal)
    btnReveal.click();
  } else {
    // свайп влево → пропустить (skip)
    btnSkip.click();
  }
  touchStartX = 0;
}, { passive: true });

// если карточка скрыта (complete), не мешаем
gameCompleteEl.addEventListener('touchstart', (e) => {
  // можно игнорировать
}, { passive: true });

// ---------- СТАРТ! ----------
loadDishes();