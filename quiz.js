export const shuffle = (a) => {
  a = [...a];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
};

// 語群に並べる形。verb は不定詞 (cue)、ほかは先頭の正解
export const choiceOf = (q) => (q.cue ?? q.answers[0]).toLowerCase();

// 空欄が文頭か (対話の「— 」のあとも文頭)。文頭なら答えは大文字で始まる
export const atHead = (text) => /(^|[.!?]\s|—\s)$/.test(text.split("___")[0]);

// 語群は正解1つと、同じ級・同じ形式のほかの問題から引いた n-1 語。この問題で正解になる語と avoid の語は混ぜない
export function choices(q, questions, n) {
  const own = new Set([choiceOf(q), ...q.answers.map((a) => a.toLowerCase()), ...(q.avoid ?? [])]);
  const pool = new Set(questions.filter((x) => x.level === q.level && x.type === q.type).map(choiceOf));
  return shuffle([choiceOf(q), ...shuffle([...pool].filter((w) => !own.has(w))).slice(0, n - 1)]);
}

// 問題文の {名前} を vars に従って埋めた問題を返す。覚えてしまわないように、出すたびに変える。
// vars の値が pool 名なら pools から1つ (同じ問題の中では重ならない)、[min, max, step] ならその範囲の数。
// pool の要素が { fr, ja } なら、日本語の欄 (hint, ja) には ja を使う。id は変えないので同じ問題として記録される
export function instantiate(q, pools, rand = Math.random) {
  if (!q.vars) return q;
  const v = {};
  const used = new Set();
  for (const [k, spec] of Object.entries(q.vars)) {
    if (Array.isArray(spec)) {
      const [min, max, step = 1] = spec;
      v[k] = min + step * Math.floor(rand() * (Math.floor((max - min) / step) + 1));
    } else {
      const left = pools[spec].filter((x) => !used.has(x));
      used.add((v[k] = left[Math.floor(rand() * left.length)]));
    }
  }
  const sub = (s, lang) => s?.replace(/\{(\w+)\}/g, (_, k) => v[k][lang] ?? v[k]);
  return { ...q, text: sub(q.text, "fr"), a: sub(q.a, "fr"), hint: sub(q.hint, "ja"), ja: sub(q.ja, "ja") };
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
