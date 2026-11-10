import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { atHead, choiceOf, choices, diffWords, grade, instantiate, seeded, shuffle, variants } from "./quiz.js";

test("アクサンまで合えば正解、アクサンだけ違えば部分正解", () => {
  assert.equal(grade("à", ["à"]), "correct");
  assert.equal(grade("  à ", ["à"]), "correct");
  assert.equal(grade("a", ["à"]), "accent");
  assert.equal(grade("á", ["à"]), "accent");
  assert.equal(grade("arretee", ["arrêtée"]), "accent");
  assert.equal(grade("soeur", ["sœur"]), "accent");
  assert.equal(grade("par", ["à"]), "wrong");
  assert.equal(grade("", ["à"]), "wrong");
});

test("大文字小文字だけ違えば部分正解 (文頭・人名も)", () => {
  assert.equal(grade("malgré", ["Malgré"]), "case");
  assert.equal(grade("Malgré", ["malgré"]), "case");
  assert.equal(grade("paris", ["Paris"]), "case");
  assert.equal(grade("A", ["à"]), "accent"); // アクサンも違えば accent
});

test("表記ゆれは正解のまま", () => {
  assert.equal(grade("quelqu’un", ["quelqu'un"]), "correct");
  assert.equal(grade("a  cessé", ["a cessé"]), "correct");
  assert.equal(grade("durant", ["pendant", "durant"]), "correct");
  assert.equal(grade("e\u0301gal", ["égal"]), "correct"); // NFD で来ても同じ字
});

const { levels, types, pools, questions } = JSON.parse(
  readFileSync(new URL("./questions.json", import.meta.url), "utf8"),
);
const forms = questions.flatMap(variants); // alts も1問ずつ見る

test("シードの問題が出題できる形になっている", () => {
  for (const q of forms) {
    assert.ok(levels[q.level] && types[q.type], q.text);
    assert.ok(types[q.type].name, q.type); // 形式の選択に出す名前
    assert.equal(q.text.split("___").length, (q.blanks?.length ?? (q.claims ? 0 : 1)) + 1, q.text);
    assert.ok((q.answers ?? q.blanks ?? q.claims).length && (q.hint || q.ja || q.a), q.text);
    if (q.type === "word") assert.ok(q.answers.every((a) => a.startsWith(q.cue)), q.text);
    if (q.type === "verb") assert.ok(q.cue && q.a, q.text);
    // 語群のある問題の cue は「形を変えて書く」印。そのままの形が答えなら cue は要らない
    if (types[q.type].choices && q.cue) assert.ok(!q.answers.some((a) => a.toLowerCase() === q.cue), q.id);
  }
  for (const level in levels) assert.ok(questions.some((q) => q.level === level), level);
});

test("id は記録のキーなので重複しない", () => {
  const ids = questions.map((q) => q.id);
  assert.ok(ids.every(Boolean));
  assert.equal(new Set(ids).size, ids.length);
});

test("語群は数がそろい、正解になる語は1つだけ", () => {
  for (const q of forms) {
    const n = types[q.type].choices;
    if (!n) continue;
    const c = choices(q, questions, n);
    assert.equal(new Set(c).size, n, q.text);
    assert.ok(c.includes(choiceOf(q)), q.text);
    // verb の語群は不定詞なのでそのままでは正解にならない (0)。ほかは正解の1語だけ
    assert.ok(c.filter((w) => grade(w, q.answers) !== "wrong").length <= 1, q.text);
  }
});

test("avoid の語は語群に出さない", () => {
  const q = { level: "x", type: "verb", cue: "rater", answers: ["a raté"], avoid: ["manquer"] };
  const qs = [q, { ...q, cue: "manquer", avoid: [] }, { ...q, cue: "partir", avoid: [] }];
  for (let i = 0; i < 20; i++) assert.deepEqual(choices(q, qs, 2).sort(), ["partir", "rater"]);
});

test("vars は範囲の端まで出て、同じ pool からは重ならずに選ぶ", () => {
  const q = { id: "x", vars: { n: [5, 40, 5], a: "p", b: "p" }, text: "{n} {a} {b}", ja: "{a}" };
  const pools = { p: [{ fr: "Paul", ja: "ポール" }, { fr: "Marc", ja: "マルク" }] };
  assert.equal(instantiate(q, pools, () => 0).text, "5 Paul Marc");
  assert.equal(instantiate(q, pools, () => 0.999).text, "40 Marc Paul");
  assert.equal(instantiate(q, pools, () => 0).ja, "ポール");
  assert.equal(instantiate(q, pools).id, "x");
});

test("alts は元の形とあわせて1つ選び、vars は元のものに足す。{名前.欄} でほかの欄も引ける", () => {
  const q = { id: "x", vars: { s: [{ fr: "Il", ja: "彼", v: "来た" }] }, text: "{s} ___", ja: "{s}は{s.v}", answers: ["a"],
    alts: [{ vars: { n: [3, 3] }, text: "{s} {n} ___", answers: ["b"] }] };
  const [a, b] = [0, 0.999].map((r) => instantiate(q, {}, () => r));
  assert.deepEqual([a.text, a.ja, a.answers], ["Il ___", "彼は来た", ["a"]]);
  assert.deepEqual([b.text, b.answers, b.id], ["Il 3 ___", ["b"], "x"]);
});

test("シードの {名前} はすべて vars で埋まり、埋めても同じ問題のまま", () => {
  for (const q of forms) {
    const used = [q.text, q.a, q.hint, q.ja, ...(q.claims?.map((c) => c[0]) ?? [])].join(" ").match(/(?<=\{)\w+/g) ?? [];
    for (const k of used) assert.ok(q.vars?.[k], `${q.id} ${k}`);
    for (const spec of Object.values(q.vars ?? {})) assert.ok(typeof spec !== "string" || pools[spec], q.id);
    assert.ok(!(q.answers ?? q.blanks?.flat() ?? []).join().includes("{"), q.id); // 語群はほかの問題の answers から作るので、答えには入れない
    for (let i = 0; i < 20; i++) {
      const x = instantiate(q, pools);
      assert.equal(x.id, q.id);
      // 欄の書き忘れは undefined、{名前.欄} の欄がない要素は [object Object] になって出る
      const claims = x.claims?.map((c) => c[0]) ?? [];
      assert.ok(!/[{}]|undefined|\[object/.test([x.text, x.a, x.hint, x.ja, ...claims].join(" ")), `${q.id} ${x.text}`);
      // 母音の前のエリジョン漏れ (de apprendre など)。答えは固定でも、vars で入る語が母音で始まると起きる
      const ans = x.answers ?? x.blanks?.map((b) => b[0]) ?? [];
      let k = 0;
      const fr = [x.text.replace(/___/g, () => ans[k++]), x.a, ...claims].join(" ");
      assert.ok(!/(?<!\p{L})(de|que|le|la|je|ne|se|me|te|ce|jusque) [aeiouâàéèêîôûœ]/iu.test(fr), `${q.id} ${fr}`);
    }
  }
});

test("alts で文を変えたら、訳も書き直す", () => {
  for (const q of questions) {
    for (const alt of q.alts ?? []) if (alt.text) for (const k of ["hint", "ja"]) if (q[k]) assert.ok(alt[k], `${q.id} ${alt.text}`);
  }
});

test("文頭の空欄の答えは大文字で、それ以外は小文字で始まる", () => {
  for (const q of forms) {
    for (const a of q.answers ?? []) assert.equal(a[0] === a[0].toUpperCase(), atHead(q.text), `${q.id} ${a}`);
  }
});

test("長文は空欄が5つで、それぞれ別々の候補が3つ (先頭が正解)。文頭の空欄 (会話は話し手の名前のあとも) は候補を大文字で始める", () => {
  for (const q of forms.filter((x) => x.blanks)) {
    const parts = q.text.split("___");
    assert.equal(q.blanks.length, 5, q.id);
    q.blanks.forEach((b, i) => {
      assert.equal(new Set(b).size, 3, `${q.id} ${b}`);
      const head = /(^|\n|[.!?]\s|\} : )$/.test(parts[i]);
      for (const w of b) assert.equal(w[0] === w[0].toUpperCase(), head, `${q.id} ${w}`);
    });
    // 会話は行ごとに話し手と台詞の2列に分けて出す
    if (q.type === "dialog") for (const l of q.text.split("\n")) assert.match(l, /^\{\w+\} : /, q.id);
  }
});

test("内容一致は文が6つで、○ と × がどちらもあり、解説は文ごとに1行", () => {
  for (const q of forms.filter((x) => x.claims)) {
    assert.equal(q.claims.length, 6, q.id);
    assert.ok(q.claims.every(([s, ok]) => typeof s === "string" && typeof ok === "boolean"), q.id);
    const n = q.claims.filter(([, ok]) => ok).length;
    assert.ok(n > 0 && n < 6, q.id);
    assert.equal(q.note.split("\n").length, 6, q.id);
  }
});

test("重み付きの切り混ぜは、末尾 (次に出る問題) に重みの比で来る", () => {
  let n = 0;
  for (let i = 0; i < 6000; i++) if (shuffle(["a", "b"], (x) => (x === "a" ? 5 : 1)).at(-1) === "a") n++;
  assert.ok(Math.abs(n / 6000 - 5 / 6) < 0.05, String(n / 6000)); // 5 : 1 なら 5/6
  assert.deepEqual(shuffle([1, 2, 3]).sort(), [1, 2, 3]);
});

test("同じ種なら並びも入れ替えも同じ、種が違えば変わる", () => {
  const a = Array.from({ length: 20 }, (_, i) => i);
  const order = (s) => shuffle(a, undefined, (x) => seeded(`${s}-${x}`)());
  assert.deepEqual(order("s"), order("s"));
  assert.notDeepEqual(order("s"), order("t"));
  const r = seeded("s");
  const xs = Array.from({ length: 1000 }, r);
  assert.ok(xs.every((x) => x >= 0 && x < 1));
  assert.ok(Math.abs(xs.reduce((p, x) => p + x) / 1000 - 0.5) < 0.05); // ならせば偏らない
});

test("書き取りは語ごとに比べる (アクサン違い・書き違い・抜け)", () => {
  const show = (i, a) => diffWords(i, a).map(({ word = "", input = "", r }) => `${r}:${input}>${word}`).join(" ");
  assert.equal(show("Il est ne chez ma grand-mère", "Il est né chez ma grand-mère."),
    "correct:Il>Il correct:est>est accent:ne>né correct:chez>chez correct:ma>ma correct:grand-mère>grand-mère missing:>.");
  assert.equal(show("j’y allé  souvent", "J'y allais souvent"), "case:j'y>J'y extra:allé> missing:>allais correct:souvent>souvent");
  assert.equal(show("", "Oui."), "missing:>Oui missing:>.");
});

test("書き取りは読み上げの区切り (/) があり、句読点は区切りの終わりにだけ置く", () => {
  const dictees = JSON.parse(readFileSync(new URL("./dictees.json", import.meta.url), "utf8"));
  for (const d of dictees) {
    assert.ok(d.name && d.ja, d.text);
    assert.ok(d.text.includes(" / "), d.name); // ゆっくりは区切りごとに読む
    for (const c of d.text.split(" / ")) assert.match(c, /^[^.,?!]+[.,?!]?$/, `${d.name}: ${c}`);
  }
});
