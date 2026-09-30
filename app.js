const RULES = window.TANI_RULES;
const STORE = "tani-check-v3";
const pos = x => Math.max(0, x);
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let saved = {};
try { saved = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) {}
let state = { ruleId: saved.ruleId || RULES[0].id, program: saved.program || null, data: saved.data || {} };
const RAW = {};
function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} }

const rule = () => RULES.find(r => r.id === state.ruleId) || RULES[0];
const program = () => { const r = rule(); return r.programs.find(p => p.id === state.program) ? state.program : r.programs[0].id; };
function values() {
  const r = rule();
  if (!state.data[r.id]) state.data[r.id] = { v: { ...r.example }, example: true };
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
    s.moves.push(`${s.need}単位を超えた${extra}単位を${t.d.name}に回しました`);
  }
  // 共通教育の要件を超えた分
  const ce = r.commonExcess, ceRows = ce ? ce.program[p] : [];
  if (ce) {
    const excess = ceRows.reduce((a, k) => a + pos(S[k].eff - S[k].need), 0);
    const moved = Math.min(excess, ce.cap);
    if (moved) {
      const t = S[ce.to];
      t.eff += moved;
      t.recv.push({ from: "共通教育", n: moved });
      const last = ceRows[ceRows.length - 1];
      S[ceRows.includes("pool") ? "pool" : last].moves.push(
        `共通教育の要件を超えた${moved}単位を${t.d.name}に回しました${excess > ce.cap ? `（上限${ce.cap}単位。残り${excess - ce.cap}単位は卒業の単位に数えません）` : ""}`);
    }
  }
  for (const k of keys) {
    const s = S[k];
    if (s.recv.length && s.d.sink) s.moves.push(`振替で受け取った単位：${s.recv.map(x => `${x.from} ${x.n}`).join("・")}`);
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
  return { S, secTotals, total, short, remain: Math.max(pos(r.total - total), needMore) };
}

/* ---------- 表示 ---------- */
function stateHtml(s) {
  if (!s.need) return `<span class="pill free">要件なし</span>`;
  const done = s.eff >= s.need;
  const pct = Math.min(100, s.eff / s.need * 100);
  const pill = done ? `<span class="pill ok">達成</span>` : `<span class="pill bad">あと <span class="num">${s.need - s.eff}</span> 単位</span>`;
  const min = s.d.role === "part" || s.d.role === "overlay";
  return `${pill}<div class="bar"><i class="${done ? "ok" : ""}" style="width:${pct}%"></i></div><span class="req num">${s.d.sink ? s.eff : Math.min(s.eff, s.need)} / ${s.need}${min ? " 以上" : ""}</span>`;
}
function rowHtml(k, s) {
  const d = s.d, st = values();
  const moves = s.moves.length ? `<div class="moves">${s.moves.map(m => `<div class="move">${esc(m)}</div>`).join("")}</div>` : "";
  const field = d.calc ? `<div class="calcval num">${s.have}</div>`
    : `<input id="in-${k}" type="number" inputmode="numeric" min="0" step="1" value="${k in RAW ? esc(RAW[k]) : (st.v[k] || 0)}" aria-label="${esc(d.name)}の修得単位数">`;
  const det = d.list ? `<details><summary>対象の科目</summary><p>${esc(d.list)}</p></details>` : "";
  return `<div class="row${d.calc ? " calc" : ""}"><div class="name">${esc(d.name)}${d.hint ? `<small>${esc(d.hint)}</small>` : ""}</div>${field}<div class="state">${stateHtml(s)}</div>${moves}${det}</div>`;
}

function renderSelectors() {
  const r = rule();
  const facs = [...new Set(RULES.map(x => x.faculty))];
  $("sel-fac").innerHTML = facs.map(f => `<option${f === r.faculty ? " selected" : ""}>${esc(f)}</option>`).join("");
  const depts = [...new Set(RULES.filter(x => x.faculty === r.faculty).map(x => x.dept))];
  $("sel-dept").innerHTML = depts.map(d => `<option${d === r.dept ? " selected" : ""}>${esc(d)}</option>`).join("");
  const years = RULES.filter(x => x.faculty === r.faculty && x.dept === r.dept).map(x => x.year);
  $("sel-year").innerHTML = years.map(y => `<option value="${y}"${y === r.year ? " selected" : ""}>${y}年度</option>`).join("");
  const p = program();
  $("programs").innerHTML = r.programs.map(x => `<button type="button" data-p="${x.id}" aria-pressed="${x.id === p}">${esc(x.name)}</button>`).join("");
  $("programs").hidden = r.programs.length < 2;
}
function pickRule(fac, dept, year) {
  const c = RULES.filter(x => x.faculty === fac && (!dept || x.dept === dept));
  const hit = c.find(x => x.year === Number(year)) || c[0];
  if (hit) { state.ruleId = hit.id; state.program = null; Object.keys(RAW).forEach(k => delete RAW[k]); save(); render(); }
}

function render() {
  const r = rule(), c = compute(), S = c.S, st = values();
  renderSelectors();
  $("exampleNote").hidden = !st.example;
  $("sections").innerHTML = c.secTotals.map(t =>
    `<section><div class="sechead"><h2>${esc(t.sec.name)}</h2><span class="num">${t.sum} / ${t.sec.need}</span></div>` +
    t.sec.groups.map(g => (g.name ? `<p class="group">${esc(g.name)}</p>` : "") + g.rows.map(k => rowHtml(k, S[k])).join("")).join("") +
    `</section>`).join("");
  const sm = $("summary"), done = c.short.length === 0;
  sm.className = "summary" + (done ? " done" : "");
  const names = c.short.map(k => `<li>${esc(S[k].d.name)}：あと<span class="num">${S[k].need - S[k].eff}</span>単位</li>`).join("");
  sm.innerHTML = (done
    ? `<div class="big num">${c.total}<small>/ ${r.total}単位</small></div><div class="msg">卒業要件をすべて満たしています。</div>`
    : `<div class="big num"><small>あと</small>${c.remain}<small>単位</small></div><div><div class="msg">卒業まで、あと${c.remain}単位です。足りない科目区分は${c.short.length}つです。</div><ul>${names}</ul></div>`)
    + `<div class="totalbar" aria-hidden="true"><i style="width:${Math.min(100, c.total / r.total * 100)}%"></i></div>`;
  $("source").textContent = `${r.faculty} ${r.dept}（${r.year}年度入学）の卒業要件は、${r.source}で計算しています。`;
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
  if (!cands.length) return { error: aff ? `${aff.replace(/\s*20\d\d$/, "").split("・").slice(0, 2).join("・")}は、まだ対応していません。` : null };
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
      if (result.rule) { state.ruleId = result.rule.id; state.program = result.program || null; save(); render(); }
      setStatus(result.error, false); return;
    }
    if (!result) { setStatus("成績表の「単位修得状況」が見つかりませんでした。教務システムの成績表のPDFか確認してください。", false); return; }
    state.ruleId = result.rule.id; state.program = result.program;
    state.data[result.rule.id] = { v: { ...result.rule.example, ...result.v }, example: false };
    Object.keys(RAW).forEach(k => delete RAW[k]);
    save(); render();
    setStatus(`成績表を読み込みました（${result.rule.faculty} ${result.rule.dept}・${result.rule.year}年度入学）。振替を計算した結果を表示しています。`, true);
  } catch (e) {
    setStatus("PDFを読み込めませんでした。ファイルを選び直すか、数字を入力してください。", false);
  }
}

/* ---------- 操作 ---------- */
$("sections").addEventListener("input", e => {
  const el = e.target;
  if (!el.id || !el.id.startsWith("in-")) return;
  const k = el.id.slice(3), st = values();
  // 例の数字のまま入力を始めたら、ほかの例の数字は0にする
  if (st.example) inputKeys().forEach(x => { if (x !== k) { st.v[x] = 0; delete RAW[x]; } });
  st.v[k] = Math.max(0, parseInt(el.value, 10) || 0);
  st.example = false; RAW[k] = el.value; save();
  const id = el.id; render();
  const again = $(id); if (again) again.focus();
});
$("programs").addEventListener("click", e => { const b = e.target.closest("button[data-p]"); if (b) { state.program = b.dataset.p; save(); render(); } });
$("sel-fac").addEventListener("change", e => pickRule(e.target.value));
$("sel-dept").addEventListener("change", e => pickRule(rule().faculty, e.target.value));
$("sel-year").addEventListener("change", e => pickRule(rule().faculty, rule().dept, e.target.value));
const fileEl = $("file"), drop = $("drop");
fileEl.addEventListener("change", () => { readPdf(fileEl.files[0]); fileEl.value = ""; });
drop.addEventListener("dragover", e => { e.preventDefault(); drop.classList.add("over"); });
drop.addEventListener("dragleave", () => drop.classList.remove("over"));
drop.addEventListener("drop", e => { e.preventDefault(); drop.classList.remove("over"); readPdf(e.dataTransfer.files[0]); });
render();
