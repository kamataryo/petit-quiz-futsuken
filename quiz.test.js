import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { choiceOf, choices, grade, instantiate } from "./quiz.js";

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

test("シードの問題が出題できる形になっている", () => {
  for (const q of questions) {
    assert.ok(levels[q.level] && types[q.type], q.text);
    assert.equal(q.text.split("___").length, 2, q.text);
    assert.ok(q.answers.length && (q.hint || q.ja || q.a), q.text);
    if (q.type === "word") assert.ok(q.answers.every((a) => a.startsWith(q.cue)), q.text);
    if (q.type === "verb") assert.ok(q.cue && q.a, q.text);
  }
  for (const level in levels) assert.ok(questions.some((q) => q.level === level), level);
});

test("id は記録のキーなので重複しない", () => {
  const ids = questions.map((q) => q.id);
  assert.ok(ids.every(Boolean));
  assert.equal(new Set(ids).size, ids.length);
});

test("語群は数がそろい、正解になる語は1つだけ", () => {
  for (const q of questions) {
    const n = types[q.type].choices;
    if (!n) continue;
    const c = choices(q, questions, n);
    assert.equal(new Set(c).size, n, q.text);
    assert.ok(c.includes(choiceOf(q)), q.text);
    // verb の語群は不定詞なのでそのままでは正解にならない (0)。ほかは正解の1語だけ
    assert.ok(c.filter((w) => grade(w, q.answers) !== "wrong").length <= 1, q.text);
  }
});

test("vars は範囲の端まで出て、同じ pool からは重ならずに選ぶ", () => {
  const q = { id: "x", vars: { n: [5, 40, 5], a: "p", b: "p" }, text: "{n} {a} {b}", ja: "{a}" };
  const pools = { p: [{ fr: "Paul", ja: "ポール" }, { fr: "Marc", ja: "マルク" }] };
  assert.equal(instantiate(q, pools, () => 0).text, "5 Paul Marc");
  assert.equal(instantiate(q, pools, () => 0.999).text, "40 Marc Paul");
  assert.equal(instantiate(q, pools, () => 0).ja, "ポール");
  assert.equal(instantiate(q, pools).id, "x");
});

test("シードの {名前} はすべて vars で埋まり、埋めても同じ問題のまま", () => {
  for (const q of questions) {
    const used = [q.text, q.a, q.hint, q.ja].join(" ").match(/\{\w+\}/g) ?? [];
    for (const k of used) assert.ok(q.vars?.[k.slice(1, -1)], `${q.id} ${k}`);
    for (const spec of Object.values(q.vars ?? {})) assert.ok(Array.isArray(spec) || pools[spec], q.id);
    assert.ok(!q.answers.join().includes("{"), q.id); // 語群はほかの問題の answers から作るので、答えには入れない
    for (let i = 0; i < 20; i++) {
      const x = instantiate(q, pools);
      assert.equal(x.id, q.id);
      assert.ok(![x.text, x.a, x.hint, x.ja].join(" ").includes("{"), q.id);
    }
  }
});

test("文頭の空欄の答えは大文字で、それ以外は小文字で始まる", () => {
  for (const q of questions) {
    const head = /(^|[.!?]\s|—\s)$/.test(q.text.split("___")[0]);
    for (const a of q.answers) assert.equal(a[0] === a[0].toUpperCase(), head, `${q.id} ${a}`);
  }
});
