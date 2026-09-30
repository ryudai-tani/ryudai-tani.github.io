const STORE = "hoso-check-v1";
// 画面の部品が見つからなくても止まらないようにする（古いページの枠がブラウザに残っているとき）
const NO_EL = { hidden: false, textContent: "", innerHTML: "", value: "", className: "", classList: { add() {}, remove() {} }, addEventListener() {}, focus() {}, scrollIntoView() {} };
const $ = id => document.getElementById(id) || NO_EL;
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
  { name: "法曹コースの修了", short: "修了", all: 3.0, req: 2.6 },
  { name: "早期卒業", short: "早期卒業", all: 3.3, req: 2.9, note: "早期卒業には、ほかに、琉球大学法科大学院の特別選抜に合格し、入学を確約することが必要です。" },
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
  // 見込みの評価（まだ修得していない科目・再履修する科目）を、いちばん新しい成績として足す
  const unitOf = Object.fromEntries([...REQUIRED, ...ELECTIVE]);
  // 見込みを選べるのは、まだ修得していない科目と、D・Fの科目（再履修できる）
  const canPred = n => {
    const real = (state.courses || []).filter(c => norm(c.n) === norm(n)).sort((a, b) => termKey(a.t) - termKey(b.t));
    const last = real.length ? real[real.length - 1].g : null;
    return !real.some(c => PASS.includes(c.g)) || last === "D" || last === "F";
  };
  const preds = Object.entries(state.pred || {}).filter(([n, g]) => g && unitOf[n] && canPred(n) && !ELECTIVE.some(e => e[0] === n)).map(([n, g]) => ({ n, u: unitOf[n], g, t: "2099後期", pred: true }));
  const withPred = [...(state.courses || []), ...preds];
  const cs = effective(withPred);
  const status = list => list.map(([name, u]) => {
    const rows = withPred.filter(c => norm(c.n) === norm(name)).sort((a, b) => termKey(a.t) - termKey(b.t));
    const real = rows.filter(c => !c.pred);
    const done = rows.find(c => PASS.includes(c.g));
    return { name, u, rows: real, done: !!done, canPred: canPred(name), g: real.map(c => c.g).join("→") };
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
  return { preds, cs, reqCs, reqNewUnits, req, ele, all, reqG, earned, reqLeft, reqLeftUnits, eleDone, eleLeft, rest };
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
  if (N <= R + 1e-9) return { k: N <= 1e-9 ? "ok" : "move", pass: true, t: `残りの${what}を修得すれば（D以上）、届きます。` };
  if (N > 4 * R + 1e-9) return { k: "bad", t: `残りの${what}をすべてAにしても${fmt((g.p + 4 * R) / (g.u + R))}で、届きません。` + (canAdd ? addMore(g, R, target) : "") };
  const b = Math.ceil(N / R - 1e-9) - 1; // 1〜3
  const k = Math.ceil(N - b * R - 1e-9);
  return { k: "move", what, t: k >= R ? `残りの${what}を、すべて${LABEL[b + 1]}以上にすれば届きます。` : `残りの${what}のうち、${LABEL[b + 1]}を${k}単位以上、ほかを${LABEL[b]}以上にすれば届きます。` };
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
    return { k: "move", t: how.t, more: [`${R ? `残りの${how.what}をすべてAにし、` : ""}${parts.join("、")}取れば届きます。`] };
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
  if (state.aff && !state.aff.includes("法曹")) {
    $("result").innerHTML = `<p class="status bad">読み込んだ成績表の所属が、特修法曹コースではありません。このページは、特修法曹コースの人のためのページです。</p>`;
    return;
  }
  const c = compute();
  const gpaCard = (label, g, key) => `<div class="gpa"><span class="label">${label}</span><span class="big num">${g.u ? fmt(g.p / g.u) : "－"}</span>`
    + `<span class="req">${GOALS.map(G => `${G.short} ${fmt(G[key])}以上`).join("・")}</span></div>`;

  const row = (name, val, how) => `<div class="grow"><span class="name">${name}</span><span class="val num">${val}</span><p class="how ${how.k}">${how.t}</p>`
    + (how.more ? how.more.map(t => `<p class="how move">${t}</p>`).join("") : "") + `</div>`;
  const goals = GOALS.map(G => {
    const items = [];
    const reqAll = REQUIRED.reduce((a, r) => a + r[1], 0);
    items.push(row("必修科目", `${reqAll - c.reqLeftUnits} / ${reqAll}単位`,
      c.reqLeft.length ? { k: "bad", t: `あと${c.reqLeftUnits}単位（${c.reqLeft.map(r => r.name).join("・")}）です。` } : { k: "ok", t: "すべて修得しています。" }));
    const eleRest = c.ele.filter(r => !r.done).map(r => r.name);
    items.push(row("選択必修科目", `${Math.min(c.eleDone, ELECTIVE_NEED) * 2} / ${ELECTIVE_NEED * 2}単位`,
      c.eleLeft ? { k: "bad", t: `あと${c.eleLeft * 2}単位です（${eleRest.join("・")}${eleRest.length > c.eleLeft ? `から${c.eleLeft}科目` : ""}）。` } : { k: "ok", t: "修得しています。" }));
    const a1 = retake(advice(c.reqG, c.reqNewUnits, G.req, false, `必修科目${c.reqNewUnits}単位`), c.reqCs, c.reqG, c.reqNewUnits, G.req);
    items.push(row("必修科目のGPA", `${c.reqG.u ? fmt(c.reqG.p / c.reqG.u) : "－"} / ${fmt(G.req)}`, a1));
    const a2 = retake(advice(c.all, c.rest, G.all, true, [c.reqNewUnits ? `必修科目${c.reqNewUnits}単位` : "", c.eleLeft ? `選択必修科目${c.eleLeft * 2}単位` : ""].filter(Boolean).join("・")), c.cs, c.all, c.rest, G.all);
    items.push(row("全修得単位のGPA", `${c.all.u ? fmt(c.all.p / c.all.u) : "－"} / ${fmt(G.all)}`, a2));
    const gpaBad = a1.k === "bad" || a2.k === "bad";
    const allOk = !c.reqLeft.length && !c.eleLeft && a1.k === "ok" && a2.k === "ok";
    // 残りの科目を修得すれば（D以上）GPAも届くか、AやBなどの成績が必要か
    const easy = [a1, a2].every(a => a.k === "ok" || a.pass);
    const pill = allOk ? `<span class="pill ok">条件を満たしています</span>` : gpaBad ? `<span class="pill bad">GPAが届きません</span>`
      : `<span class="pill move">${easy ? "残りの科目を修得すれば届きます" : "残りの成績しだいで届きます"}</span>`;
    return `<section class="goal"><div class="sechead"><h2>${G.name}</h2><div class="sechead-r">${pill}</div></div>${items.join("")}`
      + (G.note ? `<p class="goalnote">${G.note}</p>` : "") + `</section>`;
  }).join("");

  const pred = state.pred || {};
  const sel = r => r.canPred ? `<select data-pred="${esc(r.name)}" aria-label="${esc(r.name)}の見込み">`
    + ["", "A", "B", "C", "D", "F"].map(g => `<option value="${g}"${(pred[r.name] || "") === g ? " selected" : ""}>${g || "－"}</option>`).join("") + `</select>` : "";
  const tr = r => `<tr><td>${esc(r.name)}</td><td class="num">${r.u}</td><td${r.rows.length ? "" : ' class="miss"'}>${r.rows.length ? esc(r.g) : "未修得"}</td><td>${sel(r)}</td></tr>`;
  // 選択必修科目は、評価を出さず、修得したかだけ
  const trEle = r => { const got = r.rows.some(x => PASS.includes(x.g)); return `<tr><td>${esc(r.name)}</td><td class="num">${r.u}</td><td${got ? "" : ' class="miss"'}>${got ? "修得済み" : "未修得"}</td><td></td></tr>`; };
  const head = (name, col, pred) => `<thead><tr><th>${name}</th><th>単位</th><th>${col}</th><th>${pred}</th></tr></thead>`;
  const table = `<section class="goal"><div class="sechead"><h2>法曹コースの科目の成績</h2></div>`
    + `<p class="goalnote">必修科目のうち、まだ修得していない科目と、D・Fの科目（再履修できる科目）は、見込みの評価を選ぶと、上の判定に反映されます。</p>`
    + `<table class="courses">${head("必修科目", "評価", "見込み")}<tbody>${c.req.map(tr).join("")}</tbody>${head("選択必修科目", "修得", "")}<tbody>${c.ele.map(trEle).join("")}</tbody></table>`
    + `<p class="goalnote">選択必修科目は、必修科目のGPAに含めません。</p>`
    // 表を見ているあいだ、画面の下にGPAを出す（上のGPAまで遠いため）
    + `<div class="floatgpa"><span>${c.preds.length ? "見込みを入れたGPA" : "いまのGPA"}</span>`
    + `<span>必修科目 <b class="num">${c.reqG.u ? fmt(c.reqG.p / c.reqG.u) : "－"}</b></span><span>全修得単位 <b class="num">${c.all.u ? fmt(c.all.p / c.all.u) : "－"}</b></span></div></section>`;
  const predNote = c.preds.length ? `<p class="plan-note">見込みの評価を入れて計算しています。 <button type="button" class="linkbtn" id="clearPred">見込みを消す</button></p>` : "";

  $("result").innerHTML = predNote + `<div class="gpas">${gpaCard("全修得単位のGPA", c.all, "all")}${gpaCard("法曹コース必修科目のGPA", c.reqG, "req")}</div>`
    + goals + table;
}

/* ---------- 成績表PDFの読み込み ---------- */
// parseCourses（科目名・単位・評価の読み取り）は ../rules.js にある（元のページと共通）

// 元のページで、成績表をもう一度読み込まなくても使えるように保存する（元のページの readPdf と同じ形）
function saveForMain(r) {
  if (!r || r.error || !r.rule || !r.v) return;
  let m = {};
  try { m = JSON.parse(localStorage.getItem("tani-check-v4")) || {}; } catch (e) {}
  m.data = m.data || {};
  m.data[r.rule.id] = { v: { ...r.v }, shahoMoved: r.shahoMoved || 0 };
  Object.assign(m, { ruleId: r.rule.id, program: r.program, open: true, fromPdf: true, plan: false, loadedAt: Date.now(), hoso: true });
  try { localStorage.setItem("tani-check-v4", JSON.stringify(m)); } catch (e) {}
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
    const courses = []; let total = null, main = null, aff = null;
    for (let p = 1; p <= doc.numPages; p++) {
      const tc = await (await doc.getPage(p)).getTextContent();
      const items = tc.items.filter(i => i.str && i.str.trim()).map(i => ({ s: i.str.trim(), x: i.transform[4], y: i.transform[5] }));
      const r = window.parseCourses(items);
      courses.push(...r.courses);
      if (r.aff) aff = r.aff;
      if (r.total != null) total = r.total;
      // 元のページ（卒業まであと何単位）の科目区分ごとの単位も読む
      if (window.parseRecord && !(main && main.rule)) { try { main = window.parseRecord(items) || main; } catch (e) {} }
    }
    if (!courses.length) { setStatus("成績表の科目が見つかりませんでした。教務システムの成績表のPDFか確認してください。", false); return; }
    state = { courses, total, aff, loadedAt: Date.now() };
    saveForMain(main);
    save(); render();
    $("status").hidden = true;
    $("result").scrollIntoView({ behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth", block: "start" });
  } catch (e) {
    console.error(e);
    setStatus("PDFを読み込めませんでした。ファイルを選び直してください。", false);
  }
}

/* ---------- 操作 ---------- */
// 見込みの評価（選んだ後にフォーカスを戻さない。スマホでもう一度開いてしまうため）
$("result").addEventListener("change", e => {
  const n = e.target.dataset && e.target.dataset.pred;
  if (n == null) return;
  state.pred = state.pred || {};
  if (e.target.value) state.pred[n] = e.target.value; else delete state.pred[n];
  // 上の判定の長さが変わっても、選んだ欄が画面の同じ位置にとどまるようにする
  const before = e.target.getBoundingClientRect().top;
  save(); render();
  const again = [...document.querySelectorAll("select[data-pred]")].find(x => x.dataset.pred === n);
  if (again) window.scrollBy(0, again.getBoundingClientRect().top - before);
});
$("result").addEventListener("click", e => { if (e.target.id === "clearPred") { state.pred = {}; save(); render(); } });
$("clearAll").addEventListener("click", () => { window.TANI_KEEP.clear(); location.reload(); });
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
