// 学科・入学年度ごとの卒業要件。学科を足すときは、TANI_RULES に1つ足す。
// rows の項目：
//   need   必要な単位数        over  要件を超えた分の振替先
//   pdf    成績表の「単位修得状況」の行の名前（複数なら合計）
//   sink   振替を受け取る区分（上限なしで数える）
//   role   "part"（まとめの区分の内訳）・"overlay"（ほかの区分と重なる科目群）
//   calc   { sum: [...] } ほかの区分の合計で計算する区分
//   program  プログラムごとに上の項目を上書きする
// 科目の一覧は、各年度の学生便覧（国際法政学科の別表）から。
const L_R5 = {"peace": "共生社会入門・共生哲学・教育学入門・社会学原論Ⅰ・社会福祉原論Ⅰ・心理学概論Ⅰ・マス・コミ原論Ⅰ・琉球アジア研究概論", "law": "憲法Ⅰ（人権）・憲法Ⅱ（統治）・民法Ⅰ（総則）・民法Ⅱ（物権）・刑法総論・刑事手続と人権・講義国際法・基礎行政法・民法Ⅲ（債権総論）・刑事政策・民法Ⅳ（債権各論）・基礎社会保障法", "pol": "政治過程論・公共政策学・政治思想史・日本政治外交史Ⅰ・日本政治外交史Ⅱ・行政学・地方自治論・国際関係史・国際政治学Ⅰ・国際政治学Ⅱ・比較政治学Ⅰ・比較政治学Ⅱ・国際社会学", "grp": "戦争と平和の諸問題・核の科学・現代の国際関係・西洋思想と日本・中国の思想・女性と社会・琉球アジア研究入門・環境の哲学・沖縄の基地と戦跡Ⅰ・沖縄の政治と社会・比較思想文化論・沖縄の基地と戦跡Ⅱ・うちなーぐちあしび・宗教と世界・琉球の文学・沖縄の学力と教育・人間と宗教・琉球の自然・琉球語入門Ⅰ・環境問題・琉球の自然保護・琉球語入門Ⅱ・総合環境学概論・沖縄のサンゴ礁・沖縄の歴史入門・環境と文学・琉球弧の自然誌・琉球学入門・平和論・琉球の地理・琉球の自然と人・現代沖縄地域論"};
const L_R6 = {"peace": "共生社会入門・共生哲学・社会学原論Ⅰ・社会福祉原論Ⅰ・心理学概論Ⅰ・マス・コミ原論Ⅰ・琉球アジア研究概論", "law": "憲法Ⅰ（人権）・憲法Ⅱ（統治）・民法Ⅰ（総則）・民法Ⅱ（物権）・刑法総論・刑事手続と人権・講義国際法・基礎行政法・民法Ⅲ（債権総論）・刑事政策・民法Ⅳ（債権各論）・基礎社会保障法", "pol": "政治過程論・公共政策学・政治思想史・日本政治外交史Ⅰ・日本政治外交史Ⅱ・行政学・地方自治論・国際関係史・国際政治学Ⅰ・国際政治学Ⅱ・比較政治学Ⅰ・比較政治学Ⅱ・国際社会学", "grp": "戦争と平和の諸問題・核の科学・現代の国際関係・西洋思想と日本・中国の思想・女性と社会・琉球アジア研究入門・環境の哲学・沖縄の基地と戦跡Ⅰ・沖縄の政治と社会・比較思想文化論・沖縄の基地と戦跡Ⅱ・うちなーぐちあしび・宗教と世界・琉球の文学・沖縄の学力と教育・人間と宗教・琉球の自然・琉球語入門Ⅰ・環境問題・琉球の自然保護・琉球語入門Ⅱ・総合環境学概論・沖縄のサンゴ礁・沖縄の歴史入門・環境と文学・琉球弧の自然誌・琉球学入門・平和論・琉球の地理・琉球の自然と人・現代沖縄地域論"};
const L_R7 = {"peace": "共生社会入門・共生哲学・平和共生社会原論Ⅰ・社会福祉原論Ⅰ・心理学概論Ⅰ・琉球アジア研究概論", "law": "憲法Ⅰ（人権）・憲法Ⅱ（統治）・民法Ⅰ（総則）・民法Ⅱ（物権）・刑事人権論・刑事手続と人権・講義国際法・基礎行政法・民法Ⅲ（債権総論）・刑事政策・民法Ⅳ（債権各論）・基礎社会保障法", "pol": "政治過程論・公共政策学・政治思想史・日本政治外交史Ⅰ・日本政治外交史Ⅱ・行政学・地方自治論・国際関係史・国際政治学Ⅰ・国際政治学Ⅱ・比較政治学Ⅰ・比較政治学Ⅱ・国際社会学", "grp": "法と社会・総合環境学概論・琉球アジア研究入門・西洋思想と日本・中国の思想・平和論・沖縄の政治と社会・環境の哲学・核の科学・うちなーぐちあしび・現代の国際関係・女性と社会・沖縄の学力と教育・比較思想文化論・沖縄の基地と戦跡Ⅰ・琉球語入門Ⅰ・宗教と世界・沖縄の基地と戦跡Ⅱ・琉球語入門Ⅱ・人間と宗教・琉球の文学・沖縄の歴史入門・近代日本の社会と表現・琉球の自然・琉球学入門・日本語のはたらき・琉球の自然保護・琉球の自然と人・現代社会のしくみ・沖縄のサンゴ礁・現代沖縄地域論・マスコミと社会・琉球弧の自然誌・ジェンダー学とインターセクショナリティ・人類文化の比較・琉球の地理・環境と文学・戦争と平和の諸問題"};
const L_R8 = {"peace": "政治学入門・国際関係学入門・共生社会入門・共生哲学・平和共生社会原論Ⅰ・社会福祉原論Ⅰ・心理学概論Ⅰ・琉球アジア研究概論", "law": "憲法Ⅰ（人権）・憲法Ⅱ（統治）・民法Ⅰ（総則）・民法Ⅱ（物権）・刑事人権論・刑事手続と人権・基礎行政法・民法Ⅲ（債権総論）・刑事政策・被害者学・民法Ⅳ（債権各論）・基礎社会保障法・基礎労働法", "pol": "政治過程論・公共政策学・政治思想史・日本政治史Ⅰ・日本政治史Ⅱ・行政学・地方自治論・国際関係史・国際政治学Ⅰ・国際政治学Ⅱ・外交史Ⅰ・外交史Ⅱ・比較政治学Ⅰ・比較政治学Ⅱ・国際社会学", "grp": "法と社会・総合環境学概論・琉球アジア研究入門・西洋思想と日本・中国の思想・平和論・沖縄の政治と社会・現代の国際関係・核の科学・うちなーぐちあしび・比較思想文化論・女性と社会・沖縄の学力と教育・宗教と世界・沖縄の基地と戦跡Ⅰ・琉球語入門Ⅰ・人間と宗教・沖縄の基地と戦跡Ⅱ・琉球語入門Ⅱ・近代日本の社会と表現・琉球の文学・沖縄の歴史入門・日本語のはたらき・琉球の自然・琉球学入門・現代社会のしくみ・琉球の自然保護・琉球の自然と人・マスコミと社会・沖縄のサンゴ礁・現代沖縄地域論・人類文化の比較・琉球弧の自然誌・環境と文学・琉球の地理・ジェンダー学とインターセクショナリティ・戦争と平和の諸問題"};

const KOKUHOU_BASE = {
  faculty: "人文社会学部", dept: "国際法政学科",
  match: { faculty: "人文社会", dept: "国際法政" },
  programs: [
    { id: "law", name: "法学プログラム", match: "法学プログラム" },
    { id: "pol", name: "政治・国際関係学プログラム", match: "政治・国際関係学プログラム" }
  ],
  total: 124
};

// 専門教育（4年度で共通。科目の一覧だけ年度で違う）
function kokuhouProf(L, opt) {
  return {
    kiban: { name: "学部共通基盤科目（必修）", hint: "基礎演習Ⅰ・Ⅱ・Ⅲ", need: 6, pdf: ["学部共通基盤(必修)"] },
    peace: { name: "平和共生・沖縄理解基盤科目", hint: "成績表の「平和共生沖縄(選択)」", need: 4, over: "free", pdf: ["平和共生沖縄(選択)"], list: L.peace },
    gakka: { name: "学科基盤科目（必修）", hint: "法学概論・政治・国際関係学概論", need: 4, pdf: ["学科基盤(必修)"] },
    lawDev: { name: "学科発展科目（法学系）", hint: "成績表の「学科発展・法学(選択)」", pdf: ["学科発展・法学(選択)"],
      list: L.law + (opt.shahoNote ? "（基礎社会保障法は、法学プログラムではプログラム発展科目として数えます）" : ""),
      program: { law: { need: 16, over: "progDev" }, pol: { need: 4, over: "free" } } },
    polDev: { name: "学科発展科目（政治・国際関係学系）", hint: "成績表の「学科発展・政国(選択)」", pdf: ["学科発展・政国(選択)"], list: L.pol,
      program: { law: { need: 4, over: "free" }, pol: { need: 16, over: "progDev" } } },
    progKiban: { name: "プログラム基盤科目（必修）",
      program: { law: { need: 8, hint: "法学演習Ⅰ〜Ⅳ", pdf: ["プロ基盤・法学(必修)"] },
                 pol: { need: 12, hint: "政治・国際関係学演習Ⅰ〜Ⅳ・" + opt.sotsuken, pdf: ["プロ基盤・政国(必修)"] } } },
    progDev: { name: "プログラム発展科目", need: 22, over: "free",
      program: { law: { hint: "成績表の「プロ発展・法学(選択)」", pdf: ["プロ発展・法学(選択)"] },
                 pol: { hint: "成績表の「プロ発展・政国(選択)」", pdf: ["プロ発展・政国(選択)"] } } },
    free: { name: "専門自由科目", hint: "成績表の「自由科目」（他学科・他学部の専門科目）。振替の単位は自動で足します", sink: true, pdf: ["自由科目"],
      program: { law: { need: 26 }, pol: { need: 22 } } }
  };
}
const PROF_GROUPS = [
  { name: "学部共通専門科目", rows: ["kiban", "peace"] },
  { name: "学科共通専門科目", rows: ["gakka", "lawDev", "polDev"] },
  { name: "プログラム専門科目", rows: ["progKiban", "progDev", "free"] }
];

// 共通教育（2024年度入学まで）
function kyotsuOld(L) {
  return {
    health: { name: "健康運動系科目", need: 2, pdf: ["健康運動"] },
    jinbun: { name: "人文系科目", hint: "成績表の「人文計」", need: 2, role: "part", pdf: ["人文計"] },
    shakai: { name: "社会系科目", hint: "成績表の「社会計」", need: 2, role: "part", pdf: ["社会計"] },
    shizen: { name: "自然系科目", need: 2, role: "part", pdf: ["自然"] },
    sogo: { name: "総合科目", hint: "「総合」と「総合(平和共生)」の合計", need: 0, pdf: ["総合", "総合(平和共生)"] },
    ryudai: { name: "琉大特色・地域創生科目", hint: "「琉特・地創」と「琉特・地創(平和共生)」の合計", need: 0, pdf: ["琉特・地創", "琉特・地創(平和共生)"] },
    career: { name: "キャリア関係科目", need: 0, pdf: ["キャリア関係"] },
    joho: { name: "情報関係科目", hint: "情報科学演習", need: 2, role: "part", pdf: ["情報関係"] },
    pool: { name: "その他の領域",
      program: {
        law: { need: 20, hint: "成績表の「人社等計」（外国語と健康運動系を除く共通教育の合計）", calc: { sum: ["jinbun", "shakai", "shizen", "sogo", "ryudai", "career", "joho"] } },
        pol: { need: 32, hint: "健康運動系を除く共通教育の合計（外国語を含む）", calc: { sum: ["jinbun", "shakai", "shizen", "sogo", "ryudai", "career", "joho", "lang"] } } } },
    peaceGroup: { name: "うち平和共生・沖縄理解科目群", hint: "成績表の「平和共生沖縄理解計」", need: 6, role: "overlay", pdf: ["(平和共生沖縄理解計)"], list: L.grp },
    lang: { name: "外国語", hint: "成績表の「外国語計」（第1外国語8単位・第2外国語4単位）", need: 12, pdf: ["（外国語計）"],
      program: { pol: { role: "part" } } }
  };
}
const KYOTSU_OLD_GROUPS = [
  { name: "", rows: ["health"] },
  { name: "教養領域・総合領域・基幹領域（情報関係）", rows: ["jinbun", "shakai", "shizen", "sogo", "ryudai", "career", "joho", "pool", "peaceGroup"] },
  { name: "基幹領域（外国語）", rows: ["lang"] }
];

// 共通教育（2025年度入学から）
function kyotsuNew(L) {
  return {
    health: { name: "健康運動系科目", need: 2 },
    career: { name: "キャリア・ダイバーシティ科目", need: 2,
      program: { law: { hint: "キャリア形成入門", role: "part" }, pol: { hint: "キャリア形成入門。政治・国際関係学プログラムでは、その他の領域に含めません" } } },
    data: { name: "データリテラシー科目", hint: "情報科学演習", need: 2, role: "part" },
    jinsha: { name: "人文社会科学系科目", role: "part", program: { law: { need: 0 }, pol: { need: 4 } } },
    shizen: { name: "自然科学系科目", need: 2, role: "part" },
    ryudai: { name: "琉大特色・地域創生科目", need: 0 },
    global: { name: "グローバル科目", need: 0 },
    pool: { name: "その他の領域",
      program: {
        law: { need: 20, hint: "健康運動系と外国語を除く共通教育の合計", calc: { sum: ["career", "data", "jinsha", "shizen", "ryudai", "global"] } },
        pol: { need: 30, hint: "健康運動系とキャリア・ダイバーシティ科目を除く共通教育の合計（外国語を含む）", calc: { sum: ["data", "jinsha", "shizen", "ryudai", "global", "lang"] } } } },
    peaceGroup: { name: "うち平和共生・沖縄理解科目群", need: 6, role: "overlay", list: L.grp },
    lang: { name: "外国語", hint: "第1外国語8単位・第2外国語4単位", need: 12, program: { pol: { role: "part" } } }
  };
}
const KYOTSU_NEW_GROUPS = [
  { name: "", rows: ["health", "career"] },
  { name: "その他の領域", rows: ["data", "jinsha", "shizen", "ryudai", "global", "pool", "peaceGroup"] },
  { name: "外国語", rows: ["lang"] }
];

const EXAMPLE_PROF = { kiban: 6, peace: 6, gakka: 4, lawDev: 18, polDev: 4, progKiban: 0, progDev: 8, free: 2 };

function kokuhouRule(year, L, opt) {
  const oldK = year <= 2024;
  return {
    ...KOKUHOU_BASE,
    id: "jinsha-kokusaihosei-" + year, year,
    source: `${year}年度入学者用の学生便覧（人文社会学部規程 別表・国際法政学科）`,
    pdfSupported: oldK,
    sections: [
      { name: "専門教育科目", need: 90, top: true, groups: PROF_GROUPS },
      { name: "共通教育科目", need: 34, groups: oldK ? KYOTSU_OLD_GROUPS : KYOTSU_NEW_GROUPS }
    ],
    rows: { ...kokuhouProf(L, opt), ...(oldK ? kyotsuOld(L) : kyotsuNew(L)) },
    // 共通教育の要件を超えた単位を、専門自由科目に回す（10単位まで）
    commonExcess: { cap: 10, to: "free", program: oldK ? { law: ["health", "pool", "lang"], pol: ["health", "pool"] } : { law: ["health", "pool", "lang"], pol: ["health", "career", "pool"] } },
    example: oldK
      ? { ...EXAMPLE_PROF, health: 2, jinbun: 4, shakai: 2, shizen: 4, sogo: 2, ryudai: 4, career: 0, joho: 2, lang: 12, peaceGroup: 6 }
      : { ...EXAMPLE_PROF, health: 2, career: 2, data: 2, jinsha: 6, shizen: 4, ryudai: 4, global: 0, lang: 12, peaceGroup: 6 }
  };
}

window.TANI_RULES = [
  kokuhouRule(2026, L_R8, { sotsuken: "卒業研究Ⅰ・Ⅱ" }),
  kokuhouRule(2025, L_R7, { sotsuken: "卒業研究Ⅰ・Ⅱ" }),
  kokuhouRule(2024, L_R6, { sotsuken: "卒業研究", shahoNote: true }),
  kokuhouRule(2023, L_R5, { sotsuken: "卒業研究", shahoNote: true })
];

/* ---------- 人間社会学科・琉球アジア文化学科 ---------- */
// 3つのプログラムで数字だけ違う科目区分は、[プログラム1, 2, 3] の順に書く
function perProgram(programs, key, values) {
  const o = {};
  programs.forEach((p, i) => { o[p.id] = { [key]: values[i] }; });
  return o;
}
function mergeProgram(...maps) {
  const o = {};
  for (const m of maps) for (const [k, v] of Object.entries(m)) o[k] = { ...(o[k] || {}), ...v };
  return o;
}

function kyotsuOldSimple(L, opt) {
  // 2024年度入学まで。その他の領域は、健康運動系と外国語を除く合計
  const parts = ["jinbun", "shakai", "shizen", "sogo", "ryudai", "career", "joho"];
  return {
    health: { name: "健康運動系科目", need: 2 },
    jinbun: { name: "人文系科目", need: 2, role: "part" },
    shakai: { name: "社会系科目", need: 2, role: "part" },
    shizen: { name: "自然系科目", need: 2, role: "part" },
    sogo: { name: "総合科目", need: 0 },
    ryudai: { name: "琉大特色・地域創生科目", need: 0 },
    career: { name: "キャリア関係科目", need: opt.career || 0, role: opt.career ? "part" : undefined },
    joho: { name: "情報関係科目", hint: "情報科学演習", need: 2, role: "part" },
    pool: { name: "その他の領域", hint: "外国語と健康運動系を除く共通教育の合計", need: opt.pool, calc: { sum: parts } },
    peaceGroup: { name: "うち平和共生・沖縄理解科目群", need: 6, role: "overlay", list: L.grp },
    lang: { name: "外国語", hint: opt.langHint, need: opt.lang }
  };
}
const KYOTSU_OLD_SIMPLE_GROUPS = [
  { name: "", rows: ["health"] },
  { name: "教養領域・総合領域・基幹領域（情報関係）", rows: ["jinbun", "shakai", "shizen", "sogo", "ryudai", "career", "joho", "pool", "peaceGroup"] },
  { name: "基幹領域（外国語）", rows: ["lang"] }
];

function ningenRule(year, L) {
  const oldK = year <= 2024;
  const programs = [
    { id: "phil", name: year <= 2023 ? "哲学・教育学プログラム" : "哲学プログラム", match: "哲学" },
    { id: "psy", name: "心理学プログラム", match: "心理学" },
    { id: "soc", name: "社会学プログラム", match: "社会学" }
  ];
  const pp = (key, v) => perProgram(programs, key, v);
  const prof = {
    kiban: { name: "学部共通基盤科目（必修）", program: pp("need", [6, 4, 6]) },
    peace: { name: "学部共通科目（選択科目）", hint: "平和共生・沖縄理解基盤科目", need: 4, over: "free" },
    gakkaKiban: { name: "学科基盤科目", need: 6, over: "progDev" },
    gakkaDev: { name: "学科発展科目", need: 4, over: "progDev" },
    coreKiban: { name: "プログラムコア基盤科目", program: pp("need", [4, 12, 8]) },
    coreDev: { name: "プログラムコア発展科目", over: "progDev", program: pp("need", [8, 12, 8]) },
    progDev: { name: "プログラム発展科目", over: "free", program: pp("need", [30, 22, 26]) },
    free: { name: "専門自由科目", hint: "他プログラム・他学科・他学部の専門科目。振替の単位は自動で足します", sink: true, program: pp("need", [26, 24, 26]) }
  };
  let kyotsu, groups, excess;
  if (oldK) {
    kyotsu = kyotsuOldSimple(L, { pool: 22, career: 2, lang: 12, langHint: "第1外国語8単位・第2外国語4単位" });
    groups = KYOTSU_OLD_SIMPLE_GROUPS;
    excess = { cap: 10, rows: ["health", "pool", "lang"] };
  } else {
    kyotsu = {
      health: { name: "健康運動系科目", need: 2 },
      data: { name: "データリテラシー科目", hint: "情報科学演習", need: 2, role: "part" },
      career: { name: "キャリア・ダイバーシティ科目", hint: "キャリア形成入門", need: 2, role: "part" },
      jinsha: { name: "人文社会科学系科目", need: 0 },
      shizen: { name: "自然科学系科目", need: 0 },
      ryudai: { name: "琉大特色・地域創生科目", need: 0 },
      global: { name: "グローバル科目", need: 0 },
      three: { name: "人文社会科学系・自然科学系・琉大特色の合計", need: 8, role: "part", calc: { sum: ["jinsha", "shizen", "ryudai"] } },
      pool: { name: "その他の領域", hint: "外国語と健康運動系を除く共通教育の合計", need: 22, calc: { sum: ["data", "career", "jinsha", "shizen", "ryudai", "global"] } },
      peaceGroup: { name: "うち平和共生・沖縄理解科目群", need: 6, role: "overlay", list: L.grp },
      lang: { name: "外国語", hint: "第1外国語8単位・第2外国語4単位", need: 12 }
    };
    groups = [
      { name: "", rows: ["health"] },
      { name: "その他の領域", rows: ["data", "career", "jinsha", "shizen", "ryudai", "global", "three", "pool", "peaceGroup"] },
      { name: "外国語", rows: ["lang"] }
    ];
    excess = { cap: 6, rows: ["health", "pool", "lang"] };
  }
  return {
    id: "jinsha-ningen-" + year, year, faculty: "人文社会学部", dept: "人間社会学科",
    match: { faculty: "人文社会", dept: "人間社会" }, programs, total: 124, pdfSupported: false,
    source: `${year}年度入学者用の学生便覧（人文社会学部規程 別表・人間社会学科）`,
    sections: [
      { name: "専門教育科目", need: 88, top: true, groups: [
        { name: "学部共通専門科目", rows: ["kiban", "peace"] },
        { name: "学科共通専門科目", rows: ["gakkaKiban", "gakkaDev"] },
        { name: "プログラム専門科目", rows: ["coreKiban", "coreDev", "progDev", "free"] }
      ]},
      { name: "共通教育科目", need: 36, groups }
    ],
    rows: { ...prof, ...kyotsu },
    commonExcess: { cap: excess.cap, to: "free", program: Object.fromEntries(programs.map(p => [p.id, excess.rows])) },
    example: { kiban: 6, peace: 4, gakkaKiban: 6, gakkaDev: 6, coreKiban: 4, coreDev: 8, progDev: 12, free: 4, health: 2, lang: 12, peaceGroup: 6,
      ...(oldK ? { jinbun: 4, shakai: 4, shizen: 2, sogo: 2, ryudai: 2, career: 2, joho: 2 } : { data: 2, career: 2, jinsha: 8, shizen: 2, ryudai: 4, global: 0 }) }
  };
}

function ryuasiaRule(year, L) {
  const oldK = year <= 2024;
  const programs = [
    { id: "hist", name: "歴史・民俗学プログラム", match: "歴史" },
    { id: "lit", name: "文学プログラム", match: "文学" },
    { id: "ling", name: "言語学プログラム", match: "言語学" }
  ];
  const prof = {
    kiban: { name: "学部共通基盤科目（必修）", need: 6 },
    peace: { name: "平和共生・沖縄理解基盤科目", need: 4, over: "free" },
    gakkaKiban: { name: "学科基盤科目", hint: "他プログラムのプログラムコア基盤科目", need: 4, over: "free" },
    gakkaDev: { name: "学科発展科目", hint: "他プログラムのプログラム発展科目", need: 4, over: "free" },
    coreKiban: { name: "プログラムコア基盤科目", need: 8, over: "free" },
    coreDev: { name: "プログラムコア発展科目", hint: "卒業論文（必修）4単位を含む", need: 12, over: "free" },
    progDev: { name: "プログラム発展科目", need: 28, over: "free" },
    free: { name: "専門自由科目", hint: "他学科・他学部の専門科目。振替の単位は自動で足します", sink: true, need: oldK ? 22 : 24 }
  };
  let kyotsu, groups, excessRows, commonNeed;
  if (oldK) {
    kyotsu = kyotsuOldSimple(L, { pool: 18, lang: 16, langHint: "第1外国語8単位・第2外国語8単位" });
    groups = KYOTSU_OLD_SIMPLE_GROUPS;
    excessRows = ["health", "pool", "lang"];
    commonNeed = 36;
  } else {
    kyotsu = {
      health: { name: "健康運動系科目", need: 2 },
      data: { name: "データリテラシー科目", hint: "情報科学演習", need: 2 },
      career: { name: "キャリア・ダイバーシティ科目", hint: "キャリア形成入門", need: 2 },
      jinsha: { name: "人文社会科学系科目", need: 2, role: "part" },
      shizen: { name: "自然科学系科目", need: 2, role: "part" },
      ryudai: { name: "琉大特色・地域創生科目", need: 2, role: "part" },
      global: { name: "グローバル科目", need: 0 },
      pool: { name: "その他の領域", hint: "基盤領域（健康運動系・データリテラシー・キャリア・ダイバーシティ・外国語）を除く共通教育の合計", need: 16, calc: { sum: ["jinsha", "shizen", "ryudai", "global"] } },
      peaceGroup: { name: "うち平和共生・沖縄理解科目群", need: 6, role: "overlay", list: L.grp },
      lang: { name: "外国語", hint: "第1外国語8単位・第2外国語4単位", need: 12 }
    };
    groups = [
      { name: "基盤領域", rows: ["health", "data", "career"] },
      { name: "その他の領域", rows: ["jinsha", "shizen", "ryudai", "global", "pool", "peaceGroup"] },
      { name: "外国語", rows: ["lang"] }
    ];
    excessRows = ["health", "data", "career", "pool", "lang"];
    commonNeed = 34;
  }
  return {
    id: "jinsha-ryuasia-" + year, year, faculty: "人文社会学部", dept: "琉球アジア文化学科",
    match: { faculty: "人文社会", dept: "琉球アジア" }, programs, total: 124, pdfSupported: false,
    source: `${year}年度入学者用の学生便覧（人文社会学部規程 別表・琉球アジア文化学科）`,
    sections: [
      { name: "専門教育科目", need: oldK ? 88 : 90, top: true, groups: [
        { name: "学部共通専門科目", rows: ["kiban", "peace"] },
        { name: "学科共通専門科目", rows: ["gakkaKiban", "gakkaDev"] },
        { name: "プログラム専門科目", rows: ["coreKiban", "coreDev", "progDev", "free"] }
      ]},
      { name: "共通教育科目", need: commonNeed, groups }
    ],
    rows: { ...prof, ...kyotsu },
    commonExcess: { cap: 10, to: "free", program: Object.fromEntries(programs.map(p => [p.id, excessRows])) },
    example: { kiban: 6, peace: 4, gakkaKiban: 4, gakkaDev: 4, coreKiban: 8, coreDev: 4, progDev: 12, free: 4, health: 2, peaceGroup: 6,
      ...(oldK ? { jinbun: 4, shakai: 2, shizen: 2, sogo: 2, ryudai: 4, career: 0, joho: 2, lang: 16 } : { data: 2, career: 2, jinsha: 6, shizen: 2, ryudai: 4, global: 0, lang: 12 }) }
  };
}

window.TANI_RULES.push(
  ...[2026, 2025, 2024, 2023].map(y => ningenRule(y, { R5: L_R5, R6: L_R6, R7: L_R7, R8: L_R8 }[{ 2023: "R5", 2024: "R6", 2025: "R7", 2026: "R8" }[y]])),
  ...[2026, 2025, 2024, 2023].map(y => ryuasiaRule(y, { R5: L_R5, R6: L_R6, R7: L_R7, R8: L_R8 }[{ 2023: "R5", 2024: "R6", 2025: "R7", 2026: "R8" }[y]]))
);
