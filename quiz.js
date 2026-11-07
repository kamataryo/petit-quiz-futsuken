// 切り混ぜる。w(x) を渡すと重み付きになり、末尾から取っていくと、残りの中で次に出る確率が w に比例する。
// 要素ごとに random ** (1 / w) を引いて並べる (Efraimidis–Spirakis の方法)。w がなければふつうの切り混ぜ。
// rand には要素を渡すので、要素ごとに決まった数を返せば並びも決まる
export const shuffle = (a, w = () => 1, rand = Math.random) =>
  a.map((x) => [rand(x) ** (1 / w(x)), x]).sort((p, q) => p[0] - q[0]).map((p) => p[1]);

// 文字列から決まる [0, 1) の乱数列。FNV-1a で種にして mulberry32 で回す。同じ文字列なら毎回同じ列
export const seeded = (s) => {
  let h = [...s].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 16777619), 2166136261);
  return () => {
    h = (h + 0x6d2b79f5) | 0;
    let t = Math.imul(h ^ (h >>> 15), 1 | h);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
};

// 語群に並べる形。verb は不定詞 (cue)、ほかは先頭の正解
export const choiceOf = (q) => (q.cue ?? q.answers[0]).toLowerCase();

// 空欄が文頭か (対話の「— 」のあとも文頭)。文頭なら答えは大文字で始まる
export const atHead = (text) => /(^|[.!?]\s|—\s)$/.test(text.split("___")[0]);

// alts は同じ問題の別の形 (主語の性数や名詞の性を変えて、答えも変わるもの)。元の形とあわせて返す。vars は元のものに足す
export const variants = ({ alts = [], ...q }) => [q, ...alts.map((a) => ({ ...q, ...a, vars: { ...q.vars, ...a.vars } }))];

// 語群は正解1つと、同じ級・同じ形式のほかの問題 (alts の形も含む) から引いた n-1 語。この問題で正解になる語と avoid の語は混ぜない
export function choices(q, questions, n, rand = Math.random) {
  const own = new Set([choiceOf(q), ...q.answers.map((a) => a.toLowerCase()), ...(q.avoid ?? [])]);
  const pool = new Set(questions.flatMap(variants).filter((x) => x.level === q.level && x.type === q.type).map(choiceOf));
  return shuffle([choiceOf(q), ...shuffle([...pool].filter((w) => !own.has(w)), undefined, rand).slice(0, n - 1)], undefined, rand);
}

// 元の形と alts から1つ選び、問題文の {名前} を vars に従って埋めた問題を返す。
// vars の値が pool 名なら pools から、ほかの一覧ならその中から1つ (同じ問題の中では重ならない)、[min, max, step] (数) ならその範囲の数。
// 要素が { fr, ja } なら、日本語の欄 (hint, ja) には ja を使う。{名前.欄} でほかの欄も引ける。id は変えないので同じ問題として記録される
export function instantiate(q, pools, rand = Math.random) {
  const pick = (a) => a[Math.floor(rand() * a.length)];
  q = pick(variants(q));
  const v = {};
  const used = new Set();
  for (const [k, spec] of Object.entries(q.vars ?? {})) {
    if (typeof spec[0] === "number") {
      const [min, max, step = 1] = spec;
      v[k] = min + step * Math.floor(rand() * (Math.floor((max - min) / step) + 1));
    } else {
      used.add((v[k] = pick((typeof spec === "string" ? pools[spec] : spec).filter((x) => !used.has(x)))));
    }
  }
  const sub = (s, lang) => s?.replace(/\{(\w+)(?:\.(\w+))?\}/g, (_, k, f) => (f ? v[k][f] : v[k][lang] ?? v[k]));
  return { ...q, text: sub(q.text, "fr"), a: sub(q.a, "fr"), hint: sub(q.hint, "ja"), ja: sub(q.ja, "ja"),
    claims: q.claims?.map(([s, ok]) => [sub(s, "fr"), ok]) };
}

// 採点。字まで全部合えば correct、大文字小文字だけ違えば case、アクサン (と合字 œ æ) も違えば accent、それ以外は wrong。
// case と accent は部分正解 (△)。前後の空白・空白の数・アポストロフィの字形 (iOS が ' を ’ にする) は問わない
const norm = (s) => s.normalize("NFC").trim().replace(/[’‘´`]/g, "'").replace(/\s+/g, " ");
const fold = (s) => norm(s).toLowerCase();
const bare = (s) => fold(s).normalize("NFD").replace(/\p{M}/gu, "").replace(/œ/g, "oe").replace(/æ/g, "ae");

export function grade(input, answers) {
  for (const [r, f] of [["correct", norm], ["case", fold], ["accent", bare]]) {
    if (answers.some((a) => f(a) === f(input))) return r;
  }
  return "wrong";
}

// 書き取りの答え合わせ。語と記号 (. , など) に切り、アクサンと大文字小文字を除いて合う語がいちばん多くなるように並べる (LCS)。
// 合った語は grade の結果 (correct / case / accent)、書き落とした語は missing、余分に書いた語は extra。
// 書き違えた語は extra と missing の組になる。返すのは { word (答えの語), input (書いた語), r } の列
const tokens = (s) => norm(s).match(/[\p{L}\p{M}\p{N}'-]+|\S/gu) ?? [];
export function diffWords(input, answer) {
  const a = tokens(answer), b = tokens(input);
  const A = a.map(bare), B = b.map(bare);
  // L[i][j] は a[i..] と b[j..] で合う語の数の最大
  const L = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = a.length - 1; i >= 0; i--)
    for (let j = b.length - 1; j >= 0; j--)
      L[i][j] = A[i] === B[j] ? L[i + 1][j + 1] + 1 : Math.max(L[i + 1][j], L[i][j + 1]);
  const out = [];
  for (let i = 0, j = 0; i < a.length || j < b.length; ) {
    if (i < a.length && A[i] === B[j]) { out.push({ word: a[i], input: b[j], r: grade(b[j], [a[i]]) }); i++; j++; }
    else if (j < b.length && (i === a.length || L[i][j + 1] >= L[i + 1][j])) out.push({ input: b[j++], r: "extra" });
    else out.push({ word: a[i++], r: "missing" });
  }
  return out;
}
