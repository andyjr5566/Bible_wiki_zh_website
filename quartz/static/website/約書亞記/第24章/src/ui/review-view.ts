import { chapterUrl, genealogyUrl, siblingSiteUrl, wildernessUrl } from '../data/links';
import type { SiteData, SourceId } from '../data/types';
import type { StoryState } from '../story/state';
import { h, renderCommentaryCard } from './dom';
import type { PeekController } from './peek';
import { reviewNavigate, reviewJumpToCue, cueForVerse } from './review-navigation';
import { createChapterShape } from './review-shape';
import { createReviewMap } from './review-map';
import { createOakSlider } from './review-oak';
import { verseBlock, linkedVerse } from './review-text';

function jumpToCue(cue: string, label: string, state: StoryState, onStateChange: () => void): void {
  void label;
  reviewJumpToCue(cue, state, onStateChange);
}

export function createReviewView(
  data: SiteData,
  state: StoryState,
  peek: PeekController,
  onStateChange: () => void,
): HTMLElement {
  const wrap = h('div', { id: 'jos-review-root', className: 'jos-review-wrap' });

  const navItems: [string, string][] = [
    ['01', '01 這一章的形狀'],
    ['02', '02 示劍的每一次'],
    ['03', '03 七塊石頭'],
    ['04', '04 三個葬禮'],
    ['05', `05 ${data.section05Title}`],
    ['06', '06 各家怎麼讀'],
    ['07', '07 整章經文'],
    ['questions', '思想問題'],
    ['about', '關於與出處'],
  ];

  const navInner = h('div', { className: 'jos-review-nav-inner' });
  for (const [id, label] of navItems) {
    const btn = h('button', { type: 'button', className: 'jos-review-tab' }, label);
    btn.addEventListener('click', () => {
      reviewNavigate(document.getElementById(`jos-sec-${id}`), state);
    });
    navInner.appendChild(btn);
  }
  wrap.appendChild(h('div', { className: 'jos-review-intro' }, h('h2', null, '再看一次'),
    h('p', null, '至於我和我家', h('span', null, '約書亞記 24 章'))));
  wrap.appendChild(h('nav', { className: 'jos-review-nav', 'aria-label': '整理區章節導覽' }, navInner));

  const container = h('div', { className: 'jos-review-container' });
  function entryButton(key: string, label?: string): HTMLButtonElement {
    const button = h('button', { type: 'button', className: 'jos-text-action' }, label ?? `查看${data.entries[key]?.title ?? ''}完整條目 ↗`);
    button.addEventListener('click', () => peek.openEntry(key));
    return button;
  }
  function storyButton(cue: string): HTMLButtonElement {
    const button = h('button', { type: 'button', className: 'jos-text-action', 'data-coach': 'jump-story-btn' }, '在故事裡看 ↑');
    button.addEventListener('click', () => reviewJumpToCue(cue, state, onStateChange));
    return button;
  }

  // === 01 這一章的形狀 ===
  const shape = createChapterShape(data, state, peek, onStateChange);
  const treatyNotesBox = h('div', { className: 'jos-fold-body' });
  for (const c of data.shapeTreatyNotes) {
    treatyNotesBox.appendChild(renderCommentaryCard(c));
  }
  const treatyEntryBtn = h('button', { type: 'button', className: 'jos-chip' }, '〈宗主條約〉條目');
  treatyEntryBtn.addEventListener('click', () => peek.openEntry('背景/宗主條約'));

  container.appendChild(
    h(
      'section',
      { id: 'jos-sec-01', className: 'jos-sec' },
      h('div', { className: 'jos-sec-num' }, '01'),
      h('h2', { className: 'jos-sec-title' }, '這一章的形狀'),
      h(
        'p',
        { className: 'jos-sec-lead' },
        '第1到28節：約書亞召集眾人，轉述神做過的事，要百姓選擇事奉誰，和百姓一來一回說了四次，最後把這些話寫在律法書上，又立起一塊大石頭。第29到33節記三個人的安葬，約書亞記到這裡結束。',
      ),
      shape,
      h(
        'details',
        { className: 'jos-fold' },
        h('summary', { className: 'jos-fold-summary' }, '註釋怎樣把本章對照古代宗主條約'),
        treatyNotesBox,
        h('div', { className: 'jos-chip-row' }, treatyEntryBtn),
      ),
    ),
  );

  // === 02 示劍的每一次 ===
  const oakSliderBox = createOakSlider(data, state, peek);

  const timeline = h('div', { className: 'jos-timeline' });
  for (const ev of data.shechemEvents) {
    const itemEl = h('div', {
      className: `jos-tl-item${ev.era === 'jos24' ? ' jos-tl-item-jos24' : ''}${ev.era === 'later' ? ' jos-tl-later' : ''}`,
    });

    const refBtn = h('button', { type: 'button', className: 'jos-chip' }, ev.ref);
    refBtn.addEventListener('click', () => peek.openVerse(ev.ref));

    const headRight = h('div', { className: 'jos-chip-row' }, refBtn);
    if (ev.storyCue) {
      const cueBtn = h('button', { type: 'button', className: 'jos-chip' }, '在故事裡看 ↑');
      cueBtn.addEventListener('click', () =>
        jumpToCue(ev.storyCue!, '02 示劍的每一次', state, onStateChange),
      );
      headRight.appendChild(cueBtn);
    }

    itemEl.appendChild(
      h('div', { className: 'jos-tl-head' }, h('span', { className: 'jos-tl-title' }, ev.title), headRight),
    );

    if (ev.era === 'later') itemEl.prepend(h('span', { className: 'jos-later-label' }, '後來'));
    // This section is a sequence of supplied Scripture, with no new study prose.
    itemEl.appendChild(verseBlock(data, ev.ref));

    // 白名單經節具名標出連入的註釋來源
    if (ev.linkedBy && ev.linkedBy.length > 0) {
      const names = ev.linkedBy.map((c) => c.work).join('、');
      const linkedFoldBody = h('div', { className: 'jos-fold-body' });
      for (const c of ev.linkedBy) {
        linkedFoldBody.appendChild(renderCommentaryCard(c));
      }
      itemEl.appendChild(
        h(
          'div',
          { className: 'jos-tl-linked' },
          h('div', null, `把這件事和示劍連起來的註釋：${names}`),
          h(
            'details',
            { className: 'jos-fold' },
            h('summary', { className: 'jos-fold-summary' }, '看註釋怎麼說'),
            linkedFoldBody,
          ),
        ),
      );
    }

    timeline.appendChild(itemEl);
  }

  const archBox = h(
    'aside',
    { className: 'jos-info-card' },
    h('h3', { className: 'jos-info-card-title' }, data.shechemArchaeology.title),
    ...data.shechemArchaeology.points.map((pt) => h('p', { className: 'jos-info-card-p' }, pt)),
    renderCommentaryCard(data.shechemArchaeology.sourceNote),
  );

  container.appendChild(
    h(
      'section',
      { id: 'jos-sec-02', className: 'jos-sec' },
      h('div', { className: 'jos-sec-num' }, '02'),
      h('h2', { className: 'jos-sec-title' }, '示劍的每一次'),
      createReviewMap(data, peek, 'shechem', [{ id: 'ebal' }, { id: 'shechem' }, { id: 'gerizim' }]),
      oakSliderBox,
      h('div', { className: 'jos-shechem-columns' }, timeline, h('div', { className: 'jos-shechem-aside' }, archBox,
        entryButton('地點/示劍（城）', '查看示劍完整條目 ↗'))),
    ),
  );

  // === 03 七塊石頭，與其他的石頭 ===
  const bookStrip = h('div', { className: 'jos-book-strip', 'aria-label': '約書亞記二十四章，七次立石' });
  for (let chapter = 1; chapter <= 24; chapter++) {
    const chapterSlot = h('div', { className: 'jos-book-chapter' }, h('span', null, String(chapter)));
    for (const stone of data.sevenStones.filter(item => item.chapter === chapter)) {
      const marker = h('button', { type: 'button', className: 'jos-book-stone', title: stone.placeName, 'aria-label': `${stone.placeName}，${stone.ref}` }, String(stone.order));
      marker.addEventListener('click', () => peek.openVerse(stone.ref)); chapterSlot.append(marker);
    }
    bookStrip.append(chapterSlot);
  }
  const sevenGrid = h('div', { className: 'jos-grid-cards' });
  for (const st of data.sevenStones) {
    const refBtn = h('button', { type: 'button', className: 'jos-chip' }, st.ref);
    refBtn.addEventListener('click', () => peek.openVerse(st.ref));
    const placeBtn = h('button', { type: 'button', className: 'jos-chip' }, `地點：${st.placeName}`);
    placeBtn.addEventListener('click', () => peek.openPlace(st.placeId));

    sevenGrid.appendChild(
      h(
        'div',
        { className: `jos-info-card jos-stone-card jos-stone-${st.markerKind}` },
        h('div', { className: 'jos-info-card-sub' }, `第 ${st.order} 次・約書亞記第 ${st.chapter} 章`),
        h('h3', { className: 'jos-info-card-title' }, st.placeName),
        h('p', { className: 'jos-info-card-p' }, st.what),
        verseBlock(data, st.ref),
        st.markerQuote ? h('p', { className: 'jos-widget-stat' }, `經文：「${st.markerQuote}」`) : null,
        st.markerKind === 'children-ask' ? h('span', { className: 'jos-stone-seal' }, '日後的子孫') : st.markerKind === 'until-today' ? h('span', { className: 'jos-stone-seal' }, '直存到今日') : null,
        h('div', { className: 'jos-chip-row' }, refBtn, placeBtn,
          st.storyCue ? storyButton(st.storyCue) : null),
      ),
    );
  }

  const otherStonesGrid = h('div', { className: 'jos-grid-cards' });
  for (const os of data.otherStones) {
    const refBtn = h('button', { type: 'button', className: 'jos-chip' }, os.ref);
    refBtn.addEventListener('click', () => peek.openVerse(os.ref));
    otherStonesGrid.appendChild(
      h(
        'div',
        { className: 'jos-info-card' },
        h('div', { className: 'jos-info-card-sub' }, os.ref),
        h('h3', { className: 'jos-info-card-title' }, os.title),
        h('p', { className: 'jos-info-card-p' }, os.meaning),
        h('div', { className: 'jos-chip-row' }, refBtn),
      ),
    );
  }

  const stoneNotesBody = h('div', { className: 'jos-fold-body' });
  for (const c of data.sevenStonesNotes) stoneNotesBody.appendChild(renderCommentaryCard(c));

  container.appendChild(
    h(
      'section',
      { id: 'jos-sec-03', className: 'jos-sec' },
      h('div', { className: 'jos-sec-num' }, '03'),
      h('h2', { className: 'jos-sec-title' }, '七塊石頭'),
      h(
        'p',
        { className: 'jos-sec-lead' },
        'CT 與 GT 說，示劍這一塊是以色列人進迦南後第七次立石作見證。',
      ),
      bookStrip,
      createReviewMap(data, peek, 'stones', data.sevenStones.map(stone => ({ id: stone.placeId, label: stone.placeName }))),
      sevenGrid,
      h(
        'details',
        { className: 'jos-fold' },
        h('summary', { className: 'jos-fold-summary' }, '註釋怎麼數這七次立石'),
        stoneNotesBody,
      ),
      h('details', { className: 'jos-fold' }, h('summary', { className: 'jos-fold-summary' }, '聖經裡別處的立石'), otherStonesGrid,
        entryButton('主題/立石為證', '查看立石為證完整條目 ↗')),
    ),
  );

  // === 04 三座墳墓，一個世代的收束 ===
  const burialsGrid = h('div', { className: 'jos-grid-cards' });
  for (const b of data.threeBurials) {
    const refBtn = h('button', { type: 'button', className: 'jos-chip' }, b.ref);
    refBtn.addEventListener('click', () => peek.openVerse(b.ref));
    const cueBtn = h('button', { type: 'button', className: 'jos-chip' }, '在故事裡看 ↑');
    cueBtn.addEventListener('click', () =>
      jumpToCue(b.storyCue, '04 三個葬禮', state, onStateChange),
    );
    const genLink = h(
      'a',
      {
        className: 'jos-chip',
        href: genealogyUrl(b.genealogyId),
        target: '_blank',
        rel: 'noopener noreferrer',
      },
      `家譜：${b.person} ↗`,
    );

    const bNotes = h('div', { className: 'jos-fold-body' });
    for (const c of b.notes) bNotes.appendChild(renderCommentaryCard(c));

    burialsGrid.appendChild(
      h(
        'div',
        { className: 'jos-info-card' },
        h('div', { className: 'jos-info-card-sub' }, `${b.ref}・${b.placeName}`),
        h('h3', { className: 'jos-info-card-title' }, b.person),
        verseBlock(data, b.ref),
        b.ageNote ? h('p', { className: 'jos-widget-stat' }, b.ageNote) : null,
        h('p', { className: 'jos-info-card-p' }, b.detail),
        h('div', { className: 'jos-chip-row' }, refBtn, cueBtn, genLink,
          ...(b.id === 'burial-joseph' ? ['創50:25', '出13:19', '書24:32', '來11:22', '徒7:16'].map(ref => {
            const button = h('button', { type: 'button', className: 'jos-chip' }, ref);
            button.addEventListener('click', () => peek.openVerse(ref)); return button;
          }) : b.id === 'burial-joshua' ? [(() => {
            const button = h('button', { type: 'button', className: 'jos-chip' }, '創50:26');
            button.addEventListener('click', () => peek.openVerse('創50:26')); return button;
          })()] : [])),
        h(
          'details',
          { className: 'jos-fold' },
          h('summary', { className: 'jos-fold-summary' }, '註釋說明'),
          bNotes,
        ),
      ),
    );
  }

  container.appendChild(
    h(
      'section',
      { id: 'jos-sec-04', className: 'jos-sec' },
      h('div', { className: 'jos-sec-num' }, '04'),
      h('h2', { className: 'jos-sec-title' }, '三個葬禮'),
      renderCommentaryCard(data.burialsIntro),
      createReviewMap(data, peek, 'burials', [
        { id: 'timnath-serah', label: '亭拿西拉・約書亞' },
        { id: 'shechem', label: '示劍・約瑟' },
        { id: 'gibeah-phinehas', label: '非尼哈的小山・以利亞撒' },
        { id: 'gaash', label: '迦實山' },
      ]),
      burialsGrid,
    ),
  );

  // === 05 免得你忘記 ===
  const forgetTimeline = h('div', { className: 'jos-timeline' });
  for (const lf of data.lestForget) {
    const chipRow = h('div', { className: 'jos-chip-row' });
    for (const r of lf.refs) {
      const btn = h('button', { type: 'button', className: 'jos-chip' }, r);
      btn.addEventListener('click', () => peek.openVerse(r));
      chipRow.appendChild(btn);
    }
    if (lf.storyCue) {
      const cueBtn = h('button', { type: 'button', className: 'jos-chip' }, '在故事裡看 ↑');
      cueBtn.addEventListener('click', () =>
        jumpToCue(lf.storyCue!, `05 ${data.section05Title}`, state, onStateChange),
      );
      chipRow.appendChild(cueBtn);
    }
    const linkedBy = h('p', { className: 'jos-review-caption' }, `註釋：${lf.notes.map(note => note.work).join('、')}`);

    forgetTimeline.appendChild(
      h(
        'div',
        { className: 'jos-tl-item' },
        h(
          'div',
          { className: 'jos-tl-head' },
          h('span', { className: 'jos-tl-title' }, `${lf.order}. ${lf.stageLabel}`),
          chipRow,
        ),
        ...lf.refs.map(ref => verseBlock(data, ref)),
        linkedBy,
      ),
    );
  }

  container.appendChild(
    h(
      'section',
      { id: 'jos-sec-05', className: 'jos-sec' },
      h('div', { className: 'jos-sec-num' }, '05'),
      h('h2', { className: 'jos-sec-title' }, data.section05Title),
      forgetTimeline,
    ),
  );

  // === 06 各家怎麼讀（15 題） ===
  let activeSourceFilter: 'ALL' | SourceId = 'ALL';
  const filterBar = h('div', { className: 'jos-filter-bar' });
  const qList = h('div', { className: 'jos-q-list' });

  function renderReadingCards(): void {
    filterBar.replaceChildren();
    const filters: ['ALL' | SourceId, string][] = [
      ['ALL', '全部來源（15 題）'],
      ['CT', '黃迦勒 CT'],
      ['GT', '拾穗 GT'],
      ['KC', 'KingComments KC'],
      ['BH', 'BibleHub BH'],
    ];
    for (const [code, label] of filters) {
      const btn = h(
        'button',
        {
          type: 'button',
          className: `jos-toggle-pill${activeSourceFilter === code ? ' jos-toggle-pill-active' : ''}`,
          'aria-pressed': String(activeSourceFilter === code),
        },
        label,
      );
      btn.addEventListener('click', () => {
        activeSourceFilter = code;
        renderReadingCards();
        [...filterBar.querySelectorAll('button')].find(button => button.textContent === label)?.focus({ preventScroll: true });
      });
      filterBar.appendChild(btn);
    }

    qList.replaceChildren();
    for (const q of data.readingCards) {
      const views =
        activeSourceFilter === 'ALL'
          ? q.views
          : q.views.filter((v) => v.source === activeSourceFilter);
      if (views.length === 0) continue;

      const vChips = h('div', { className: 'jos-chip-row' });
      for (const vr of q.verses) {
        const btn = h('button', { type: 'button', className: 'jos-chip' }, vr);
        btn.addEventListener('click', () => peek.openVerse(vr));
        vChips.appendChild(btn);
      }
      for (const ek of q.entryLinks ?? []) {
        const em = data.entries[ek];
        if (!em) continue;
        const btn = h('button', { type: 'button', className: 'jos-chip' }, `〈${em.title}〉`);
        btn.addEventListener('click', () => peek.openEntry(ek));
        vChips.appendChild(btn);
      }

      const viewsWrap = h('div', { className: 'jos-q-views' });
      for (const vw of views) {
        viewsWrap.appendChild(renderCommentaryCard(vw));
      }

      qList.appendChild(
        h(
          'article',
          { id: `jos-card-${q.id}`, className: 'jos-q-card' },
          h(
            'div',
            { className: 'jos-q-head' },
            h('h3', { className: 'jos-q-title' }, `問題 ${q.number}：${q.question}`),
            vChips,
          ),
          viewsWrap,
        ),
      );
    }
  }
  renderReadingCards();

  container.appendChild(
    h(
      'section',
      { id: 'jos-sec-06', className: 'jos-sec' },
      h('div', { className: 'jos-sec-num' }, '06'),
      h('h2', { className: 'jos-sec-title' }, '各家怎麼讀：十五個問題'),
      h(
        'p',
        { className: 'jos-sec-lead' },
        '四套註釋讀同一節經文，看重的地方和讀法不一定相同。每一題都把各家的說法分開列出，不合併成一個答案。',
      ),
      filterBar,
      qList,
    ),
  );

  // === 07 整章經文；原地點卡保留為收合索引，供 peek 往返 ===
  const scripture = h('div', { className: 'jos-scripture' });
  for (let verse = 1; verse <= 33; verse++) {
    const ref = `書24:${verse}`;
    const text = data.verses[ref];
    if (!text) continue; // Report missing Scripture without inventing it.
    const cue = cueForVerse(data, verse);
    const row = h('article', { id: `jos-review-verse-${verse}`, className: 'jos-scripture-verse' },
      h('span', { className: 'jos-scripture-number', 'aria-label': `第${verse}節` }, String(verse)),
      h('p', null, linkedVerse(text, data, peek)), cue ? storyButton(cue) : null);
    scripture.append(row);
  }
  const placesGrid = h('div', { className: 'jos-grid-cards' });
  for (const p of Object.values(data.places)) {
    const vChips = h('div', { className: 'jos-chip-row' });
    for (const vr of p.verses.slice(0, 4)) {
      const btn = h('button', { type: 'button', className: 'jos-chip' }, vr);
      btn.addEventListener('click', () => peek.openVerse(vr));
      vChips.appendChild(btn);
    }
    if (p.entryKey && data.entries[p.entryKey]) {
      const em = data.entries[p.entryKey];
      const eBtn = h('button', { type: 'button', className: 'jos-chip' }, `〈${em.title}〉`);
      eBtn.addEventListener('click', () => peek.openEntry(p.entryKey!));
      vChips.appendChild(eBtn);
    }

    placesGrid.appendChild(
      h(
        'div',
        { id: `jos-place-card-${p.id}`, className: 'jos-info-card' },
        h(
          'div',
          { className: 'jos-tl-head' },
          h('h3', { className: 'jos-info-card-title' }, p.nameZh),
          p.unlocated
            ? h('span', { className: 'jos-uncertain-badge' }, '◌ 位置不詳・只是可能在這一帶')
            : p.uncertain
              ? h('span', { className: 'jos-uncertain-badge' }, '◌ 只是可能在這一帶')
              : null,
        ),
        h(
          'div',
          { className: 'jos-info-card-sub' },
          p.modernLabel,
        ),
        h('p', { className: 'jos-info-card-p' }, p.summary),
        p.controversy ? h('p', { className: 'jos-widget-stat' }, p.controversy) : null,
        vChips,
      ),
    );
  }

  container.appendChild(
    h(
      'section',
      { id: 'jos-sec-07', className: 'jos-sec' },
      h('div', { className: 'jos-sec-num' }, '07'),
      h('h2', { className: 'jos-sec-title' }, '整章經文'),
      h('p', { className: 'jos-sec-lead' }, '約書亞記 24 章・和合本'),
      scripture,
      h(
        'div',
        { className: 'jos-widget-bar' },
        h(
          'a',
          {
            className: 'jos-ext-link',
            href: wildernessUrl(),
            target: '_blank',
            rel: 'noopener noreferrer',
          },
          '前往〈民數記 33 章・曠野四十二站〉互動地圖 ↗',
        ),
      ),
      h('details', { id: 'jos-review-places', className: 'jos-fold' }, h('summary', { className: 'jos-fold-summary' }, '本章地點索引'), placesGrid),
    ),
  );

  // === 思想問題 ===
  const beadOl = h('ol', { className: 'jos-bead-list' });
  for (const q of data.beadQuestions.items) {
    beadOl.appendChild(h('li', { className: 'jos-bead-item' }, q.text));
  }

  container.appendChild(
    h(
      'section',
      { id: 'jos-sec-questions', className: 'jos-sec' },
      h('div', { className: 'jos-sec-num' }, '思想問題'),
      h('h2', { className: 'jos-sec-title' }, '讀完這一章的六個問題'),
      h(
        'p',
        { className: 'jos-sec-lead' },
        `以下六題照錄 ${data.beadQuestions.work}，這裡不附答案。`,
      ),
      beadOl,
    ),
  );

  // === 關於與出處 ===
  const audioSource = (label: string, href: string) =>
    h('a', { className: 'jos-comm-link', href, target: '_blank', rel: 'noopener noreferrer' }, label);
  const sourceList = h(
    'ul',
    { className: 'jos-footer-list' },
    h('li', null, '經文字體：芫荽（Iansui），由芫荽專案作者基於 Fontworks Klee One 改作，依 SIL Open Font License 1.1 授權；本站使用故事用字的子集。', h('a', { className: 'jos-comm-link', href: 'https://github.com/ButTaiwan/iansui', target: '_blank', rel: 'noopener noreferrer' }, '字體出處與授權 ↗')),
    h(
      'li',
      null,
      '經文本文：中文聖經和合本（1919，公有領域），對照知識庫 ',
      h(
        'a',
        {
          className: 'jos-comm-link',
          href: chapterUrl('06 約書亞記', 24),
          target: '_blank',
          rel: 'noopener noreferrer',
        },
        '〈約書亞記 第24章〉 ↗',
      ),
    ),
    h(
      'li',
      null,
      '原文詞形與詞典出處：',
      h(
        'a',
        {
          className: 'jos-comm-link',
          href: data.meta.stepSource.url,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
        `${data.meta.stepSource.label} ↗`,
      ),
    ),
    ...Object.values(data.meta.sources).map((s) =>
      h(
        'li',
        null,
        '研經註釋：',
        h(
          'a',
          {
            className: 'jos-comm-link',
            href: s.url,
            target: '_blank',
            rel: 'noopener noreferrer',
          },
          `${s.label} ↗`,
        ),
      ),
    ),
    h('li', null, '地點位置與地形高低出處：OpenBible.info《Bible Geocoding Data》（CC BY 4.0）、Natural Earth 水陸向量底圖（公有領域）。地形資料使用 Terrain Tiles（Tilezen，AWS 開放資料）；SRTM 與 GMTED2010 由美國地質調查局（USGS）提供，ETOPO1 來自美國國家海洋暨大氣總署（NOAA）。', h('a', { className: 'jos-comm-link', href: 'https://github.com/tilezen/joerd/blob/master/docs/attribution.md', target: '_blank', rel: 'noopener noreferrer' }, '地形資料署名說明 ↗')),
    h('li', null,
      '環境音效出處：Freesound 上以 CC0 1.0 公眾領域方式提供的錄音，包括山谷風聲（',
      audioSource('globofonia', 'https://freesound.org/people/globofonia/sounds/553733/'),
      '）、橡樹葉聲（', audioSource('kvgarlic', 'https://freesound.org/people/kvgarlic/sounds/435206/'),
      '）、河水聲（', audioSource('AugustSandberg', 'https://freesound.org/people/AugustSandberg/sounds/677397/'),
      '、', audioSource('viv1186', 'https://freesound.org/people/viv1186/sounds/735315/'),
      '、', audioSource('Pfannkuchn', 'https://freesound.org/people/Pfannkuchn/sounds/459412/'),
      '）、海岸風浪（', audioSource('Yarmonics', 'https://freesound.org/people/Yarmonics/sounds/447623/'),
      '）、海水聲（', audioSource('YouMightLikeThis', 'https://freesound.org/people/YouMightLikeThis/sounds/789889/'),
      '、', audioSource('Skjor1', 'https://freesound.org/people/Skjor1/sounds/321737/'),
      '、', audioSource('qubodup', 'https://freesound.org/people/qubodup/sounds/442944/'),
      '）、曠野風聲（', audioSource('Sassaby', 'https://freesound.org/people/Sassaby/sounds/827840/'),
      '）、人群低語（', audioSource('kyles', 'https://freesound.org/people/kyles/sounds/405000/'),
      '、', audioSource('KikeVilaplana', 'https://freesound.org/people/KikeVilaplana/sounds/566891/'),
      '、', audioSource('gecop', 'https://freesound.org/people/gecop/sounds/640254/'),
      '）、群眾聲浪（', audioSource('ShangusBurger', 'https://freesound.org/people/ShangusBurger/sounds/764323/'),
      '、', audioSource('ShangusBurger', 'https://freesound.org/people/ShangusBurger/sounds/764162/'),
      '、', audioSource('mglennsound', 'https://freesound.org/people/mglennsound/sounds/725697/'),
      '）、石頭聲（', audioSource('worthahep88', 'https://freesound.org/people/worthahep88/sounds/319222/'),
      '、', audioSource('kasparsj', 'https://freesound.org/people/kasparsj/sounds/513694/'),
      '、', audioSource('deleted_user_2104797', 'https://freesound.org/people/deleted_user_2104797/sounds/325268/'), '）。',
    ),
    h('li', null, '插圖與人物剪影由本站使用 Gemini、Codex 等 AI 工具生成；示劍山谷的 3D 場景、道具與渲染由本站以 Blender 自製。本站沒有使用 Poly Haven 或 Quaternius 素材。'),
  );

  const siblingRow = h(
    'div',
    { className: 'jos-chip-row' },
    h(
      'a',
      {
        className: 'jos-ext-link',
        href: chapterUrl('06 約書亞記', 24),
        target: '_blank',
        rel: 'noopener noreferrer',
      },
      '知識庫〈約書亞記第24章〉 ↗',
    ),
    h(
      'a',
      {
        className: 'jos-ext-link',
        href: wildernessUrl(),
        target: '_blank',
        rel: 'noopener noreferrer',
      },
      '〈民數記33章・曠野行程〉 ↗',
    ),
    h(
      'a',
      {
        className: 'jos-ext-link',
        href: siblingSiteUrl('摩西五經', '耶和華的節期'),
        target: '_blank',
        rel: 'noopener noreferrer',
      },
      '〈摩西五經・耶和華的節期〉 ↗',
    ),
    h(
      'a',
      {
        className: 'jos-ext-link',
        href: genealogyUrl('約書亞'),
        target: '_blank',
        rel: 'noopener noreferrer',
      },
      '〈亞當到耶穌・聖經家譜〉 ↗',
    ),
  );

  container.appendChild(
    h(
      'footer',
      { id: 'jos-sec-about', className: 'jos-sec' },
      h('div', { className: 'jos-sec-num' }, '關於'),
      h('h2', { className: 'jos-sec-title' }, '出處與相關網頁'),
      // 初衷短文與畫面處理的原因尚無定稿；交內容作者補寫，待辦記於進度文件。
      h('p', { className: 'jos-about-note' }, '示意的一家人是虛構的；他們只問問題或念經文。'),
      h('p', { className: 'jos-about-note' }, '畫面不畫的東西：約櫃與會幕、神的形像、黃蜂、石頭上的字、偷藏的神像。'),
      h('p', { className: 'jos-about-note' }, '頂列的動態開關可以關掉畫面裡的動作；關掉以後，文字、小卡和來回跳轉都照常可用。'),
      sourceList,
      siblingRow,
    ),
  );

  wrap.appendChild(container);
  const observer = new IntersectionObserver(entries => {
    for (const entry of entries) {
      if (!entry.isIntersecting) continue;
      const id = entry.target.id.replace('jos-sec-', '');
      navInner.querySelectorAll('button').forEach((button, index) => {
        if (navItems[index][0] === id) button.setAttribute('aria-current', 'location');
        else button.removeAttribute('aria-current');
      });
    }
  }, { rootMargin: '-10% 0px -65% 0px' });
  container.querySelectorAll('.jos-sec').forEach(section => observer.observe(section));
  return wrap;
}
