import { atHead, choiceOf, choices, grade, instantiate, seeded, shuffle } from "./quiz.js";

// iOS の自動の拡大 (入力欄にフォーカスしたときなど) を止める。長文の行の右が見切れ、下に固定したボタンや候補の位置もずれるため。
// iOS は maximum-scale=1 でもピンチでは拡大できる。Android はピンチも止まってしまうので付けない (iPad は Mac の UA を名乗るのでタッチの数で見る)
if (navigator.maxTouchPoints > 1 && /iPhone|iPad|Macintosh/.test(navigator.userAgent))
  document.querySelector("meta[name=viewport]").content += ",maximum-scale=1";

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

// 記録は問題ごとの最後の結果 (id → grade の結果) と出題モード (all / missed) と乱数の種。
// 種はリセットするまで変えない。出題の順も、人名や数の入れ替えも、語群もこの種で決まり、開き直しても同じになる
const KEY = "petit-quiz-futsuken";
const state = { results: {}, mode: "all", seed: Math.random() };
try { Object.assign(state, JSON.parse(localStorage.getItem(KEY))); } catch {}
const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch {} };
save(); // 答える前に閉じても種が残るように
const rand = (k) => seeded(`${state.seed}-${k}`);
// 長文は空欄ごと (内容一致は文ごと) に `${id}-${番号}` で記録し、成績でも1つを1問と数える
const ids = (x) => (x.blanks ?? x.claims)?.map((_, i) => `${x.id}-${i + 1}`) ?? [x.id];
const isMissed = (id) => ![undefined, "correct"].includes(state.results[id]);

let deck = [];
let q;

// 回答するは (長文なら全部の空欄に) 1文字入るまで押せない。既定の送信ボタンが disabled だと Enter でもフォームは送られないので、空のまま採点されることはない。
// 内容一致は全部の文に ○ か × を選ぶまで
const sync = () => {
  // 書いた欄に印を付ける。CSS はフォーカスを外れた欄を中身の幅まで縮める
  for (const b of [input, ...blanks()]) b.classList.toggle("filled", !!b.value.trim());
  $("submit").disabled = q.claims
    ? [...$("claims").children].some((li) => !li.querySelector("[aria-pressed=true]"))
    : (q.blanks ? blanks() : [input]).some((b) => !b.value.trim());
};
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
    : `間違えた問題のみ（${missed} 問）`;
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
  // 長文は残っている空欄 (内容一致は文) の数だけ (1〜6 倍) 先に出やすくする。1問1答は重み 1
  if (!deck.length) deck = shuffle(pool.filter(isLeft), (x) => ids(x).filter(left).length, (x) => rand(x.id)());
  const r = rand(`${deck.at(-1).id}-q`); // 並びに使った数とは別の列にする
  q = instantiate(deck.pop(), pools, r); // 人名や数をここで埋める。id はそのまま
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
  $("choices").replaceChildren(...(n ? choices(q, questions, n, r) : []).map((w) =>
    Object.assign(document.createElement("button"), { type: "button", textContent: head ? w[0].toUpperCase() + w.slice(1) : w })));
  input.value = "";
  input.placeholder = n ? "" : q.cue ?? "";
  input.readOnly = false;
  // 長文は空欄ごとに入力欄を置く。候補はフォーカスした空欄の下に出す (下の focusin)。
  // 前に正解した空欄は答えを埋めて閉じておく (復習モードで、間違えた空欄だけ解き直す)
  const long = !!(q.blanks || q.claims);
  $("b-line").hidden = long;
  $("passage").hidden = !long;
  $("opts").replaceChildren();
  // 内容一致は文章の下に (1)〜(6) を並べ、それぞれ ○ か × を押す。前に正解した文は答えを選んで閉じておく
  $("claims").replaceChildren(...(q.claims ?? []).map(([s, ok], i) => {
    const ox = span("ox", "");
    ox.append(...["○", "×"].map((m) => Object.assign(document.createElement("button"), { type: "button", textContent: m, ariaPressed: "false" })));
    const li = document.createElement("li");
    li.append(span("", nb(`(${i + 1}) ${s}`)), ox);
    if (state.results[`${q.id}-${i + 1}`] === "correct") {
      li.dataset.r = "correct";
      ox.children[ok ? 0 : 1].ariaPressed = "true";
    }
    return li;
  }));
  if (long) {
    let i = 0; // 通しの空欄番号
    const blank = () => {
      const opts = q.blanks[i++];
      const b = Object.assign(document.createElement("input"), { placeholder: i, ariaLabel: `空欄 ${i}`, autocomplete: "off",
        spellcheck: false, enterKeyHint: "go", autocapitalize: /^\p{Lu}/u.test(opts[0]) ? "sentences" : "off" });
      b.setAttribute("autocorrect", "off");
      if (state.results[`${q.id}-${i}`] === "correct") {
        b.value = opts[0];
        b.readOnly = true;
        b.dataset.r = "correct";
      }
      return [span("paren", "("), b, span("paren", ")")];
    };
    const fill = (s) => nb(s).split("___").flatMap((t, j) => (j ? [...blank(), t] : [t]));
    // 会話は「話し手 : 台詞」の行を、話し手と台詞の2列に並べる
    const dialog = q.type === "dialog";
    $("passage").classList.toggle("dialog", dialog);
    $("passage").replaceChildren(...(dialog
      ? q.text.split("\n").flatMap((l) => {
          const [, who, said] = l.match(/^(.*?) : (.*)$/);
          const line = document.createElement("span");
          line.append(...fill(said));
          return [span("who", who), line];
        })
      : fill(q.text)));
  }
  sync();
  // 次の問題はいちばん上から見せる (長文を解いたあとは下まで送っていて、頭が見切れる)。スクロールの動きはつけず一気に
  scrollTo({ top: 0, behavior: "instant" });
  // 長文は出したときにはフォーカスしない。iOS は入力欄にフォーカスすると拡大するので、まず全体を読めるように
  if (long) document.activeElement.blur();
  else focus();
  // 問題が変わったのがわかるように、ふわっと出す
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
    main.animate([{ opacity: 0, transform: "translateY(.6rem)" }, {}], { duration: 400, easing: "ease-out" });
}

// 入力欄をタップしたら必ずキーボードが開くように。タップでフォーカスが付き直る前に外しておく (長文の空欄も)
$("form").addEventListener("touchstart", (e) => {
  if (e.target.matches("input") && innerHeight - vv.height < 100) e.target.blur();
});

// 長文の候補。datalist は iOS だとキーボードの予測欄に1つ出るだけなので、フォーカスした空欄のすぐ下に候補 (アルファベット順) を縦に並べる。
// 見えている範囲 (iOS がフォーカスで拡大したあとも) からはみ出さないよう左右を寄せ、下に入らなければ空欄の上に出す。
// 押すと入れて、まだ空いている次の空欄へ移る。押してもフォーカスは空欄に残す (キーボードを閉じない)
let cur;
const place = () => {
  const o = $("opts");
  if (!o.childElementCount) return;
  const r = cur.getBoundingClientRect(); // layout viewport が基準。vv.offsetTop / pageLeft と合わせて見えている範囲を出す
  const below = r.bottom + 4 + o.offsetHeight <= vv.offsetTop + vv.height - $("actions").offsetHeight;
  o.style.top = `${scrollY + (below ? r.bottom + 4 : r.top - 4 - o.offsetHeight)}px`;
  o.style.left = `${Math.max(vv.pageLeft + 4, Math.min(scrollX + r.left, vv.pageLeft + vv.width - 4 - o.offsetWidth))}px`;
  return below;
};
vv.addEventListener("resize", place);
vv.addEventListener("scroll", place);
$("passage").addEventListener("focusin", ({ target: b }) => {
  cur = b;
  if (b.readOnly || answered()) return;
  const opts = q.blanks[blanks().indexOf(b)].toSorted((x, y) => x.localeCompare(y, "fr"));
  $("opts").replaceChildren(...opts.map((o) => Object.assign(document.createElement("button"), { textContent: o, ariaPressed: String(o === b.value) })));
  // 空欄の側から広げる (下に出すときは上から下へ、上に出すときは下から上へ)
  const below = place();
  if (!matchMedia("(prefers-reduced-motion: reduce)").matches)
    $("opts").animate({ clipPath: [below ? "inset(0 0 100% 0)" : "inset(100% 0 0 0)", "inset(0)"], translate: [`0 ${below ? -6 : 6}px`, "0"] },
      { duration: 200, easing: "ease-out" });
});
$("passage").addEventListener("focusout", () => $("opts").replaceChildren());
$("opts").onmousedown = (e) => e.preventDefault();
$("opts").onclick = (e) => {
  const o = e.target.closest("button");
  if (!o || answered()) return;
  cur.value = o.textContent;
  for (const x of $("opts").children) x.ariaPressed = String(x === o);
  sync();
  focus(blanks().find((b) => !b.readOnly && !b.value) ?? cur);
};

// 内容一致の ○ ×。文ごとにどちらか1つ
$("claims").onclick = (e) => {
  const b = e.target.closest("button");
  if (!b || answered() || b.closest("li").dataset.r) return;
  for (const x of b.parentNode.children) x.ariaPressed = String(x === b);
  sync();
};

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
  if (matchMedia("(pointer: coarse)").matches && !answered() && !q.blanks && !q.claims && !e.target.closest("button, input")) focus();
});

// Enter 1回目で採点、2回目で次へ
$("form").onsubmit = (e) => {
  e.preventDefault();
  if (answered()) return next();
  if (q.blanks || q.claims) {
    // 空欄 (内容一致は文) ごとに採点して記録する。前に正解したもの (readOnly の空欄、data-r のある文) はそのまま
    const n = { correct: 0, partial: 0, wrong: 0 };
    const put = (i, el, r) => { state.results[`${q.id}-${i + 1}`] = r; n[(el.dataset.r = bucket(r))]++; };
    if (q.blanks) {
      blanks().forEach((b, i) => {
        if (b.readOnly) return;
        const ans = q.blanks[i][0];
        const r = grade(b.value, [ans]);
        put(i, b, r);
        if (r !== "correct") b.after(span("fix", ans));
        b.readOnly = true;
      });
    } else {
      [...$("claims").children].forEach((li, i) => {
        const [o, x] = li.querySelectorAll("button");
        const ok = q.claims[i][1];
        (ok ? o : x).classList.add("answer");
        if (!li.dataset.r) put(i, li, (o.ariaPressed === "true") === ok ? "correct" : "wrong");
      });
    }
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

// 答え合わせのあと入力欄の外をクリックしていても、Enter で次へ進む。ボタンの上の Enter はそのボタンを押す (アクサンの入力方法など)。
// ただし内容一致の ○ × は答えたあとは押せないので、フォーカスが残っていても次へ進む (Chrome は押したボタンにフォーカスが残る)
document.addEventListener("keydown", (e) => {
  if ($("keys").open) return;
  if (e.key === "Enter" && answered() && (!e.target.closest("button, input") || e.target.closest("#claims"))) { e.preventDefault(); next(); }
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
  state.seed = Math.random();
  deck = [];
  save();
  next();
};

next();
