// アクサン入力の早見表。index.html と dictée.html で共用する。
// 読み込むと dialog#keys を足し、画面の #open-keys で開けるようにする。閉じたあとのフォーカスは画面ごとに #keys の onclose で決める
// 色と字は画面の :root の変数 (--paper, --ink, --rule など) を使う
document.head.insertAdjacentHTML("beforeend", `<style>
  /* アクサン入力の早見表。data-os に合わせて片方の section だけ見せる */
  #keys {
    width: min(34rem, calc(100% - 2rem));
    max-height: calc(100dvh - 2rem);
    padding: 0; /* 余白は .inner に持たせる。dialog 自身への click を「背景を押した」と見なすため */
    border: 1px solid var(--rule);
    border-radius: .75rem;
    background: var(--paper);
    color: var(--ink);
  }
  #keys::backdrop { background: rgb(0 0 0 / .45); }
  #keys .inner { padding: 1.25rem 1.25rem 1.5rem; display: flex; flex-direction: column; gap: .6rem; }
  #keys[data-os="mac"] section[data-os="win"], #keys[data-os="win"] section[data-os="mac"] { display: none; }
  #keys section { display: flex; flex-direction: column; gap: .5rem; }
  #keys .head { display: flex; align-items: center; gap: .75rem; }
  #keys .head h2 { font: 600 1.05rem var(--body); margin: 0 auto 0 0; }
  #keys .head form { margin: 0; }
  #keys .seg { display: inline-flex; align-self: start; border: 1px solid var(--rule); border-radius: .5rem; overflow: hidden; }
  #keys .seg button { border-radius: 0; font: .85rem var(--body); padding: .3rem .8rem; background: none; color: var(--ink-soft); border: 0; cursor: pointer; }
  #keys .seg [aria-pressed="true"] { background: var(--ink); color: var(--paper); }
  #keys .close { font: 1.3rem/1 var(--body); color: var(--ink-soft); background: none; border: 0; padding: .2rem .4rem; cursor: pointer; min-width: 2.2rem; min-height: 2.2rem; } /* スマホで 44px 以上 */
  #keys h3 { font: 600 .9rem var(--body); margin: .6rem 0 0; }
  #keys p { margin: 0; }
  #keys .sub { font-size: .8rem; line-height: 1.7; color: var(--ink-soft); }
  #keys .foot { margin-top: .6rem !important; padding-top: .8rem; border-top: 1px solid var(--rule); }
  #keys table { border-collapse: collapse; align-self: start; }
  #keys th { font: 500 1.2rem var(--display); text-align: left; padding: .2rem 1.25rem .2rem 0; white-space: nowrap; }
  #keys td { font-size: .85rem; padding: .2rem 0; }
  #keys kbd {
    display: inline-block;
    min-width: 1.6em;
    margin: 0 .1rem;
    padding: .05rem .35rem;
    font: .8rem var(--body);
    text-align: center;
    border: 1px solid var(--rule);
    border-bottom-width: 2px;
    border-radius: .3rem;
  }
  #keys .alt { list-style: none; margin: 0; padding: 0; display: grid; grid-template-columns: repeat(auto-fill, minmax(5.5rem, 1fr)); gap: .3rem .75rem; font-size: .85rem; font-variant-numeric: tabular-nums; }
  #keys .alt b { font: 500 1.15rem var(--display); margin-right: .4rem; }
  @media (hover: hover) { #keys .close:hover, #keys .seg button:not([aria-pressed="true"]):hover { color: var(--ink); } }
  /* アクサンの早見表は PC のキーボードの打ち方なので、指で触る画面 (iPhone など) では出さない */
  @media (pointer: coarse) { #open-keys { display: none; } }
</style>`);
document.body.insertAdjacentHTML("beforeend", `<dialog id="keys" aria-labelledby="keys-title">
  <div class="inner">
    <div class="head">
      <h2 id="keys-title">アクサンの入力方法</h2>
      <form method="dialog"><button class="close" aria-label="閉じる">×</button></form>
    </div>
    <!-- 見出しと同じ行に置くと、狭い画面で見出しが割れたり × の下に潜ったりするので、行を分ける -->
    <div class="seg" role="group" aria-label="OS">
      <button type="button" data-os="mac">Mac</button>
      <button type="button" data-os="win">Windows</button>
    </div>

    <section data-os="mac">
      <h3>キーの長押し</h3>
      <p class="sub">e や a を長押しすると候補が出ます。クリックするか、候補の下の数字キーで選んでください。</p>
      <h3>⌥ (option) との組み合わせ</h3>
      <p class="sub">入力ソースを「ABC」(または「U.S.」) にしておきます。⌥ と1つ目のキーを押して離し、続けて文字を打ちます。</p>
      <table>
        <tr><th>é</th><td><kbd>⌥</kbd><kbd>E</kbd> → <kbd>E</kbd></td></tr>
        <tr><th>à è ù</th><td><kbd>⌥</kbd><kbd>\`</kbd> → 文字</td></tr>
        <tr><th>â ê î ô û</th><td><kbd>⌥</kbd><kbd>I</kbd> → 文字</td></tr>
        <tr><th>ë ï ü</th><td><kbd>⌥</kbd><kbd>U</kbd> → 文字</td></tr>
        <tr><th>ç</th><td><kbd>⌥</kbd><kbd>C</kbd></td></tr>
        <tr><th>œ</th><td><kbd>⌥</kbd><kbd>Q</kbd></td></tr>
      </table>
      <p class="sub">大文字は最後のキーに ⇧ を足します (É は ⌥E → ⇧E、Ç は ⌥⇧C)。</p>
    </section>

    <section data-os="win">
      <h3>キーボード「米国 - インターナショナル」</h3>
      <p class="sub">設定 → 時刻と言語 → 言語と地域で英語 (米国) を追加し、そのキーボードに United States-International を追加します。記号を押してから文字を打ちます。</p>
      <table>
        <tr><th>é</th><td><kbd>'</kbd> → <kbd>E</kbd></td></tr>
        <tr><th>à è ù</th><td><kbd>\`</kbd> → 文字</td></tr>
        <tr><th>â ê î ô û</th><td><kbd>⇧</kbd><kbd>6</kbd> (^) → 文字</td></tr>
        <tr><th>ë ï ü</th><td><kbd>⇧</kbd><kbd>'</kbd> (") → 文字</td></tr>
        <tr><th>ç</th><td><kbd>'</kbd> → <kbd>C</kbd></td></tr>
      </table>
      <p class="sub">アポストロフ(') そのものを入力する場合は、 ' → スペースを押してください。l'ami のつもりで ' → a と続けると á になるので注意してください。</p>
      <h3>Alt コード (テンキー)</h3>
      <p class="sub">Alt を押したまま、テンキーで数字を打ちます。</p>
      <ul class="alt">
        <li><b>é</b> 0233</li><li><b>è</b> 0232</li><li><b>ê</b> 0234</li><li><b>ë</b> 0235</li>
        <li><b>à</b> 0224</li><li><b>â</b> 0226</li><li><b>ç</b> 0231</li><li><b>î</b> 0238</li>
        <li><b>ï</b> 0239</li><li><b>ô</b> 0244</li><li><b>ù</b> 0249</li><li><b>û</b> 0251</li>
        <li><b>ü</b> 0252</li><li><b>œ</b> 0156</li>
      </ul>
    </section>

    <p class="sub foot">iPhone・Android はキーを長押しすると候補が出ます。</p>
  </div>
</dialog>
`);

const keys = document.getElementById("keys");
// 開いたときは OS に合わせ、中の切り替えで Mac / Windows を見比べられる
const setOs = (os) => {
  keys.dataset.os = os;
  for (const b of keys.querySelectorAll(".seg button")) b.ariaPressed = String(b.dataset.os === os);
};
setOs(/win/i.test(navigator.userAgentData?.platform ?? navigator.platform) ? "win" : "mac");
keys.querySelector(".seg").onclick = (e) => e.target.dataset.os && setOs(e.target.dataset.os);
document.getElementById("open-keys").onclick = () => keys.showModal();
// 枠の外 (背景) を押したら閉じる。式で書くと false を返し、on* では preventDefault 扱いになって × (method="dialog") が効かなくなる
keys.onclick = (e) => { if (e.target === keys) keys.close(); };
