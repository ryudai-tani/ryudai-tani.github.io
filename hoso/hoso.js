const STORE = "hoso-check-v1";
const $ = id => document.getElementById(id);
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
// 「Ⅰ」「I」「Ｉ」や全角・半角の違い、空白を無視して科目名を比べる
const norm = s => String(s).normalize("NFKC").replace(/\s/g, "");

// 法曹コースの必修科目（2026年2月12日の説明会資料）
const REQUIRED = [
  ["特修憲法Ⅰ", 2], ["特修民法Ⅰ", 3], ["特修民法Ⅱ", 3], ["特修民法Ⅲ", 2], ["特修刑法総論Ⅰ", 1], ["特修刑法各論Ⅰ", 1],
  ["特修憲法Ⅱ", 2], ["特修民法Ⅳ", 2], ["特修刑法総論Ⅱ", 1], ["特修刑法各論Ⅱ", 1], ["特修商法Ⅰ", 2], ["特修商法Ⅱ", 2],
  ["特修民事訴訟法Ⅰ", 2], ["特修刑事訴訟法Ⅰ", 2], ["特修刑事訴訟法Ⅱ", 2], ["特修民法Ⅴ", 1],
];
// 選択必修（3科目から2科目）
const ELECTIVE = [["特修商法基礎演習", 2], ["特修刑事訴訟法演習", 2], ["特修民事訴訟法演習", 2]];
const ELECTIVE_NEED = 2;
const TOTAL = 124;
const GOALS = [
  { name: "早期卒業", all: 3.3, req: 2.9, note: "早期卒業には、ほかに、琉球大学法科大学院の特別選抜に合格し、入学を確約することが必要です。" },
  { name: "法曹コースの修了", all: 3.0, req: 2.6 },
];
const GP = { A: 4, B: 3, C: 2, D: 1, F: 0 };
const PASS = ["A", "B", "C", "D", "P", "R"];
const LABEL = { 4: "A", 3: "B", 2: "C", 1: "D" };

let state = {};
try { state = JSON.parse(localStorage.getItem(STORE)) || {}; } catch (e) {}
function save() { try { localStorage.setItem(STORE, JSON.stringify(state)); } catch (e) {} }

// GPAは切り捨てて小数2桁で表示する（基準に届いていないのに届いたように見せないため）
const fmt = x => (Math.floor(x * 100 + 1e-9) / 100).toFixed(2);
const sumGpa = list => list.reduce((a, c) => c.g in GP ? { p: a.p + GP[c.g] * c.u, u: a.u + c.u } : a, { p: 0, u: 0 });
// 修得年度の順（「2025後期*」→ 2025.5）
const termKey = t => { const m = String(t || "").match(/(20\d\d)(前期|後期)?/); return m ? Number(m[1]) + (m[2] === "後期" ? 0.5 : 0) : 0; };
// 再履修：D・Fの科目を再履修すると、新しい評価に置き換わる（分母は変わらない）
function effective(cs) {
  const out = [], last = new Map();
  for (const c of [...cs].sort((a, b) => termKey(a.t) - termKey(b.t))) {
    const k = norm(c.n), prev = last.get(k);
    if (prev && (prev.g === "D" || prev.g === "F")) { out[out.indexOf(prev)] = c; last.set(k, c); continue; }
    out.push(c); last.set(k, c);
  }
  return out;
}

/* ---------- 計算 ---------- */
function compute() {
  const cs = effective(state.courses || []);
  const status = list => list.map(([name, u]) => {
    const rows = (state.courses || []).filter(c => norm(c.n) === norm(name)).sort((a, b) => termKey(a.t) - termKey(b.t));
    const done = rows.find(c => PASS.includes(c.g));
    return { name, u, rows, done: !!done, g: rows.map(c => c.g).join("→") };
  });
  const req = status(REQUIRED), ele = status(ELECTIVE);
  const reqNames = new Set(REQUIRED.map(r => norm(r[0])));
  const all = sumGpa(cs);
  const reqCs = cs.filter(c => reqNames.has(norm(c.n)));
  const reqG = sumGpa(reqCs);
  const earned = state.total != null ? state.total : cs.reduce((a, c) => a + (PASS.includes(c.g) ? c.u : 0), 0);
  const reqLeft = req.filter(r => !r.done);
  const reqLeftUnits = reqLeft.reduce((a, r) => a + r.u, 0);
  // Fの科目は再履修で置き換わるので、GPAの「残り」には、まだ評価のない科目だけを数える
  const reqNewUnits = reqLeft.filter(r => !r.rows.some(c => c.g in GP)).reduce((a, r) => a + r.u, 0);
  const eleDone = ele.filter(r => r.done).length;
  const eleLeft = Math.max(0, ELECTIVE_NEED - eleDone);
  // 全修得単位のGPAの「残り」：まだ評価のない必修科目と、足りない選択必修
  const rest = reqNewUnits + eleLeft * 2;
  return { cs, reqCs, reqNewUnits, req, ele, all, reqG, earned, reqLeft, reqLeftUnits, eleDone, eleLeft, rest };
}

// 残りR単位で、GPAを基準に届かせるには
function advice(g, R, target, canAdd, what) { return { what, ...advice0(g, R, target, canAdd, what) }; }
function advice0(g, R, target, canAdd, what) {
  const cur = g.u ? g.p / g.u : 0;
  const N = target * (g.u + R) - g.p; // 残りで必要なGPの合計（単位×GP）
  if (R === 0) {
    if (g.u && cur >= target) return { k: "ok", t: "基準に届いています。" };
    return { k: "bad", t: "基準に届いていません。" + (canAdd ? addMore(g, R, target) : "") };
  }
  // 必修科目はFでは修得できないので、「成績にかかわらず」とは書かない
  if (N <= R + 1e-9) return { k: N <= 1e-9 ? "ok" : "move", t: `残りの${what}${R}単位を修得すれば（D以上）、届きます。` };
  if (N > 4 * R + 1e-9) return { k: "bad", t: `残りの${what}${R}単位をすべてAにしても${fmt((g.p + 4 * R) / (g.u + R))}で、届きません。` + (canAdd ? addMore(g, R, target) : "") };
  const b = Math.ceil(N / R - 1e-9) - 1; // 1〜3
  const k = Math.ceil(N - b * R - 1e-9);
  return { k: "move", what, t: k >= R ? `残りの${what}${R}単位を、すべて${LABEL[b + 1]}以上にすれば届きます。` : `残りの${what}${R}単位のうち、${LABEL[b + 1]}を${k}単位以上、ほかを${LABEL[b]}以上にすれば届きます。` };
}
// 再履修できる科目（D・F）と、Aを取ったときに上がるGPA
function retake(how, list, g, R, target) {
  if (how.k === "ok") return how;
  const cand = list.filter(c => c.g === "D" || c.g === "F").map(c => ({ c, up: (4 - GP[c.g]) * c.u / (g.u + R) })).sort((a, b) => b.up - a.up);
  if (!cand.length) return how;
  const lines = cand.slice(0, 3).map(x => `${esc(x.c.n)}（${x.c.g}）を再履修してAを取ると、GPAが${(Math.floor(x.up * 100 + 1e-9) / 100).toFixed(2)}上がります。`);
  // 残りをすべてAにしても届かないとき、再履修する科目もAにすれば届くか
  const best = (g.p + 4 * R + cand.reduce((a, x) => a + (4 - GP[x.c.g]) * x.c.u, 0)) / (g.u + R);
  if (how.k === "bad" && best >= target - 1e-9) {
    // 残りをすべてAにしたうえで、上がる幅の大きい科目から再履修し、最後の科目は必要な評価を出す
    let E = target * (g.u + R) - g.p - 4 * R;
    const parts = [];
    for (const x of cand) {
      const max = (4 - GP[x.c.g]) * x.c.u;
      if (E <= max + 1e-9) {
        const gp = Math.max(GP[x.c.g] + 1, GP[x.c.g] + Math.ceil(E / x.c.u - 1e-9));
        parts.push(`${esc(x.c.n)}（${x.c.g}）を再履修して${gp >= 4 ? "Aを" : LABEL[gp] + "以上を"}`);
        break;
      }
      parts.push(`${esc(x.c.n)}（${x.c.g}）を再履修してAを`);
      E -= max;
    }
    return { k: "move", t: how.t, more: [`${R ? `残りの${how.what}${R}単位をすべてAにし、` : ""}${parts.join("、")}取れば届きます。`] };
  }
  return { k: how.k, t: how.t, more: lines };
}
function addMore(g, R, target) {
  if (target >= 4) return "";
  const r = Math.ceil((target * (g.u + R) - g.p - 4 * R) / (4 - target) - 1e-9);
  return `ほかの科目もあと${r}単位、Aで修得すれば届きます。`;
}

/* ---------- 表示 ---------- */
function render() {
  const has = !!(state.courses && state.courses.length);
  $("howto").hidden = has;
  $("loadedBar").hidden = !has;
  $("result").hidden = !has;
  if (!has) return;
  const c = compute();
  const gpaCard = (label, g, key) => `<div class="gpa"><span class="label">${label}</span><span class="big num">${g.u ? fmt(g.p / g.u) : "－"}</span>`
    + `<span class="req">早期卒業 ${fmt(GOALS[0][key])}以上・修了 ${fmt(GOALS[1][key])}以上</span></div>`;

  const row = (name, val, how) => `<div class="grow"><span class="name">${name}</span><span class="val num">${val}</span><p class="how ${how.k}">${how.t}</p>`
    + (how.more ? how.more.map(t => `<p class="how move">${t}</p>`).join("") : "") + `</div>`;
  const goals = GOALS.map(G => {
    const items = [];
    const reqAll = REQUIRED.reduce((a, r) => a + r[1], 0);
    items.push(row("必修科目", `${reqAll - c.reqLeftUnits} / ${reqAll}単位`,
      c.reqLeft.length ? { k: "bad", t: `あと${c.reqLeftUnits}単位（${c.reqLeft.map(r => r.name).join("・")}）です。` } : { k: "ok", t: "すべて修得しています。" }));
    const eleRest = c.ele.filter(r => !r.done).map(r => r.name);
    items.push(row("選択必修", `${Math.min(c.eleDone, ELECTIVE_NEED) * 2} / ${ELECTIVE_NEED * 2}単位`,
      c.eleLeft ? { k: "bad", t: `あと${c.eleLeft * 2}単位です（${eleRest.join("・")}${eleRest.length > c.eleLeft ? `から${c.eleLeft}科目` : ""}）。` } : { k: "ok", t: "修得しています。" }));
    const a1 = retake(advice(c.reqG, c.reqNewUnits, G.req, false, "必修科目"), c.reqCs, c.reqG, c.reqNewUnits, G.req);
    items.push(row("必修科目のGPA", `${c.reqG.u ? fmt(c.reqG.p / c.reqG.u) : "－"} / ${fmt(G.req)}`, a1));
    const a2 = retake(advice(c.all, c.rest, G.all, true, c.eleLeft ? "必修科目・選択必修" : "必修科目"), c.cs, c.all, c.rest, G.all);
    items.push(row("全修得単位のGPA", `${c.all.u ? fmt(c.all.p / c.all.u) : "－"} / ${fmt(G.all)}`, a2));
    const gpaBad = a1.k === "bad" || a2.k === "bad";
    const allOk = !c.reqLeft.length && !c.eleLeft && a1.k === "ok" && a2.k === "ok";
    const pill = allOk ? `<span class="pill ok">条件を満たしています</span>` : gpaBad ? `<span class="pill bad">GPAが届きません</span>` : `<span class="pill move">残りの成績で届きます</span>`;
    return `<section class="goal"><div class="sechead"><h2>${G.name}</h2><div class="sechead-r">${pill}</div></div>${items.join("")}`
      + (G.note ? `<p class="goalnote">${G.note}</p>` : "") + `</section>`;
  }).join("");

  const tr = r => `<tr><td>${esc(r.name)}</td><td class="n num">${r.u}</td><td${r.rows.length ? "" : ' class="miss"'}>${r.rows.length ? esc(r.g) : "未修得"}</td></tr>`;
  const table = `<details><summary>法曹コースの科目の成績</summary><table class="courses"><thead><tr><th>必修科目</th><th>単位</th><th>評価</th></tr></thead><tbody>${c.req.map(tr).join("")}</tbody>`
    + `<thead><tr><th>選択必修</th><th>単位</th><th>評価</th></tr></thead><tbody>${c.ele.map(tr).join("")}</tbody></table><p>選択必修は、必修科目のGPAに含めません。</p></details>`;

  $("result").innerHTML = `<div class="gpas">${gpaCard("全修得単位のGPA", c.all, "all")}${gpaCard("法曹コース必修科目のGPA", c.reqG, "req")}</div>`
    + goals + table;
}

/* ---------- 成績表PDFの読み込み ---------- */
function parsePage(items) {
  const heads = items.filter(i => i.s === "科目番号").sort((a, b) => a.x - b.x);
  const courses = [];
  const near = (a, b, d) => Math.abs(a - b) <= d;
  for (const h of heads) {
    const unitH = items.filter(i => i.s === "単位" && near(i.y, h.y, 3) && i.x > h.x).sort((a, b) => a.x - b.x)[0];
    const gradeH = items.filter(i => i.s === "評価" && near(i.y, h.y, 3) && i.x > h.x).sort((a, b) => a.x - b.x)[0];
    if (!unitH || !gradeH) continue;
    const termH = items.filter(i => i.s === "修得年度" && near(i.y, h.y, 3) && i.x > gradeH.x).sort((a, b) => a.x - b.x)[0];
    for (const g of items) {
      const letter = g.s.normalize("NFKC");
      if (!/^[ABCDFPR]$/.test(letter) || g.y >= h.y || !near(g.x, gradeH.x, 10)) continue;
      const u = items.find(i => /^\d+$/.test(i.s) && near(i.y, g.y, 3) && near(i.x, unitH.x, 14));
      const name = items.filter(i => near(i.y, g.y, 3) && i.x > h.x + 20 && i.x < unitH.x - 8).sort((a, b) => a.x - b.x).map(i => i.s).join("");
      const t = termH && items.find(i => /^20\d\d/.test(i.s) && near(i.y, g.y, 3) && near(i.x, termH.x, 14));
      if (u && name) courses.push({ n: name, u: parseInt(u.s, 10), g: letter, t: t ? t.s : "" });
    }
  }
  // 「単位修得状況」の【合計】の修得単位
  let total = null;
  const L = items.find(i => i.s === "【合計】");
  if (L) {
    const col = items.filter(i => i.s === "修得単位" && i.x > L.x).map(i => i.x).sort((a, b) => a - b)[0];
    const hit = col !== undefined && items.find(n => /^\d+$/.test(n.s) && near(n.y, L.y, 4) && n.x >= col - 6 && n.x <= col + 45);
    if (hit) total = parseInt(hit.s, 10);
  }
  return { courses, total };
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
    const courses = []; let total = null;
    for (let p = 1; p <= doc.numPages; p++) {
      const tc = await (await doc.getPage(p)).getTextContent();
      const items = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str.trim(), x: i.transform[4], y: i.transform[5] }));
      const r = parsePage(items);
      courses.push(...r.courses);
      if (r.total != null) total = r.total;
    }
    if (!courses.length) { setStatus("成績表の科目が見つかりませんでした。教務システムの成績表のPDFか確認してください。", false); return; }
    state = { courses, total, loadedAt: Date.now() };
    save(); render();
    $("status").hidden = true;
    $("result").scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  } catch (e) {
    console.error(e);
    setStatus("PDFを読み込めませんでした。ファイルを選び直してください。", false);
  }
}

/* ---------- 操作 ---------- */
const fileEl = $("file"), fileEl2 = $("file2"), drop = $("drop");
fileEl.addEventListener("change", () => { readPdf(fileEl.files[0]); fileEl.value = ""; });
fileEl2.addEventListener("change", () => { readPdf(fileEl2.files[0]); fileEl2.value = ""; });
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
