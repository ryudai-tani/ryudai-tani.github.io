const RULES = window.TANI_RULES;
const STORE = "tani-check-v4";
const pos = x => Math.max(0, x);
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) {}
let state = { ruleId: saved.ruleId || RULES[0].id, program: saved.program || null, data: saved.data || {}, open: !!saved.open, fromPdf: !!saved.fromPdf };
const RAW = {};
function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} }

const rule = () => RULES.find(r => r.id === state.ruleId) || RULES[0];
const program = () => { const r = rule(); return r.programs.find(p => p.id === state.program) ? state.program : r.programs[0].id; };
function values() {
  const r = rule();
  if (!state.data[r.id]) state.data[r.id] = { v: {} };
  return state.data[r.id];
}
function def(k) { const d = rule().rows[k]; return { ...d, ...((d.program || {})[program()] || {}) }; }
function inputKeys() { return Object.keys(rule().rows).filter(k => !def(k).calc); }

/* ---------- 計算 ---------- */
function compute() {
  const r = rule(), v = values().v, p = program();
  const keys = Object.keys(r.rows);
  const S = {};
  for (const k of keys) {
    const d = def(k);
    const have = d.calc ? d.calc.sum.reduce((a, x) => a + (v[x] || 0), 0) : (v[k] || 0);
    S[k] = { d, have, eff: have, need: d.need || 0, moves: [], recv: [] };
  }
  const order = r.sections.flatMap(s => s.groups.flatMap(g => g.rows));
  // 要件を超えた分を振替先へ（並び順に流す）
  for (const k of order) {
    const s = S[k];
    if (!s.d.over) continue;
    const extra = pos(s.eff - s.need);
    if (!extra) continue;
    const t = S[s.d.over];
    t.eff += extra;
    t.recv.push({ from: s.d.name, n: extra });
    s.moves.push(`${s.need}単位を超えた${extra}単位を${t.d.name}に振り替えました`);
  }
  // 共通教育の要件を超えた分
  const ce = r.commonExcess, ceRows = ce ? ce.program[p] : [];
  let commMoved = 0;
  if (ce) {
    const excess = ceRows.reduce((a, k) => a + pos(S[k].eff - S[k].need), 0);
    const moved = Math.min(excess, ce.cap);
    commMoved = moved;
    if (moved) {
      const t = S[ce.to];
      t.eff += moved;
      t.recv.push({ from: "共通教育", n: moved });
      const last = ceRows[ceRows.length - 1];
      S[ceRows.includes("pool") ? "pool" : last].moves.push(
        `共通教育の要件を超えた${moved}単位を${t.d.name}に振り替えました${excess > ce.cap ? `（上限${ce.cap}単位。残り${excess - ce.cap}単位は卒業の単位に数えません）` : ""}`);
    }
  }
  for (const k of keys) {
    const s = S[k];
    if (s.recv.length && s.d.sink) s.moves.push(`振替により受け取った単位：${s.recv.map(x => `${x.from} ${x.n}単位`).join("、")}`);
    else if (s.recv.length) s.moves.unshift(...s.recv.map(x => `${x.from}から${x.n}単位を受け取りました`));
    s.counted = s.d.sink ? s.eff : Math.min(s.eff, s.need);
  }
  // 合計
  const secTotals = r.sections.map(sec => {
    const rows = sec.top ? sec.groups.flatMap(g => g.rows) : ceRows;
    return { sec, rows, sum: rows.reduce((a, k) => a + S[k].counted, 0) };
  });
  const topRows = secTotals.flatMap(t => t.rows);
  const total = secTotals.reduce((a, t) => a + t.sum, 0);
  const gap = k => pos(S[k].need - S[k].eff);
  const partGap = keys.filter(k => S[k].d.role === "part").reduce((a, k) => a + gap(k), 0);
  const overlayGap = Math.max(0, ...keys.filter(k => S[k].d.role === "overlay").map(gap));
  const poolGap = S.pool ? gap("pool") : 0;
  const needMore = topRows.reduce((a, k) => a + gap(k), 0) + pos(Math.max(partGap, overlayGap) - poolGap);
  const short = order.filter(k => S[k].need > 0 && S[k].eff < S[k].need);
  // 科目区分ごとに足りない単位（見出しに出す）
  // 成績表の「共通計」「専門計」と同じ、振替をする前の修得単位
  for (const t of secTotals) t.raw = t.sec.groups.flatMap(g => g.rows).filter(k => !S[k].d.calc && S[k].d.role !== "overlay").reduce((a, k) => a + S[k].have, 0);
  for (const t of secTotals) t.gap = t.rows.reduce((a, k) => a + gap(k), 0) + (t.sec.top ? 0 : pos(Math.max(partGap, overlayGap) - poolGap));
  return { S, secTotals, total, short, commMoved, remain: Math.max(pos(r.total - total), needMore) };
}

/* ---------- 表示 ---------- */
function stateHtml(s) {
  if (!s.need) return "";
  const done = s.eff >= s.need;
  const pct = Math.min(100, s.eff / s.need * 100);
  // 数字は成績表と同じ（振替の前）。達成かどうかは振替の後で決める
  const pill = !done ? `<span class="pill bad">あと <span class="num">${s.need - s.eff}</span> 単位</span>`
    : s.have < s.need ? `<span class="pill ok">振替で達成</span>` : `<span class="pill ok">達成</span>`;
  const min = s.d.role === "part" || s.d.role === "overlay";
  return `${pill}<div class="bar"><i class="${done ? "ok" : ""}" style="width:${pct}%"></i></div><span class="req num">${s.have} / ${s.need}${min || s.d.calc ? " 以上" : ""}</span>`;
}
function rowHtml(k, s) {
  const d = s.d, st = values();
  const moves = s.moves.length ? `<div class="moves">${s.moves.map(m => `<div class="move">${esc(m)}</div>`).join("")}</div>` : "";
  const field = d.calc ? `<div class="calcval num">${s.have}</div>`
    : `<input id="in-${k}" type="number" inputmode="numeric" min="0" step="1" value="${k in RAW ? esc(RAW[k]) : (st.v[k] || 0)}" aria-label="${esc(d.name)}の修得単位数">`;
  const det = d.list ? `<details><summary>対象の科目</summary><p>${esc(d.list)}</p></details>` : "";
  return `<div class="row${d.calc ? " calc" : ""}"><div class="name">${esc(d.name)}${d.hint ? `<small>${esc(d.hint)}</small>` : ""}</div>${field}<div class="state">${stateHtml(s)}</div>${moves}${det}</div>`;
}

const opts = (list, cur, label = x => x) => list.map(x => `<option value="${esc(x)}"${x === cur ? " selected" : ""}>${esc(label(x))}</option>`).join("");
function renderSelectors() {
  const r = rule();
  const years = [...new Set(RULES.map(x => x.year))].sort((a, b) => b - a);
  $("sel-year").innerHTML = opts(years, r.year, y => `${y}年度`);
  const inYear = RULES.filter(x => x.year === r.year);
  $("sel-fac").innerHTML = opts([...new Set(inYear.map(x => x.faculty))], r.faculty);
  $("sel-dept").innerHTML = opts(inYear.filter(x => x.faculty === r.faculty).map(x => x.dept), r.dept);
  $("sel-prog").innerHTML = r.programs.map(p => `<option value="${p.id}"${p.id === program() ? " selected" : ""}>${esc(p.name)}</option>`).join("");
}
// 年度・学部・学科を変えたとき、できるだけ今の選択を残して選び直す
function pickRule(year, fac, dept) {
  const c = RULES.filter(x => x.year === Number(year));
  const hit = c.find(x => x.faculty === fac && x.dept === dept) || c.find(x => x.faculty === fac) || c[0];
  if (!hit) return;
  const keepProg = rule().programs.some(p => p.id === state.program) && hit.programs.some(p => p.id === state.program);
  state.ruleId = hit.id; if (!keepProg) state.program = null;
  Object.keys(RAW).forEach(k => delete RAW[k]); save(); render();
}

function render() {
  const r = rule(), c = compute(), S = c.S, st = values();
  $("result").hidden = !state.open;
  $("manualLink").hidden = state.open;
  // 成績表を読み込んだ後は、使い方をしまって結果を先に見せる
  $("howto").hidden = state.fromPdf;
  $("loadedBar").hidden = !state.fromPdf;
  if (!state.open) return;
  renderSelectors();
  $("sections").innerHTML = c.secTotals.map(t =>
    `<section><div class="sechead"><h2>${esc(t.sec.name)}</h2><span class="sechead-r"><span class="num sec-raw">${t.raw} / ${t.sec.need}</span>${c.commMoved ? `<span class="secnote">${t.sec.top ? `＋${c.commMoved}単位（共通教育から振替）` : `−${c.commMoved}単位（専門自由科目へ振替）`}</span>` : ""}</span></div>` +
    t.sec.groups.map(g => (g.name ? `<p class="group">${esc(g.name)}</p>` : "") + g.rows.map(k => rowHtml(k, S[k])).join("")).join("") +
    `</section>`).join("");
  const sm = $("summary"), done = c.short.length === 0;
  sm.className = "summary" + (done ? " done" : "");
  const names = c.short.map(k => `<li>${esc(S[k].d.name)}：あと<span class="num">${S[k].need - S[k].eff}</span>単位</li>`).join("");
  const rawTotal = c.secTotals.reduce((a, t) => a + t.raw, 0);
  const why = !done && c.remain > r.total - rawTotal && c.short.length === 1
    ? `<p class="why">合計は${rawTotal}単位ですが、${esc(S[c.short[0]].d.name)}が${S[c.short[0]].need - S[c.short[0]].eff}単位足りないため、あと${c.remain}単位です。</p>`
    : !done && c.remain > r.total - rawTotal
    ? `<p class="why">合計は${rawTotal}単位ですが、足りない科目区分があるため、あと${c.remain}単位です。</p>` : "";
  sm.innerHTML = (done
    ? `<div class="big num">${rawTotal}<small>/ ${r.total}単位</small></div><div class="msg">卒業要件をすべて満たしています。</div>`
    : `<div class="big num"><small>あと</small>${c.remain}<small>単位</small></div><div><div class="msg">卒業まで、あと${c.remain}単位です。</div><ul>${names}</ul></div>`)
    + `<div class="sumline"><span>合計</span><span class="num">${rawTotal} / ${r.total}</span></div>${why}`
    + `<div class="totalbar" aria-hidden="true"><i style="width:${Math.min(100, c.total / r.total * 100)}%"></i></div>`;
  $("source").textContent = `${r.faculty} ${r.dept}（${r.year}年度入学）の卒業要件は、${r.source}で計算しています。`;
  $("transfer").textContent = `選択科目の要件を超えた単位と、共通教育の要件を超えた単位（${r.commonExcess.cap}単位まで）は、専門自由科目に振り替えます。` + (r.transferNote || "");
}

/* ---------- 成績表PDFの読み込み ---------- */
function parseRecord(items) {
  const text = items.map(i => i.s).join("\n");
  // 所属の行（例：人文社会・国際法政・法学プログラム・特修法曹コース　2024）
  const affItem = items.find(i => i.s.split("・").length >= 3 && !/^[［\[(（]/.test(i.s));
  const aff = affItem ? affItem.s : null;
  let year = null;
  if (aff) {
    const m = aff.match(/(20\d\d)$/);
    const same = items.find(i => /^20\d\d$/.test(i.s) && Math.abs(i.y - affItem.y) <= 2 && i.x > affItem.x);
    year = m ? Number(m[1]) : same ? Number(same.s) : null;
  }
  if (!year) { const d = items.find(i => /^20\d\d\/04\/01$/.test(i.s)); if (d) year = Number(d.s.slice(0, 4)); }
  const cands = RULES.filter(x => aff ? aff.includes(x.match.faculty) && aff.includes(x.match.dept) : text.includes(x.match.dept));
  if (!cands.length) return aff ? { error: `${aff.replace(/\s*20\d\d$/, "").split("・").slice(0, 2).join("・")}は、まだ対応していません。` } : null;
  const r = cands.find(x => x.year === year);
  if (!r) return { error: `${cands[0].dept}の${year}年度入学のルールは、まだありません。` };
  if (!r.pdfSupported) return { rule: r, error: `${year}年度入学の成績表の読み込みには、まだ対応していません。学部・学科・入学年度を選んだので、成績表の修得単位を入力してください。` };
  const prog = (r.programs.find(p => text.includes(p.match)) || r.programs[0]).id;
  const earnedCols = items.filter(i => i.s === "修得単位").map(i => i.x).sort((a, b) => a - b);
  if (!earnedCols.length) return null;
  const nums = items.filter(i => /^\d+$/.test(i.s));
  const value = label => {
    const L = items.find(i => i.s === label);
    if (!L) return null;
    const col = earnedCols.find(x => x > L.x);
    if (col === undefined) return null;
    const hit = nums.find(n => Math.abs(n.y - L.y) <= 4 && n.x >= col - 6 && n.x <= col + 45);
    return hit ? parseInt(hit.s, 10) : 0;
  };
  const v = {}; let found = 0, want = 0;
  for (const [k, d0] of Object.entries(r.rows)) {
    const d = { ...d0, ...((d0.program || {})[prog] || {}) };
    if (!d.pdf) continue;
    want++;
    let sum = 0, any = false;
    for (const lb of d.pdf) { const x = value(lb); if (x !== null) { sum += x; any = true; } }
    v[k] = sum; if (any) found++;
  }
  if (found < want * 0.7) return null;
  return { rule: r, program: prog, v };
}

let pdfReady = null;
function loadPdfJs() {
  if (pdfReady) return pdfReady;
  pdfReady = new Promise((res, rej) => {
    const s = document.createElement("script");
    s.src = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js";
    s.onload = () => { pdfjsLib.GlobalWorkerOptions.workerSrc = s.src; res(); };
    s.onerror = () => { pdfReady = null; rej(new Error("load")); };
    document.head.appendChild(s);
  });
  return pdfReady;
}
function setStatus(msg, ok) { const el = $("status"); el.hidden = false; el.textContent = msg; el.className = "status " + (ok ? "ok" : "bad"); }

async function readPdf(file) {
  if (!file) return;
  setStatus("読み込んでいます…", true);
  try {
    await loadPdfJs();
    const doc = await pdfjsLib.getDocument({ data: new Uint8Array(await file.arrayBuffer()) }).promise;
    let result = null;
    for (let p = doc.numPages; p >= 1 && !(result && (result.v || result.rule)); p--) {
      const tc = await (await doc.getPage(p)).getTextContent();
      const items = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str.trim(), x: i.transform[4], y: i.transform[5] }));
      const r = parseRecord(items);
      if (r) result = r;
    }
    if (result && result.error) {
      if (result.rule) { state.ruleId = result.rule.id; state.program = result.program || null; state.open = true; save(); render(); }
      setStatus(result.error, false); return;
    }
    if (!result || !result.rule) { setStatus("成績表の「単位修得状況」が見つかりませんでした。教務システムの成績表のPDFか確認してください。", false); return; }
    state.ruleId = result.rule.id; state.program = result.program;
    state.data[result.rule.id] = { v: { ...result.v } }; state.open = true; state.fromPdf = true;
    Object.keys(RAW).forEach(k => delete RAW[k]);
    save(); render();
    $("status").hidden = true;
    $("result").scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  } catch (e) {
    console.error(e);
    setStatus("PDFを読み込めませんでした。ファイルを選び直すか、数字を入力してください。", false);
  }
}

/* ---------- 操作 ---------- */
$("sections").addEventListener("input", e => {
  const el = e.target;
  if (!el.id || !el.id.startsWith("in-")) return;
  const k = el.id.slice(3), st = values();
  st.v[k] = Math.max(0, parseInt(el.value, 10) || 0);
  RAW[k] = el.value; save();
  const id = el.id; render();
  const again = $(id); if (again) again.focus();
});
$("sel-prog").addEventListener("change", e => { state.program = e.target.value; save(); render(); });
$("sel-year").addEventListener("change", e => pickRule(e.target.value, rule().faculty, rule().dept));
$("sel-fac").addEventListener("change", e => pickRule(rule().year, e.target.value, rule().dept));
$("sel-dept").addEventListener("change", e => pickRule(rule().year, rule().faculty, e.target.value));
$("openManual").addEventListener("click", () => { state.open = true; state.fromPdf = false; save(); render(); });
const fileEl = $("file"), drop = $("drop");
fileEl.addEventListener("change", () => { readPdf(fileEl.files[0]); fileEl.value = ""; });
const fileEl2 = $("file2");
fileEl2.addEventListener("change", () => { readPdf(fileEl2.files[0]); fileEl2.value = ""; });
// ページのどこにドラッグしても読み込む（枠の外に落としてもPDFが開かないように）
let dragDepth = 0;
document.addEventListener("dragenter", e => { e.preventDefault(); dragDepth++; drop.classList.add("over"); });
document.addEventListener("dragover", e => { e.preventDefault(); });
document.addEventListener("dragleave", () => { if (--dragDepth <= 0) { dragDepth = 0; drop.classList.remove("over"); } });
document.addEventListener("drop", e => {
  e.preventDefault(); dragDepth = 0; drop.classList.remove("over");
  const f = e.dataTransfer && e.dataTransfer.files[0];
  if (f) readPdf(f);
});
render();
