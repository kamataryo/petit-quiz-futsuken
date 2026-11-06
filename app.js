import { atHead, choiceOf, choices, grade, instantiate, shuffle } from "./quiz.js";

const { levels, types, pools, questions } = await fetch("./questions.json").then((r) => r.json());
const $ = (id) => document.getElementById(id);
const main = document.querySelector("main");
const input = $("answer");
// grade の結果を3段に畳む。case (大文字小文字だけ違う) と accent (アクサンだけ違う) は部分正解
const bucket = (r) => (r === "correct" || r === "wrong" ? r : "partial");
const MARK = { correct: "◎", partial: "△", wrong: "×" };

// 級は ?level=pre2 で選ぶ。画面での切り替えはまだない
const level = new URLSearchParams(location.search).get("level") ?? Object.keys(levels)[0];
const pool = questions.filter((x) => x.level === level);

// 記録は問題ごとの最後の結果 (id → grade の結果) と出題モード (all / missed)
const KEY = "petit-quiz-futsuken";
const state = { results: {}, mode: "all" };
try { Object.assign(state, JSON.parse(localStorage.getItem(KEY))); } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
const isMissed = (x) => ![undefined, "correct"].includes(state.results[x.id]);

let deck = [];
let q;
let shown = 0; // 問題を出した時刻

function render() {
  const n = { correct: 0, partial: 0, wrong: 0 };
  for (const x of pool) if (state.results[x.id]) n[bucket(state.results[x.id])]++;
  for (const k in n) {
    $(`n-${k}`).textContent = n[k];
    $(`bar-${k}`).style.width = `${(n[k] / pool.length) * 100}%`;
  }
  $("n-total").textContent = pool.length;
  const missed = n.partial + n.wrong;
  $("mode").textContent = state.mode === "missed"
    ? `全問から出題する（復習のこり ${missed} 問）`
    : `間違えた問題だけ解く（${missed} 問）`;
  $("mode").disabled = state.mode === "all" && !missed;
  document.body.dataset.mode = state.mode;
}

// 全問モードの問題ストックは「まだ記録のない問題」。記録は localStorage にあるので、閉じても続きから出る。
// 尽きたら「記録をリセット」を押すまで出さない。復習モードは間違えた問題がなくなるまで切り直して出す
const isLeft = (x) => (state.mode === "missed" ? isMissed(x) : !(x.id in state.results));

function next() {
  delete main.dataset.result;
  // 出す問題がなくなっても、モードは下のボタンで戻すまで変えない
  const none = !pool.some(isLeft);
  main.hidden = none;
  $("empty").hidden = !none || state.mode !== "missed";
  $("done").hidden = !none || state.mode !== "all";
  render();
  if (none) return;
  if (!deck.length) deck = shuffle(pool.filter(isLeft));
  q = instantiate(deck.pop(), pools); // 人名や数をここで埋める。id はそのまま
  const { label, choices: n } = types[q.type];
  $("type").textContent = label;
  $("hint").textContent = q.hint ?? "";
  $("a").textContent = q.a ?? "";
  $("a-line").hidden = $("tag-b").hidden = !q.a;
  // 入力欄は DOM から外さずに前後の文だけ差し替える。外すとスマホのキーボードが閉じる
  [$("before").textContent, $("after").textContent] = q.text.split("___");
  $("fix").textContent = $("result").textContent = $("ja").textContent = $("note").textContent = "";
  // 文頭の空欄では語群も大文字で始める。押して入れた語が大文字・小文字違いにならないように
  const head = atHead(q.text);
  $("choices").replaceChildren(...(n ? choices(q, questions, n) : []).map((w) =>
    Object.assign(document.createElement("button"), { type: "button", textContent: head ? w[0].toUpperCase() + w.slice(1) : w })));
  input.value = "";
  input.placeholder = n ? "" : q.cue ?? "";
  input.readOnly = false;
  input.focus();
  shown = Date.now();
}

// 形を変えて書く問題 (cue があるもの: 動詞の活用、à → au など) は placeholder に薄く入れるだけで、書くのは自分。
// 語群の語をそのまま書く問題は答えを埋める
$("choices").onclick = (e) => {
  const b = e.target.closest("button");
  if (!b || input.readOnly) return;
  for (const x of $("choices").children) x.ariaPressed = String(x === b);
  if (q.cue) input.placeholder = b.textContent;
  else input.value = b.textContent;
  input.focus();
};

// Enter 1回目で採点 (空なら無回答で ×)、2回目で次へ
$("form").onsubmit = (e) => {
  e.preventDefault();
  if (input.readOnly) return next();
  // Enter の押しすぎで次の問題まで無回答にしない。出してすぐ (1秒以内) の空欄の Enter は受け付けない
  if (!input.value.trim() && Date.now() - shown < 1000) return;
  const r = grade(input.value, q.answers);
  state.results[q.id] = r;
  save();
  main.dataset.result = bucket(r);
  input.readOnly = true; // disabled だとフォーカスが外れてスマホのキーボードが閉じる
  input.placeholder = "";
  if (r !== "correct") $("fix").textContent = q.answers[0];
  const why = { case: "大文字・小文字違い", accent: "アクサン違い", wrong: input.value.trim() ? "不正解" : "無回答" }[r];
  $("result").textContent = r === "correct" ? "◎ 正解" : `${MARK[bucket(r)]} ${why} — ${q.answers.join(" / ")}`;
  $("ja").textContent = q.ja ?? "";
  $("note").textContent = q.note ?? "";
  for (const b of $("choices").children) b.classList.toggle("answer", b.textContent.toLowerCase() === choiceOf(q));
  render();
};

// 答え合わせのあと入力欄の外をクリックしていても、Enter で次へ進む
document.addEventListener("keydown", (e) => {
  if ($("keys").open) return;
  if (e.key === "Enter" && input.readOnly && e.target !== input) { e.preventDefault(); next(); }
});

// アクサン入力の早見表。開いたときは OS に合わせ、中の切り替えで Mac / Windows を見比べられる
const setOs = (os) => {
  $("keys").dataset.os = os;
  for (const b of $("keys").querySelectorAll(".seg button")) b.ariaPressed = String(b.dataset.os === os);
};
setOs(/win/i.test(navigator.userAgentData?.platform ?? navigator.platform) ? "win" : "mac");
$("keys").querySelector(".seg").onclick = (e) => e.target.dataset.os && setOs(e.target.dataset.os);
$("open-keys").onclick = () => $("keys").showModal();
$("keys").onclick = (e) => e.target === $("keys") && $("keys").close(); // 枠の外 (背景) を押したら閉じる
$("keys").onclose = () => input.focus();

// 回答する・次にすすむはどちらもフォームの送信ボタン。onsubmit が採点か次へかを決める (next() はタップの中で focus するので、キーボードもまた開く)
// 押してもフォーカスを入力欄から動かさず、キーボードを閉じない
$("actions").onmousedown = (e) => e.preventDefault();
// iOS はキーボードが出ても画面 (layout viewport) が縮まず、下端に固定したボタンが隠れる。見えている範囲の下端まで持ち上げる
const vv = visualViewport;
const lift = () => { $("actions").style.transform = `translateY(${Math.min(0, vv.offsetTop + vv.height - innerHeight)}px)`; };
vv.addEventListener("resize", lift);
vv.addEventListener("scroll", lift);

$("mode").onclick = () => {
  state.mode = state.mode === "missed" ? "all" : "missed";
  deck = [];
  save();
  next();
};

$("reset").onclick = () => {
  if (!confirm("正解・不正解の記録をすべて消して、全問を最初から出題します。よろしいですか？")) return input.focus();
  state.results = {};
  state.mode = "all"; // 記録を消すと復習する問題はないので、全問にもどす
  deck = [];
  save();
  next();
};

next();
