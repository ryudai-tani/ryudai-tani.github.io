// 時刻はバスなび沖縄の時刻表（2026年10月4日に確認）から写したもの。
// 日祝の列の印：h＝祝日だけ走る、s＝日曜だけ走る（開南経由）。印のない時刻は日曜・祝日とも走る。
// 日曜の12〜18時は国際通りがトランジットモールになり、バスは開南経由で走る。行きの s は開南（与儀十字路向け）発の時刻。
const TIMES = {
  go: { // ホテルコレクティブ前（安謝・古島向け）発
    97: {
      weekday: "6:19 6:48 7:20 7:54 8:22 8:52 9:24 9:50 10:43 11:42 12:17 12:55 13:27 14:05 14:42 15:19 16:04 16:35 17:14 17:54 18:32 19:19 20:14 21:07",
      sat: "6:49 7:49 8:50 9:52 10:52 11:52 12:55 13:47 14:42 15:37 16:43 17:46 18:37 20:11",
      sunhol: "6:49 7:49 8:50 9:50 10:50 11:50 12:54h 13:45h 14:41h 15:39h 16:44h 17:45h 12:53s 13:45s 14:40s 15:39s 16:44s 17:44s 18:39 20:12",
    },
    98: {
      weekday: "6:38 7:04 7:41 8:13 8:38 8:54 9:33 10:09 10:39 11:10 11:45 12:20 13:25 14:05 14:47 15:53 16:33 17:13 17:59 19:00 20:10 21:07 22:05",
      sat: "7:38 8:08 8:56 9:39 10:39 11:45 13:20 14:10 14:54 15:45 16:41 17:31 18:54 20:11 21:36",
      sunhol: "7:38 8:08 8:56 9:39 10:39 11:45 13:20h 14:10h 14:54h 15:45h 16:41h 17:31h 13:19s 14:09s 14:56s 15:46s 16:40s 17:30s 18:54 20:11 21:36",
    },
  },
  back: { // 琉大北口駐車場（那覇・豊崎向け）発
    97: {
      weekday: "6:30 6:55 7:20 7:50 8:35 9:20 10:05 11:15 11:50 12:20 12:50 13:20 14:00 14:40 15:15 15:50 16:25 17:00 17:45 18:30 19:15 20:05 21:00",
      sat: "7:15 8:15 9:15 10:15 11:15 12:15 12:50 13:25 14:25 15:00 15:45 16:30 17:20 18:20 19:25",
      sunhol: "7:15 8:15 9:15 10:15 11:15s 11:15h 12:15h 12:15s 12:50h 12:50s 13:25s 13:25h 14:25h 14:25s 15:00s 15:00h 15:45s 15:45h 16:30h 16:30s 17:20 18:20 19:25",
    },
    98: {
      weekday: "6:00 6:25 6:50 7:20 7:50 8:25 9:05 9:45 10:25 11:00 11:50 12:25 13:05 13:45 14:15 14:45 15:25 16:10 17:20 18:10 19:00 19:40 20:30 21:30",
      sat: "6:30 7:20 8:00 8:40 9:20 10:20 11:20 12:20 13:10 14:00 14:50 15:40 16:25 17:10 18:10 19:10 20:30",
      sunhol: "6:30 7:20 8:00 8:40 9:20 10:20 11:20s 11:20h 12:20s 12:20h 13:10h 13:10s 14:00s 14:00h 14:50h 14:50s 15:40h 15:40s 16:25s 16:25h 17:10s 17:10h 18:10 19:10 20:30",
    },
  },
};

// 国民の祝日（内閣府「国民の祝日について」）。振替休日・国民の休日を含む。
const HOLIDAYS = new Set([
  "2026-01-01","2026-01-12","2026-02-11","2026-02-23","2026-03-20","2026-04-29","2026-05-03","2026-05-04","2026-05-05","2026-05-06",
  "2026-07-20","2026-08-11","2026-09-21","2026-09-22","2026-09-23","2026-10-12","2026-11-03","2026-11-23",
  "2027-01-01","2027-01-11","2027-02-11","2027-02-23","2027-03-21","2027-03-22","2027-04-29","2027-05-03","2027-05-04","2027-05-05",
  "2027-07-19","2027-08-11","2027-09-20","2027-09-23","2027-10-11","2027-11-03","2027-11-23",
]);

const WHERE = {
  go: "https://www.busnavi-okinawa.com/top/Approach?sid=bc2d9079-4fa6-46a9-a22c-cd427c62cbf6&goalCd=1554",
  back: "https://www.busnavi-okinawa.com/top/Approach?sid=599b8085-e476-404d-b692-e6a52e826898",
};
const STOP = { go: "ホテルコレクティブ前", back: "琉大北口駐車場" };
const DAY_LABEL = { weekday: "平日", sat: "土曜", sun: "日曜", hol: "祝日" };

const $ = (id) => document.getElementById(id);
const pad = (n) => String(n).padStart(2, "0");
const ymd = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

function dayType(d) {
  if (HOLIDAYS.has(ymd(d))) return "hol";
  const w = d.getDay();
  return w === 0 ? "sun" : w === 6 ? "sat" : "weekday";
}

// その日に走る便を、時刻順に [{min, route, kainan}] で返す
function trips(dir, day) {
  const list = [];
  for (const route of ["97", "98"]) {
    const col = day === "weekday" ? "weekday" : day === "sat" ? "sat" : "sunhol";
    for (const tok of TIMES[dir][route][col].split(" ")) {
      const flag = tok.slice(-1);
      if (flag === "h" && day !== "hol") continue;
      if (flag === "s" && day !== "sun") continue;
      const [h, m] = tok.replace(/[hs]$/, "").split(":").map(Number);
      list.push({ min: h * 60 + m, route, kainan: flag === "s" });
    }
  }
  return list.sort((a, b) => a.min - b.min || a.route - b.route);
}

const stopOf = (t) => (t.kainan && state.dir === "go" ? "開南" : STOP[state.dir]);
const hm = (min) => `${Math.floor(min / 60)}:${pad(min % 60)}`;

const state = { dir: "go", day: null };
try {
  const saved = localStorage.getItem("ryudai-bus-dir");
  if (saved === "go" || saved === "back") state.dir = saved;
} catch (e) {}

function renderNext() {
  const now = new Date();
  const today = dayType(now);
  const nowMin = now.getHours() * 60 + now.getMinutes();
  $("clock").textContent = `${now.getHours()}:${pad(now.getMinutes())}`;
  $("daytype").textContent = `今日は${DAY_LABEL[today]}のダイヤ`;

  const upcoming = trips(state.dir, today).filter((t) => t.min >= nowMin).slice(0, 4);
  const ul = $("next");
  ul.innerHTML = "";
  if (!upcoming.length) {
    const tomorrow = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
    const first = trips(state.dir, dayType(tomorrow))[0];
    ul.innerHTML = `<li class="empty">今日の${STOP[state.dir]}発のバスは終わりました。${first ? `明日の始発は ${hm(first.min)}（${first.route}番）です。` : ""}</li>`;
    return;
  }
  upcoming.forEach((t, i) => {
    const wait = t.min - nowMin;
    const li = document.createElement("li");
    li.className = "bus" + (i === 0 ? " first" : "");
    li.innerHTML =
      `<span class="badge r${t.route}">${t.route}</span>` +
      `<span class="time num">${hm(t.min)}</span>` +
      `<span class="left"><span>あと</span><br>${wait >= 60 ? `<b>${Math.floor(wait / 60)}</b><span>時間</span><b>${wait % 60}</b>` : `<b>${wait}</b>`}<span>分</span></span>` +
      `<span class="sub">${stopOf(t)} 発${t.kainan ? `<span class="tag">${state.dir === "go" ? "国際通りを通りません" : "開南経由・ホテルコレクティブ前を通りません"}</span>` : ""}</span>`;
    ul.appendChild(li);
  });
}

function renderTable() {
  const now = new Date();
  const today = dayType(now);
  const day = state.day || today;
  const nowMin = now.getHours() * 60 + now.getMinutes();
  document.querySelectorAll(".days button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.day === day)));
  $("tt-title").textContent = `${STOP[state.dir]} 発の時刻表`;
  $("legend-k").style.display = day === "sun" ? "" : "none";

  const byHour = new Map();
  for (const t of trips(state.dir, day)) {
    const h = Math.floor(t.min / 60);
    if (!byHour.has(h)) byHour.set(h, []);
    byHour.get(h).push(t);
  }
  const tb = $("tt");
  tb.innerHTML = "";
  for (const [h, list] of byHour) {
    const tr = document.createElement("tr");
    if (day === today && h === now.getHours()) tr.className = "cur";
    tr.innerHTML =
      `<td class="h">${h}</td><td class="m">` +
      list.map((t) => {
        const past = day === today && t.min < nowMin ? " past" : "";
        return `<span class="r${t.route}${past}">${pad(t.min % 60)}${t.kainan ? "<sup>開</sup>" : ""}</span>`;
      }).join("") +
      "</td>";
    tb.appendChild(tr);
  }
}

function render() {
  document.querySelectorAll(".seg button").forEach((b) => b.setAttribute("aria-pressed", String(b.dataset.dir === state.dir)));
  $("where").href = WHERE[state.dir];
  renderNext();
  renderTable();
}

document.querySelectorAll(".seg button").forEach((b) =>
  b.addEventListener("click", () => {
    state.dir = b.dataset.dir;
    try { localStorage.setItem("ryudai-bus-dir", state.dir); } catch (e) {}
    render();
  })
);
document.querySelectorAll(".days button").forEach((b) =>
  b.addEventListener("click", () => {
    state.day = b.dataset.day;
    renderTable();
  })
);

render();
setInterval(renderNext, 20000);
document.addEventListener("visibilitychange", () => { if (!document.hidden) render(); });
