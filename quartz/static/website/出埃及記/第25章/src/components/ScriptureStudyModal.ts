import type { AppKernel } from '../app/AppKernel';

export class ScriptureStudyModal {
  readonly element: HTMLElement;
  #isOpen = false;
  #appKernel: AppKernel | null = null;
  #unitMode: 'cubit' | 'cm' | 'inch' = 'cubit';

  constructor(container: HTMLElement) {
    this.element = document.createElement('div');
    this.element.className = 'scripture-modal-overlay is-hidden';
    this.element.innerHTML = `
      <div class="scripture-modal-card" role="dialog" aria-modal="true" aria-labelledby="scripture-modal-title">
        <header class="scripture-modal-header">
          <div>
            <span class="scripture-badge">EXODUS 25 · 聖經研讀</span>
            <h2 id="scripture-modal-title">《出埃及記》第 25 章 逐節經文與器物考據</h2>
          </div>
          <button type="button" class="scripture-close-btn" data-scripture-action="close" aria-label="關閉經文研讀">×</button>
        </header>

        <div class="scripture-modal-tools">
          <div class="unit-converter-bar">
            <span>📐 尺寸單位換算：</span>
            <button type="button" class="unit-toggle-btn is-active" data-unit="cubit">聖經肘 (Cubit ≈ 45cm)</button>
            <button type="button" class="unit-toggle-btn" data-unit="cm">公分 (cm)</button>
            <button type="button" class="unit-toggle-btn" data-unit="inch">英吋 (inch)</button>
          </div>
        </div>

        <div class="scripture-modal-body">
          <!-- Section 1: Exodus 25:1-9 Offerings -->
          <article class="scripture-section-block">
            <div class="scripture-sec-head">
              <h3>一、奉獻會幕的材料（出埃及記 25:1–9）</h3>
              <span class="hebrew-tag">תְּרוּמָה (Terumah · 聖別供物)</span>
            </div>
            <div class="scripture-verse-card">
              <p class="verse-quote">「耶和華曉諭摩西說：『你告訴以色列人當為我送禮物來；凡甘心樂意的，你們就可以收下歸我。所要收的禮物：就是金、銀、銅、藍色、紫色、朱紅色線、細麻、山羊毛、染紅的公羊皮、海狗皮、皂莢木、點燈的油，並作膏油和香的香料，紅瑪瑙與別樣的寶石... 又當為我造聖所，使我可以住在他們中間。』」</p>
              <div class="verse-analysis">
                <h4>✦ 材料屬靈與歷史考據：</h4>
                <ul>
                  <li><strong>皂莢木 (Acacia / עֲצֵי שִׁטִּים)</strong>：西奈半島沙漠耐旱抗腐木材，質地緊密堅硬，不易蟲蛀。</li>
                  <li><strong>精金 (Pure Gold / זָהָב טָהוֹר)</strong>：象徵神的尊榮聖潔；會幕內部器具全以精金包裹。</li>
                  <li><strong>三色線與細麻</strong>：藍色（天屬神聖）、紫色（君王尊貴）、朱紅色（救贖與生命代贖）。</li>
                </ul>
              </div>
            </div>
          </article>

          <!-- Section 2: Exodus 25:10-22 Ark of the Covenant -->
          <article class="scripture-section-block">
            <div class="scripture-sec-head">
              <h3>二、約櫃與施恩座（出埃及記 25:10–22）</h3>
              <span class="hebrew-tag">אֲרוֹן הָעֵדוּת (Aron Ha-Edut) ｜ כַּפֹּרֶת (Kapporet)</span>
              <button type="button" class="fly-to-3d-btn" data-fly-object="ark">🎯 3D 定位至聖所約櫃</button>
            </div>
            <div class="scripture-verse-card">
              <div class="dimensions-display" data-dim-type="ark">
                <span class="dim-label">約櫃精確尺寸：</span>
                <b class="dim-value" data-cubit="長 2.5 肘 × 寬 1.5 肘 × 高 1.5 肘" data-cm="長 112.5 cm × 寬 67.5 cm × 高 67.5 cm" data-inch="長 44.3 in × 寬 26.6 in × 高 26.6 in">長 2.5 肘 × 寬 1.5 肘 × 高 1.5 肘</b>
              </div>
              <p class="verse-quote">「要用皂莢木做一個櫃... 裡外都要包裹純金，四圍鑲上金牙邊。也要鑄四個金環，安在櫃的四腳上... 要做二根皂莢木的槓，用金包裹。把槓穿在櫃旁的環內，以便抬櫃... 要用純金做施恩座... 要用金子錘出兩個基路伯來，安在施恩座的兩頭... 二基路伯要高張翅膀，遮掩施恩座... 我要在那裡與你相會，又要從法櫃施恩座上二基路伯中間，和你們說我所要吩咐你傳給以色列人的一切事。」</p>
              <div class="verse-analysis">
                <h4>✦ 核心神學與結構意義：</h4>
                <ul>
                  <li><strong>施恩座 (Kapporet)</strong>：純金錘打一體成型，兩基路伯翅膀相向遮掩，是一年一度贖罪日大祭司彈血求赦罪之處。</li>
                  <li><strong>法版存放 (Edut)</strong>：櫃內安放兩塊十誡石版（法版）、盛嗎哪的金罐與亞倫發芽的杖（來 9:4）。</li>
                </ul>
              </div>
            </div>
          </article>

          <!-- Section 3: Exodus 25:23-30 Table of Showbread -->
          <article class="scripture-section-block">
            <div class="scripture-sec-head">
              <h3>三、陳設餅桌（出埃及記 25:23–30）</h3>
              <span class="hebrew-tag">שֻׁלְחָן לֶחֶם הַפָּנִים (Shulchan Lechem HaPanim)</span>
              <button type="button" class="fly-to-3d-btn" data-fly-object="shewbread-table">🎯 3D 定位聖所陳設餅桌</button>
            </div>
            <div class="scripture-verse-card">
              <div class="dimensions-display" data-dim-type="table">
                <span class="dim-label">陳設餅桌尺寸：</span>
                <b class="dim-value" data-cubit="長 2 肘 × 寬 1 肘 × 高 1.5 肘" data-cm="長 90 cm × 寬 45 cm × 高 67.5 cm" data-inch="長 35.4 in × 寬 17.7 in × 高 26.6 in">長 2 肘 × 寬 1 肘 × 高 1.5 肘</b>
              </div>
              <p class="verse-quote">「要用皂莢木做一張桌子... 包裹純金，四圍鑲上金牙邊。桌子的四圍各做一掌寬的邊，邊上鑲著金牙邊... 要用純金做桌子上的盤子、調羹，並奠酒的爵和瓶。又要在桌子上，在我面前，常擺陳設餅。」</p>
              <div class="verse-analysis">
                <h4>✦ 象徵意涵：</h4>
                <ul>
                  <li><strong>十二個陳設餅</strong>：每週安息日更換，分為兩行排列，代表以色列十二支派常在神面前享受生命的團契與供應。</li>
                  <li><strong>一掌寬的金花邊</strong>：固定桌上器皿，防止抬運時掉落。</li>
                </ul>
              </div>
            </div>
          </article>

          <!-- Section 4: Exodus 25:31-40 Menorah -->
          <article class="scripture-section-block">
            <div class="scripture-sec-head">
              <h3>四、精金金燈臺（出埃及記 25:31–40）</h3>
              <span class="hebrew-tag">מְנוֹרַת הַזָּהָב (Menorat HaZahav)</span>
              <button type="button" class="fly-to-3d-btn" data-fly-object="menorah">🎯 3D 定位聖所金燈臺</button>
            </div>
            <div class="scripture-verse-card">
              <div class="dimensions-display" data-dim-type="menorah">
                <span class="dim-label">材料重量：</span>
                <b class="dim-value">一他連得精金 (One Talent ≈ 34~43 kg 純金錘打)</b>
              </div>
              <p class="verse-quote">「要用純金做一個燈臺。燈臺的座和幹與杯、球、花，都要接連一塊錘出來。燈臺兩旁要杈出六個枝子：這旁三個，那旁三個。這旁每枝上有三個杯，形狀像杏花，有球，有花... 燈臺的主幹上有四個杯，形狀像杏花... 要做燈臺的七個燈盞... 點這燈，使光照向對面。燈剪和燈花盤也是純金的... 製造這一切的器具要用精金一他連得。要謹慎做這些物件，都要照著在山上指示你的樣式。」</p>
              <div class="verse-analysis">
                <h4>✦ 植物學與光之神學：</h4>
                <ul>
                  <li><strong>杏花造型 (Almond Blossom / שָׁקֵד)</strong>：杏樹是中東冬盡春來最早甦醒開花的植物，象徵「警醒、復活與永恆生命」。</li>
                  <li><strong>純橄欖油常明燈</strong>：代表聖靈的光照引導，在無窗的聖所中成為唯一的真光。</li>
                </ul>
              </div>
            </div>
          </article>
        </div>

        <footer class="scripture-modal-footer">
          <button type="button" class="primary-button" data-scripture-action="close">返回 3D 探索場景</button>
        </footer>
      </div>
    `;

    container.appendChild(this.element);
    this.element.addEventListener('click', this.#onClick);
  }

  bind(kernel: AppKernel): void {
    this.#appKernel = kernel;
  }

  open(): void {
    this.#isOpen = true;
    this.element.classList.remove('is-hidden');
  }

  close(): void {
    this.#isOpen = false;
    this.element.classList.add('is-hidden');
  }

  toggle(): void {
    if (this.#isOpen) this.close();
    else this.open();
  }

  readonly #onClick = (e: MouseEvent): void => {
    const target = (e.target as HTMLElement).closest<HTMLElement>('[data-scripture-action],[data-unit],[data-fly-object]');
    if (!target) {
      if ((e.target as HTMLElement).classList.contains('scripture-modal-overlay')) this.close();
      return;
    }

    if (target.dataset.scriptureAction === 'close') {
      this.close();
      return;
    }

    if (target.dataset.unit) {
      this.#unitMode = target.dataset.unit as 'cubit' | 'cm' | 'inch';
      this.element.querySelectorAll('[data-unit]').forEach((b) => b.classList.toggle('is-active', b === target));
      this.#updateDimensionUnits();
      return;
    }

    if (target.dataset.flyObject) {
      const objId = target.dataset.flyObject;
      this.close();
      this.#appKernel?.selectLearningObject(objId);
      return;
    }
  };

  #updateDimensionUnits(): void {
    this.element.querySelectorAll<HTMLElement>('.dim-value[data-cubit]').forEach((el) => {
      const val = el.dataset[this.#unitMode];
      if (val) el.textContent = val;
    });
  }

  dispose(): void {
    this.element.removeEventListener('click', this.#onClick);
    this.element.remove();
  }
}
