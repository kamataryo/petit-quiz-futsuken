# Petit Quiz Futsuken

仏検の筆記問題を、1問1答の入力式で解き続けるクイズ。ビルドなし。

| | |
|---|---|
| `questions.json` | 問題のシード。`levels` (級) / `types` (形式) / `pools` (入れ替える語) / `questions` |
| `quiz.js` | 採点・語群・入れ替え。字まで合えば ◎、大文字小文字かアクサン (と œ æ) だけ違えば △ |
| `app.js` | 画面。問題を切り混ぜて出し (まだ答えていない問題が先)、尽きたら切り直す |
| `keys.js` | アクサン入力の早見表。`index.html` と `dictée.html` で共用し、読み込むと dialog を足して `#open-keys` で開く |

`fetch` を使うので `file://` では動かない。`python3 -m http.server` などで開く。テストは `node --test`。

## 記録

localStorage の `petit-quiz-futsuken` に、問題ごとの最後の結果 (`id` → `correct` / `case` / `accent` / `wrong`) と
出題モード (`all` / `missed`) と乱数の種 (`seed`) を置く。出題の順・人名や数の入れ替え・語群は種で決まり、「記録をリセット」で種も引き直す。`case` (大文字小文字だけ違う) と `accent` (アクサンも違う) は △ にまとめて数える。
上の成績は「最後に ◎ / △ / × だった問題の数」で、解き直すと上書きされる。
「間違えた問題のみ」は最後が △ か × の問題から出し、◎ になったものから抜けていく。
全部抜けても全問には戻さず「間違えた問題はありません」を出す。モードを変えるのは下のボタンだけ。

## 形式 (`types`)

```json
"verb": { "label": "A とほぼ同じ意味になるように…", "choices": 7 }
```

- `label` は問題の上に出す指示文
- `choices` は語群の数。正解1つに、同じ級・同じ形式のほかの問題の正解を混ぜて並べる。ないと語群は出ない

準2級は公式ガイドブックの大問1〜4 に合わせた: `prep` 前置詞 / `word` 頭文字つきの1語 /
`verb` 書き換えの動詞活用 / `pron` 対話の空欄 (代名詞・関係詞など)。長文は大問5〜7 の `text` / `match` / `dialog`。

## 問題 (`questions`)

```json
{ "id": "pre2-verb-31", "level": "pre2", "type": "verb", "text": "Elle ___ à pleurer.", "cue": "commencer",
  "a": "Elle s'est mise à pleurer.", "answers": ["a commencé"], "note": "se mettre à = commencer à" }
```

- `id` は記録のキー。変えると記録が切れるので、足すときは続きの番号にする
- `text` の `___` が空欄で、そこが入力欄になる。1問に1つ。対話は `\n` で改行
- `a` は書き換え元の文。`text` と同じ大きさで A / B と並べる
- `cue` は `word` では頭文字 (placeholder に出す)。語群のある形式では「形を変えて書く」印で、語群には `cue` を並べ、
  押しても placeholder に薄く入るだけになる (`verb` の不定詞、前置詞の `à` → `au`、`jusque` → `jusqu'` など)。
  `cue` がない問題は、語群を押すと答えがそのまま入る
- `hint` は答える前から出す日本語訳。本試験で訳が出る形式だけ
- `ja` は答えたあとに出す訳。本試験で訳が出ない形式はこちら
- `answers` は正解の候補。複数語でもよい (`à cause de`)。先頭が「正解は」の表示に使われる (語群のある形式は先頭だけを出し、残りは採点で通すだけ)。語群にはこの問題の正解は混ざらない。
  大文字小文字も採点するので、文頭の空欄なら大文字で書く (テストが見ている)。文頭の空欄では語群も大文字で始めて出す
- `avoid` は語群に出さない語。正解にはしないが、選ぶと迷う語 (口語では通る、同義語に見えるなど) を書く
- `note` は答え合わせのあとに出す一言
- `vars` は出すたびに変える部分 (下記)

## 出すたびに変える部分 (`vars` / `pools`)

答えを文ごと覚えてしまわないように、人名・数・曜日などを出題のたびに入れ替える。

```json
"pools": { "homme": [{ "fr": "Paul", "ja": "ポール" }, …] },
{ "id": "pre2-prep-23", "vars": { "m": "homme", "h": [7, 11] },
  "text": "{m} arrivera ___ {h} heures, …", "ja": "{m}は{h}時ごろ着くだろうけど、…" }
```

- `vars` の値が文字列なら `pools` の名前で、そこから1つ選ぶ (同じ問題の中で同じ pool から2つ取っても重ならない)
- 数の配列なら `[最小, 最大, 刻み]` の範囲の整数 (刻みは省略で 1)
- ほかの配列ならその場の一覧で、そこから1つ選ぶ。1問でしか使わない語は `pools` に置かずここに書く
- `text` と `a` には `fr`、`hint` と `ja` には `ja` が入る。`answers` と `note` には使わない
  (語群はほかの問題の `answers` から作るので、答えに `{}` があると語群に出てしまう)
- 要素にはほかの欄も持たせられて、`{名前.欄}` で引く。主語と動詞の一致や冠詞の性など、組で変わるものは1つの要素にまとめる。
  日本語は語順が違うので、`{ "fr": "Ils ont discuté", "ja": "彼らは", "v": "話し合った" }` を `{s}夜遅くまで{s.v}` のように分けて使う

答えまで変わる入れ替え (主語の性数、名詞の性、tu / vous など) は `alts` に書く。

```json
{ "id": "pre2-verb-03", "text": "Elles ne sont pas ___ à l'heure.", "a": "Elles étaient en retard.", "answers": ["arrivées", "venues"], "alts": [
  { "text": "Il n'est pas ___ à l'heure.", "a": "Il était en retard.", "answers": ["arrivé", "venu"] }
] }
```

- 出すたびに元の形と `alts` から1つ選ぶ。`alts` の要素で書いた欄だけが元の欄を置き換え、`vars` は元のものに足される
- 同じ `id` のままなので、記録は同じ問題として積み上がる。`alts` の答えも語群の候補になる
- 文を変えたら訳 (`hint` / `ja`) も書き直す (テストが見ている)。`note` も合わなくなるなら書き直す
- `cue` を消すときは `null` にする (`au printemps` の問題に `en été` を混ぜるときなど)
- 埋めるのは画面に出すときだけで `id` は変わらない。記録は同じ問題のものとして積み上がる
- 人名は性で pool を分けている (一致がずれないように)。母音・無音の h で始まる名前は入れない
  (`que Marie` が `qu'Emma` になるように、前の語のエリジョンが変わるため)

語群からは別解を抜くが、語群にない語でも文が成り立つと答えが割れる。訳なしで答えが1つに決まる文にするか、
別解を `answers` に足す。

## 長文 (`blanks`)

大問5 (`text` 文章) と大問7 (`dialog` 会話) の形。`text` に `___` を5つ置き、`blanks` に空欄ごとの候補を3つずつ、正解を先頭にして書く。

```json
{ "id": "pre2-text-01", "level": "pre2", "type": "text", "vars": {"f": "femme"},
  "text": "{f} travaillait … ___, elle aimait …", "blanks": [["En revanche", "Par exemple", "Tout de suite"], …],
  "hint": "* boulangerie : パン屋", "ja": "全訳", "note": "(1) …\n(2) …" }
```

- 空欄にフォーカスすると、その候補 (アルファベット順) が空欄のすぐ下に出て、押して入れることも書くこともできる。
  datalist は iOS ではキーボードの予測欄に1つ出るだけなので使わない。出したときにはフォーカスしない (iOS の拡大で全体が読めなくなるため)。
  採点は `grade` で、空欄ごと
- 記録は空欄ごとに `pre2-text-01-1` 〜 `-5`。成績も空欄を1問と数える。前に ◎ だった空欄は答えを埋めて出す (復習モードでは間違えた空欄だけ解く)
- 段落や会話の行は `\n` で区切る。会話は `{a} : …` と話し手を頭に書く。画面では話し手と台詞の2列に並べる
- `hint` は本試験の注 (`*`)、`ja` は全訳、`note` は空欄ごとの解説。どれも `\n` で改行できる
- 文頭 (会話は話し手のあとも) の空欄の候補は大文字で始める (テストが見ている)

## 内容一致 (`claims`)

大問6 (`match`) の形。`text` は空欄のない文章で、`claims` に文章と一致するか (`true` / `false`) を付けた文を6つ書く。

```json
{ "id": "pre2-match-01", "level": "pre2", "type": "match", "vars": {"f": "femme"},
  "text": "{f} habite en banlieue* …", "claims": [["{f} habite dans le centre de Lyon.", false], …],
  "hint": "* banlieue : 郊外", "ja": "全訳", "note": "(1) ×「リヨンの中心部に住んでいる」…\n(2) …" }
```

- 文章の下に (1)〜(6) を並べ、文ごとに ○ か × を押す。全部選ぶまで回答できない
- 記録・成績・出やすさは長文と同じで、文ごとに `pre2-match-01-1` 〜 `-6`。前に ◎ だった文は答えを選んで出す
- `claims` の文にも `vars` が入る。`note` は文ごとに1行で、名前は入らないので主語を省いて書く (テストが見ている)
- ○ と × はどちらも入れる

## 対義語・類義語

`word` (語彙) の問題で `note` に対義語・類義語 (`⇔` や `=`) を書いたら、その語を答えにした問題も別の `id` で足して、
両方を出す (`avoir raison` の `pre2-word-03` と `avoir tort` の `pre2-word-42` など)。記録は別々に付く。

## 書き取り (`dictée.html` / `dictees.json`)

準2級の書き取り (ディクテ)。再生ボタンで ふつう → ふつう → ゆっくり → ふつう の4回を通しで読み、何回目かを出す。
textarea に書いて「答え合わせ」を押すと、語ごとに比べる (`diffWords`)。アクサン・大文字小文字だけ違えば △、書き違えた語・抜けた語は ×。記録は付けない。

```json
{ "name": "練習 1", "text": "Ma sœur habite à Lyon / depuis le printemps. / Elle travaille / …", "ja": "全訳" }
```

- 音声はブラウザの読み上げ (speechSynthesis)。ゆっくりは ` / ` の区切りごとに読み、句読点 (point, virgule) を言って、書く間を空ける。
  句読点は区切りの終わりにだけ置く (テストが見ている)。速さと間は `dictée.html` の `RATE` / `pause` で変える
- 声は端末に入っているフランス語の声から選ぶ (localStorage の `petit-quiz-futsuken-voice` に覚える)。
  既定はプレミアム・拡張 > Google > ほか。Eddy や Grandma などの粗い声は後ろに回す
- 答えは `text` から ` / ` を抜いたもの。数は数字で書く

## 2級以上を足すとき

`levels` に `"2": "2級"` を足し、`"level": "2"` の問題を足す。新しい形式なら `types` も足す。
級は `?level=2` で選ぶ (画面での切り替えはまだない。ないときは `levels` の先頭)。
どの級にも問題があること、`id` が重ならないこと、語群を埋めるだけの語があることはテストが見ている。

## OGP 画像とアイコン

`assets/ogp.html` (1200×630) と `assets/icon.html` (512×512) が元で、Chrome のスクショで png にする。
`index.html` の `og:url` / `og:image` は GitHub Pages の URL を絶対パスで書いている。

```sh
pushd assets && for f in ogp:1200,630 icon:512,512; do n=${f%%:*}; "/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --hide-scrollbars --force-device-scale-factor=1 --virtual-time-budget=5000 --window-size=${f#*:} --screenshot="$PWD/$n.png" "file://$PWD/$n.html"; done; popd
```
