// ===== Настройки сайта: поменяй под себя =====
const BOT_NAME = "Jeffrey Mogger";
const INVITE_URL = "https://discord.com/oauth2/authorize?client_id=1330316424731824128";
const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

document.querySelectorAll(".bot-name").forEach(el => (el.textContent = BOT_NAME));
document.querySelectorAll(".invite-link").forEach(a => (a.href = INVITE_URL));

const $ = id => document.getElementById(id);
const fmt = n => n.toLocaleString("ru-RU");

// ===== Панель плеера =====
const FILTERS = [
  ["slowed", "slowed", false], ["bassboost", "bassboost", false],
  ["reverb", "reverb", true], ["speedup", "speedup", true], ["nightcore", "nightcore", true],
  ["8d", "8d", true], ["vaporwave", "vaporwave", true], ["slowedreverb", "slowed + reverb", true],
];
const player = { len: 213, cur: 37, paused: false, vol: 80, loop: 0, filter: null };
const LOOPS = ["выкл", "трек", "очередь"];
const mmss = s => `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, "0")}`;

function renderPlayer() {
  $("t-cur").textContent = mmss(player.cur);
  $("t-len").textContent = mmss(player.len);
  $("t-bar").style.width = (player.cur / player.len) * 100 + "%";
  $("vol").textContent = player.vol + "%";
  $("loop").textContent = LOOPS[player.loop];
  $("b-loop").classList.toggle("on", player.loop > 0);
  $("b-pause").textContent = player.paused ? "▶ Играть" : "⏸ Пауза";
  $("b-pause").classList.toggle("green", player.paused);
  $("state-label").textContent = player.paused ? "⏸ На паузе" : "▶ Сейчас играет";
  $("eq").classList.toggle("off", player.paused);
  const f = FILTERS.find(x => x[0] === player.filter);
  $("flt").textContent = f ? f[1] : "нет";
}

const chips = $("filters");
FILTERS.forEach(([key, label, prem]) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "chip";
  b.innerHTML = label + (prem ? ' <span class="star">★</span>' : "");
  b.addEventListener("click", () => {
    player.filter = player.filter === key ? null : key;
    chips.querySelectorAll(".chip").forEach(c => c.classList.toggle("on", c === b && player.filter));
    $("flt-cmd").textContent = "/" + key;
    renderPlayer();
  });
  chips.append(b);
});

$("b-pause").onclick = () => { player.paused = !player.paused; renderPlayer(); };
$("b-skip").onclick = () => { player.cur = 0; renderPlayer(); };
$("b-loop").onclick = () => { player.loop = (player.loop + 1) % 3; renderPlayer(); };
$("b-vdown").onclick = () => { player.vol = Math.max(0, player.vol - 10); renderPlayer(); };
$("b-vup").onclick = () => { player.vol = Math.min(150, player.vol + 10); renderPlayer(); };
$("b-lyrics").onclick = () => {
  $("b-lyrics").textContent = "📜 We're no strangers to love…";
  setTimeout(() => ($("b-lyrics").textContent = "📜 Текст"), 2500);
};

setInterval(() => {
  if (player.paused) return;
  const speed = { slowed: 0.8, vaporwave: 0.75, slowedreverb: 0.8, speedup: 1.25, nightcore: 1.3 }[player.filter] || 1;
  player.cur += speed;
  if (player.cur >= player.len) player.cur = player.loop ? 0 : player.len - 1;
  renderPlayer();
}, 1000);
renderPlayer();

// Ноты вылетают из панели, пока играет музыка
const stage = document.querySelector(".discord-window");
setInterval(() => {
  if (player.paused || reduceMotion || document.hidden) return;
  const n = document.createElement("span");
  n.className = "note";
  n.textContent = ["♪", "♫", "♬", "♩"][Math.floor(Math.random() * 4)];
  n.style.left = 20 + Math.random() * 60 + "%";
  n.style.top = "45%";
  n.style.setProperty("--dx", (Math.random() * 80 - 40) + "px");
  n.style.setProperty("--rot", (Math.random() * 60 - 30) + "deg");
  stage.append(n);
  setTimeout(() => n.remove(), 2500);
}, 900);

// ===== Фоны карточек (цены и цвета из utils/cards.py) =====
const BACKGROUNDS = [
  ["Тёмный", 0, ["#1e2124", "#2c2f33", "#36393e"], "#5865F2"],
  ["Ночь", 2000, ["#0f2027", "#203a43", "#2c5364"], "#7dd3fc"],
  ["Океан", 3000, ["#1a2980", "#2193b0", "#6dd5ed"], "#e0f7ff"],
  ["Лес", 3000, ["#0b3d2e", "#134e5e", "#71b280"], "#b7f7c4"],
  ["Закат", 3000, ["#2b1055", "#ff5e62", "#ff9966"], "#ffd166"],
  ["Сакура", 5000, ["#6a3093", "#ff8fab", "#ffc3a0"], "#ffe5ec"],
  ["Неон", 5000, ["#10002b", "#7209b7", "#f72585"], "#4cc9f0"],
  ["Матрица", 7500, ["#000000", "#001a00", "#002b00"], "#00ff66"],
  ["Космос", 7500, ["#000428", "#004e92", "#1b1b3a"], "#c7a2ff"],
  ["Кровавая луна", 10000, ["#0d0d0d", "#3a0000", "#8b0000"], "#ff4d4d"],
  ["Золото", 15000, ["#5c4314", "#b38728", "#fcf6ba"], "#fff3b0"],
];
const grad = c => `linear-gradient(120deg, ${c.join(", ")})`;
const bgList = $("bg-list");
const cardEls = [$("mini-rank"), $("pcard")];
function pickBg(i) {
  const [, , colors, acc] = BACKGROUNDS[i];
  cardEls.forEach(el => {
    el.style.background = grad(colors);
    el.style.setProperty("--acc", acc);
  });
  bgList.querySelectorAll(".bg").forEach((b, j) => {
    b.classList.toggle("on", i === j);
    b.setAttribute("aria-checked", i === j);
  });
}
BACKGROUNDS.forEach(([name, price, colors], i) => {
  const b = document.createElement("button");
  b.type = "button";
  b.className = "bg";
  b.setAttribute("role", "radio");
  b.style.background = grad(colors);
  b.innerHTML = `${name}<small>${price ? "🪙 " + fmt(price) : "бесплатно"}</small>`;
  b.onclick = () => pickBg(i);
  bgList.append(b);
});
pickBg(10);

// ===== Команды =====
// [команда, префикс-вариант, описание, premium]
const COMMANDS = {
  "Музыка": [
    ["play <запрос>", "p", "включить трек или плейлист"], ["scplay <запрос>", "sc", "поиск на SoundCloud"],
    ["skip", "s", "следующий трек"], ["queue", "q", "очередь"], ["nowplaying", "np", "что играет"],
    ["seek 1:30", null, "перемотка, можно +15 или -10"], ["volume 80", "vol", "громкость"],
    ["loop track|queue", null, "повтор"], ["lyrics", null, "текст песни"], ["leave", "dc", "выйти из войса"],
    ["shuffle", null, "перемешать очередь", 1], ["autoplay on", null, "похожие треки после очереди", 1],
    ["247", null, "бот не уходит из войса", 1], ["playlist play чилл", "pl", "личные плейлисты", 1],
  ],
  "Фильтры": [
    ["slowed", null, "замедлить"], ["bassboost", "bb", "басы"], ["filters", null, "активные фильтры"],
    ["resetfilters", "rf", "сбросить всё"], ["reverb", null, "эхо зала", 1], ["nightcore", null, "быстрее и выше", 1],
    ["speedup", null, "ускорить", 1], ["8d", null, "звук по кругу", 1], ["vaporwave", null, "ретро-звук", 1],
    ["slowedreverb", null, "slowed + reverb", 1],
  ],
  "Модерация": [
    ["kick @чел", null, "выгнать"], ["ban @чел", null, "забанить"], ["mute @чел 10m", null, "замутить"],
    ["warn @чел", null, "выдать варн"], ["warns @чел", null, "список варнов"], ["clear 50", null, "удалить сообщения"],
    ["slowmode 10", null, "медленный режим"], ["lock", null, "закрыть канал"],
    ["tempban @чел 1d", null, "бан на время", 1], ["automod toggle", null, "фильтр слов и спама", 1],
    ["modsettings logchannel", null, "лог модерации", 1],
  ],
  "Экономика": [
    ["balance", "bal", "кошелёк и банк"], ["daily", null, "200 монет + бонус за серию"], ["work", null, "раз в час"],
    ["crime", null, "риск и награда"], ["rob @чел", null, "украсть монеты"], ["pay @чел 100", null, "перевод"],
    ["deposit all", null, "положить в банк"], ["shop", null, "магазин сервера"], ["richest", null, "богачи"],
  ],
  "Игры": [
    ["slots 100", null, "до x50"], ["blackjack 200", null, "Ещё / Хватит / Удвоить"], ["coinflip half", null, "орёл или решка"],
    ["duel @чел 500", null, "дуэль на монеты"], ["casino roulette 100 red", "roulette", "рулетка"],
    ["casino crash 100", "crash", "забери до взрыва"], ["casino mines 100 3", "mines", "сапёр"],
    ["quiz start рэп 10", null, "угадай мелодию"],
  ],
  "Прогресс": [
    ["rank", null, "карточка уровня"], ["leaderboard", "top", "таблица лидеров"], ["profile", null, "карточка профиля"],
    ["quests", null, "задания на сегодня"], ["achievements", null, "все достижения"], ["background buy неон", "bg", "фоны карточек"],
    ["pet buy кот Барсик", null, "завести питомца"], ["pet collect", null, "забрать монеты"],
    ["levels reward 10 @роль", null, "роль за уровень", 1],
  ],
  "Веселье": [
    ["marry @чел", null, "сделать предложение"], ["ship @a @b", null, "совместимость"], ["8ball вопрос", null, "магический шар"],
    ["roll 2d20", null, "кубики"], ["hug @чел", null, "обнять гифкой"], ["pat @чел", null, "погладить"],
    ["highfive @чел", null, "дать пять"], ["dance", null, "потанцевать"],
  ],
};
let prefix = "/";
let tab = "Музыка";
const tabs = $("tabs");
const list = $("cmd-list");

function renderCommands() {
  tabs.querySelectorAll(".tab").forEach(t => {
    t.classList.toggle("on", t.dataset.t === tab);
    t.setAttribute("aria-selected", t.dataset.t === tab);
  });
  list.innerHTML = "";
  COMMANDS[tab].forEach(([cmd, alias, desc, prem]) => {
    let shown = cmd;
    if (prefix === "!" && cmd.startsWith("casino ")) shown = cmd.slice(7);
    else if (prefix === "!" && alias) shown = alias + cmd.slice(cmd.split(" ")[0].length);
    const li = document.createElement("li");
    li.innerHTML = `<code></code><span></span>`;
    li.querySelector("code").textContent = prefix + shown;
    li.querySelector("span").innerHTML = desc + (prem ? ' <span class="star">★</span>' : "");
    list.append(li);
  });
}
Object.keys(COMMANDS).forEach(name => {
  const t = document.createElement("button");
  t.type = "button";
  t.className = "tab";
  t.role = "tab";
  t.dataset.t = name;
  t.textContent = name;
  t.onclick = () => { tab = name; renderCommands(); };
  tabs.append(t);
});
document.querySelectorAll(".toggle button").forEach(b => {
  b.onclick = () => {
    prefix = b.dataset.p;
    document.querySelectorAll(".toggle button").forEach(x => x.classList.toggle("on", x === b));
    renderCommands();
  };
});
renderCommands();

// ===== Слоты (веса и множители из cogs/games.py) =====
const SLOTS = [["🍒", 30, 3], ["🍋", 25, 4], ["🍇", 20, 5], ["🔔", 12, 8], ["⭐", 8, 12], ["7️⃣", 4, 25], ["💎", 1, 50]];
const TOTAL = SLOTS.reduce((s, x) => s + x[1], 0);
const roll = () => {
  let r = Math.random() * TOTAL;
  for (const s of SLOTS) if ((r -= s[1]) < 0) return s[0];
  return SLOTS[0][0];
};
$("paytable").innerHTML = SLOTS.map(([e, , m]) => `<span>${e}${e}${e} x${m}</span>`).join("") + "<span>пара x1.5</span>";

let wallet = 1000;
let bet = 100;
const BETS = [10, 50, 100, 250, 500];
const renderWallet = () => { $("wallet").textContent = fmt(wallet); $("bet").textContent = bet; };
$("bet-up").onclick = () => { bet = BETS[Math.min(BETS.length - 1, BETS.indexOf(bet) + 1)]; renderWallet(); };
$("bet-down").onclick = () => { bet = BETS[Math.max(0, BETS.indexOf(bet) - 1)]; renderWallet(); };

$("spin").onclick = () => {
  const res = $("result");
  if (wallet < bet) {
    wallet = 1000;
    renderWallet();
    res.className = "result";
    res.textContent = "Монеты кончились. В боте выручит /daily, а здесь мы просто вернули тысячу.";
    return;
  }
  wallet -= bet;
  renderWallet();
  const reels = [0, 1, 2].map(i => $("r" + i));
  const out = [roll(), roll(), roll()];
  $("spin").disabled = true;
  reels.forEach(r => r.classList.add("spin"));
  const ticker = setInterval(() => reels.forEach(r => r.classList.contains("spin") && (r.textContent = roll())), 70);
  reels.forEach((r, i) => setTimeout(() => {
    r.classList.remove("spin");
    r.textContent = out[i];
    if (i === 2) {
      clearInterval(ticker);
      $("spin").disabled = false;
      let mult = 0;
      if (out[0] === out[1] && out[1] === out[2]) mult = SLOTS.find(s => s[0] === out[0])[2];
      else if (out[0] === out[1] || out[1] === out[2] || out[0] === out[2]) mult = 1.5;
      const win = Math.floor(bet * mult);
      wallet += win;
      renderWallet();
      if (win) {
        $("wallet").classList.remove("bump"); void $("wallet").offsetWidth; $("wallet").classList.add("bump");
        reels.forEach((r, j) => {
          const hit = mult > 1.5 || out.filter(x => x === out[j]).length > 1;
          if (hit) { r.classList.remove("hit"); void r.offsetWidth; r.classList.add("hit"); }
        });
        coinRain(mult >= 8 ? 60 : mult > 1.5 ? 30 : 12);
      }
      res.className = "result " + (win ? "win" : "lose");
      res.textContent = win ? `Выигрыш ${fmt(win)} 🪙 (x${mult})` : `Мимо, минус ${bet} 🪙`;
    }
  }, 500 + i * 300));
};
renderWallet();

// ===== Питомцы (из cogs/pets.py) =====
const PETS = [["🐹", "Хомяк", 500, 15], ["🐱", "Кот", 1500, 35], ["🐶", "Собака", 1500, 35], ["🦊", "Лиса", 3000, 60],
  ["🐼", "Панда", 5000, 90], ["🦄", "Единорог", 10000, 160], ["🐉", "Дракон", 20000, 300]];
$("pet-list").innerHTML = PETS.map(([e, n, p, inc]) =>
  `<li><span class="e">${e}</span><span>${n}</span><span class="inc">+${inc}/ч</span><span class="price">🪙 ${fmt(p)}</span></li>`).join("");


function coinRain(count) {
  if (reduceMotion) return;
  const box = $("coin-rain");
  const h = box.clientHeight + 60;
  for (let i = 0; i < count; i++) {
    const c = document.createElement("span");
    c.textContent = "🪙";
    c.style.left = Math.random() * 100 + "%";
    c.style.animationDelay = Math.random() * 0.6 + "s";
    c.style.setProperty("--fy", h + "px");
    c.style.setProperty("--rot", (Math.random() * 720 - 360) + "deg");
    box.append(c);
    setTimeout(() => c.remove(), 2200);
  }
}

// ===== Бегущая строка команд =====
const MARQUEE = ["play", "slowed", "bassboost", "nightcore", "8d", "daily", "work", "slots", "blackjack", "casino crash",
  "quiz start", "pet feed", "rank", "profile", "quests", "achievements", "marry", "ship", "warn", "automod", "playlist play", "lyrics"];
$("marquee").innerHTML = [...MARQUEE, ...MARQUEE].map(c => `<span><b>/</b>${c}</span>`).join("");

// ===== Появление при прокрутке, счётчики, полоски опыта =====
const io = "IntersectionObserver" in window ? new IntersectionObserver(entries => {
  entries.forEach(e => {
    if (!e.isIntersecting) return;
    e.target.classList.remove("pre");
    io.unobserve(e.target);
    setTimeout(() => (e.target.style.transitionDelay = ""), 1200);
  });
}, { threshold: 0.12 }) : null;

if (io && !reduceMotion) {
  document.querySelectorAll(".reveal").forEach(el => {
    if (el.getBoundingClientRect().top < window.innerHeight) return; // то, что уже на экране, не прячем
    const sibs = [...el.parentElement.children].filter(x => x.classList.contains("reveal"));
    el.style.transitionDelay = Math.min(sibs.indexOf(el), 6) * 70 + "ms";
    el.classList.add("pre");
    io.observe(el);
  });
}

function countUp(el) {
  const target = +el.dataset.count;
  if (reduceMotion) return;
  const t0 = performance.now();
  const step = t => {
    const k = Math.min(1, (t - t0) / 1400);
    el.textContent = Math.round(target * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}
const once = (els, fn) => {
  if (!io) { els.forEach(fn); return; }
  const o = new IntersectionObserver(es => es.forEach(e => { if (e.isIntersecting) { fn(e.target); o.unobserve(e.target); } }), { threshold: 0.4 });
  els.forEach(el => o.observe(el));
};
once(document.querySelectorAll("[data-count]"), countUp);
once(cardEls, el => el.classList.add("filled"));
if (!io) cardEls.forEach(el => el.classList.add("filled"));

// Свечение карточек возможностей за курсором
document.querySelectorAll(".feature").forEach(f => {
  f.addEventListener("pointermove", e => {
    const r = f.getBoundingClientRect();
    f.style.setProperty("--mx", e.clientX - r.left + "px");
    f.style.setProperty("--my", e.clientY - r.top + "px");
  });
});
