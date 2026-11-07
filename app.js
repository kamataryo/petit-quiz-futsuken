import { atHead, choiceOf, choices, grade, instantiate, shuffle } from "./quiz.js";

const { levels, types, pools, questions } = await fetch("./questions.json").then((r) => r.json());
const $ = (id) => document.getElementById(id);
const main = document.querySelector("main");
const input = $("answer");
const vv = visualViewport;
// iOS はフォーカスを残したままキーボードだけ閉じることがあり、そうなると focus() もタップも効かなくなる。
// キーボードが出ていない (見えている高さが画面とほぼ同じ) のにフォーカスがあれば、いったん外してから付け直す
const focus = (el = input) => {
  if (document.activeElement === el && innerHeight - vv.height < 100) el.blur();
  el.focus();
};
// 答え合わせのあとか
const answered = () => "result" in main.dataset;
// 長文 (blanks のある問題) の空欄
const blanks = () => [...$("passage").querySelectorAll("input")];
const span = (className, textContent) => Object.assign(document.createElement("span"), { className, textContent });
// grade の結果を3段に畳む。case (大文字小文字だけ違う) と accent (アクサンだけ違う) は部分正解
const bucket = (r) => (r === "correct" || r === "wrong" ? r : "partial");
const MARK = { correct: "◎", partial: "△", wrong: "×" };
// フランス語は ? ! : ; » の前と « のあとに空白を置く。記号だけ別の行に落ちないよう、改行しない細い空白にする
const nb = (s) => s?.replace(/ ([?!:;»])/g, " $1").replace(/« /g, "« ");

// 級は ?level=pre2 で選ぶ。画面での切り替えはまだない
const level = new URLSearchParams(location.search).get("level") ?? Object.keys(levels)[0];
const pool = questions.filter((x) => x.level === level);

// 記録は問題ごとの最後の結果 (id → grade の結果) と出題モード (all / missed)
const KEY = "petit-quiz-futsuken";
const state = { results: {}, mode: "all" };
try { Object.assign(state, JSON.parse(localStorage.getItem(KEY))); } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
// 長文は空欄ごとに `${id}-${番号}` で記録し、成績でも空欄を1問と数える
const ids = (x) => x.blanks?.map((_, i) => `${x.id}-${i + 1}`) ?? [x.id];
const isMissed = (id) => ![undefined, "correct"].includes(state.results[id]);

let deck = [];
let q;

// 回答するは (長文なら全部の空欄に) 1文字入るまで押せない。既定の送信ボタンが disabled だと Enter でもフォームは送られないので、空のまま採点されることはない
const sync = () => { $("submit").disabled = (q.blanks ? blanks() : [input]).some((b) => !b.value.trim()); };
$("form").addEventListener("input", sync);

function render() {
  const all = pool.flatMap(ids);
  const n = { correct: 0, partial: 0, wrong: 0 };
  for (const id of all) if (state.results[id]) n[bucket(state.results[id])]++;
  for (const k in n) {
    $(`n-${k}`).textContent = n[k];
    $(`bar-${k}`).style.width = `${(n[k] / all.length) * 100}%`;
  }
  $("n-total").textContent = all.length;
  const missed = n.partial + n.wrong;
  $("mode").textContent = state.mode === "missed"
    ? `全問から出題する（復習のこり ${missed} 問）`
    : `間違えた問題だけ解く（${missed} 問）`;
  $("mode").disabled = state.mode === "all" && !missed;
  document.body.dataset.mode = state.mode;
}

// 全問モードの問題ストックは「まだ記録のない問題」。記録は localStorage にあるので、閉じても続きから出る。
// 尽きたら「記録をリセット」を押すまで出さない。復習モードは間違えた問題がなくなるまで切り直して出す
const left = (id) => (state.mode === "missed" ? isMissed(id) : !(id in state.results));
const isLeft = (x) => ids(x).some(left);

function next() {
  delete main.dataset.result;
  // 出す問題がなくなっても、モードは下のボタンで戻すまで変えない
  const none = !pool.some(isLeft);
  main.hidden = none;
  $("empty").hidden = !none || state.mode !== "missed";
  $("done").hidden = !none || state.mode !== "all";
  render();
  if (none) return;
  // 長文は残っている空欄の数だけ (1〜5 倍) 先に出やすくする。1問1答は重み 1
  if (!deck.length) deck = shuffle(pool.filter(isLeft), (x) => ids(x).filter(left).length);
  q = instantiate(deck.pop(), pools); // 人名や数をここで埋める。id はそのまま
  const { label, choices: n } = types[q.type];
  $("type").textContent = label;
  $("hint").textContent = q.hint ?? "";
  $("a").textContent = nb(q.a) ?? "";
  $("a-line").hidden = $("tag-b").hidden = !q.a;
  // 入力欄は DOM から外さずに前後の文だけ差し替える。外すとスマホのキーボードが閉じる
  [$("before").textContent, $("after").textContent] = nb(q.text).split("___");
  $("fix").textContent = $("result").textContent = $("ja").textContent = $("note").textContent = "";
  // 文頭の空欄では語群も大文字で始める。押して入れた語が大文字・小文字違いにならないように
  const head = atHead(q.text);
  // 大文字小文字も採点するので、文頭の空欄だけスマホのキーボードを大文字から始める
  input.autocapitalize = head ? "sentences" : "off";
  $("choices").replaceChildren(...(n ? choices(q, questions, n) : []).map((w) =>
    Object.assign(document.createElement("button"), { type: "button", textContent: head ? w[0].toUpperCase() + w.slice(1) : w })));
  input.value = "";
  input.placeholder = n ? "" : q.cue ?? "";
  input.readOnly = false;
  // 長文は空欄ごとに datalist つきの入力欄 (候補から選ぶことも書くこともできる) を置く。候補はアルファベット順。
  // 前に正解した空欄は答えを埋めて閉じておく (復習モードで、間違えた空欄だけ解き直す)
  $("b-line").hidden = !!q.blanks;
  $("passage").hidden = !q.blanks;
  if (q.blanks) {
    const parts = nb(q.text).split("___");
    $("passage").replaceChildren(parts[0], ...q.blanks.flatMap((opts, i) => {
      const b = Object.assign(document.createElement("input"), { placeholder: i + 1, ariaLabel: `空欄 ${i + 1}`, autocomplete: "off",
        spellcheck: false, enterKeyHint: "go", autocapitalize: /^\p{Lu}/u.test(opts[0]) ? "sentences" : "off" });
      b.setAttribute("autocorrect", "off");
      b.setAttribute("list", `opts-${i}`);
      if (state.results[`${q.id}-${i + 1}`] === "correct") {
        b.value = opts[0];
        b.readOnly = true;
        b.dataset.r = "correct";
      }
      const list = Object.assign(document.createElement("datalist"), { id: `opts-${i}` });
      list.append(...opts.toSorted((x, y) => x.localeCompare(y, "fr")).map((o) => new Option(o)));
      return [span("paren", "("), b, span("paren", ")"), list, parts[i + 1]];
    }));
  }
  sync();
  focus(q.blanks ? blanks().find((b) => !b.readOnly) : input);
  // 問題が変わったのがわかるように、ふわっと出す
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
    main.animate([{ opacity: 0, transform: "translateY(.6rem)" }, {}], { duration: 400, easing: "ease-out" });
}

// 入力欄をタップしたら必ずキーボードが開くように。タップでフォーカスが付き直る前に外しておく (長文の空欄も)
$("form").addEventListener("touchstart", (e) => {
  if (e.target.matches("input") && innerHeight - vv.height < 100) e.target.blur();
});

// 形を変えて書く問題 (cue があるもの: 動詞の活用、à → au など) は placeholder に薄く入れるだけで、書くのは自分。
// 語群の語をそのまま書く問題は答えを埋める
$("choices").onclick = (e) => {
  const b = e.target.closest("button");
  if (!b || answered()) return;
  for (const x of $("choices").children) x.ariaPressed = String(x === b);
  if (q.cue) input.placeholder = b.textContent;
  else input.value = b.textContent;
  sync();
  focus();
};

// スマホでブラウザを開き直すと、入力欄にフォーカスはあるのにキーボードが出ていないことがある。キーボードはタップの中でしか開けないので、
// 答える前なら問題のあたりのどこをタップしても入力欄に付け直す。PC ではクリックで文字を選べなくなるので、指で触る画面だけ。
// 長文は空欄が複数あるので、どこに付けるかは決めない
main.addEventListener("click", (e) => {
  if (matchMedia("(pointer: coarse)").matches && !answered() && !q.blanks && !e.target.closest("button, input")) focus();
});

// Enter 1回目で採点、2回目で次へ
$("form").onsubmit = (e) => {
  e.preventDefault();
  if (answered()) return next();
  if (q.blanks) {
    // 空欄ごとに採点して記録する。前に正解して埋めてある空欄 (readOnly) はそのまま
    const n = { correct: 0, partial: 0, wrong: 0 };
    blanks().forEach((b, i) => {
      if (b.readOnly) return;
      const ans = q.blanks[i][0];
      const r = grade(b.value, [ans]);
      state.results[`${q.id}-${i + 1}`] = r;
      n[(b.dataset.r = bucket(r))]++;
      if (r !== "correct") b.after(span("fix", ans));
      b.readOnly = true;
    });
    main.dataset.result = n.wrong ? "wrong" : n.partial ? "partial" : "correct";
    $("result").textContent = Object.entries(n).map(([k, c]) => `${MARK[k]} ${c}`).join("　");
  } else {
    const r = grade(input.value, q.answers);
    state.results[q.id] = r;
    main.dataset.result = bucket(r);
    input.readOnly = true; // disabled だとフォーカスが外れてスマホのキーボードが閉じる
    input.placeholder = "";
    // 部分正解なら、書こうとした答え (別解に寄せて書いたときはその別解) を出す
    const near = r === "wrong" ? undefined : q.answers.find((a) => grade(input.value, [a]) === r);
    if (r !== "correct") $("fix").textContent = near ?? q.answers[0];
    const why = { case: "大文字・小文字違い", accent: "アクサン違い", wrong: "不正解" }[r];
    // 不正解のとき、語群のある形式は先頭の答えだけ出す。別解 (語群にない動詞など) は採点では通すが、出すと「語群から選ぶ」と食い違う
    const shown = near ? [near] : types[q.type].choices ? q.answers.slice(0, 1) : q.answers;
    $("result").textContent = r === "correct" ? "◎ 正解" : `${MARK[bucket(r)]} ${why} — ${shown.join(" / ")}`;
    for (const b of $("choices").children) b.classList.toggle("answer", b.textContent.toLowerCase() === choiceOf(q));
  }
  save();
  $("ja").textContent = q.ja ?? "";
  $("note").textContent = q.note ?? "";
  render();
  // 判定と解説が、キーボードと下のボタンに隠れないところまで送る。判定の行は見えている範囲の上端より上に出さない
  const last = [$("note"), $("ja"), $("result")].find((e) => e.textContent);
  const over = last.getBoundingClientRect().bottom - (vv.offsetTop + vv.height - $("actions").offsetHeight);
  if (over > 0) scrollBy(0, Math.min(over, $("result").getBoundingClientRect().top - vv.offsetTop));
};

// 答え合わせのあと入力欄の外をクリックしていても、Enter で次へ進む。ボタンの上の Enter はそのボタンを押す (アクサンの入力方法など)
document.addEventListener("keydown", (e) => {
  if ($("keys").open) return;
  if (e.key === "Enter" && answered() && !e.target.closest("button, input")) { e.preventDefault(); next(); }
});

// アクサン入力の早見表。開いたときは OS に合わせ、中の切り替えで Mac / Windows を見比べられる
const setOs = (os) => {
  $("keys").dataset.os = os;
  for (const b of $("keys").querySelectorAll(".seg button")) b.ariaPressed = String(b.dataset.os === os);
};
setOs(/win/i.test(navigator.userAgentData?.platform ?? navigator.platform) ? "win" : "mac");
$("keys").querySelector(".seg").onclick = (e) => e.target.dataset.os && setOs(e.target.dataset.os);
$("open-keys").onclick = () => $("keys").showModal();
// 枠の外 (背景) を押したら閉じる。式で書くと false を返し、on* では preventDefault 扱いになって × (method="dialog") が効かなくなる
$("keys").onclick = (e) => { if (e.target === $("keys")) $("keys").close(); };
$("keys").onclose = () => input.focus();

// 回答する・次にすすむはどちらもフォームの送信ボタン。onsubmit が採点か次へかを決める (next() はタップの中で focus するので、キーボードもまた開く)
// 押してもフォーカスを入力欄から動かさず、キーボードを閉じない
$("actions").onmousedown = (e) => e.preventDefault();
// iOS はキーボードが出ても画面 (layout viewport) が縮まず、下端に固定したボタンが隠れる。見えている範囲の下端まで持ち上げる
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
