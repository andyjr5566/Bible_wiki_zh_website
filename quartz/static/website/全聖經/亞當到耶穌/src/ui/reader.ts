import type { ReadingData, ReadingDiff, ReadingLink, ReadingToken, StageId } from '../data/types';
import { button, h } from './dom';
import {
  OVERLAY_STAGES, STAGE_LABEL, anchorPerson, buildRoute, cardText, chapterHeading, entryPlan, gapAfterVerse, jumpIndex,
  linkTargets, linksReadBefore, listFocusTarget, otherStage, startIndex, type RouteVerse,
} from './reader-route';
import type { SpeechController } from './speech';
import { emptyMarks, type ReadingStage, type StageMarks } from './stage';

/**
 * 帶你讀經：經文一節一節往下讀，讀到誰，上方的畫面就亮起誰。
 * 畫面有兩個（家譜樹、大衛立的職位），跟著這幾節在講什麼自動換；
 * 這支程式只透過 ReadingStage 介面操作舞台，不直接碰畫布。
 * 沒開朗讀時，文字像字幕一樣照速度亮；開了朗讀就跟著聲音走。
 */
export interface ReaderApi {
  panel: HTMLElement;
  stage: HTMLElement;
  open(ref?: string, autoplay?: boolean): void;
  close(): void;
  isOpen(): boolean;
  /** 讀經中要看家譜樹上的某個人（例如職位圖小卡的「在家譜樹上看」）：像偷看一樣換到家譜樹、停止跟隨 */
  showOnTree(id: string): void;
  /** 跳到某一節（例如「拉10:25」）開始讀，跟按「下一節」一樣；路線上沒有這一節就不動，讀經沒開就從那一節打開 */
  jumpTo(key: string): void;
}

const CHARS_PER_SECOND = 4.6;
const SPEEDS = [0.75, 1, 1.25, 1.5] as const;
const SWITCH_MS = 450;
const storage = {
  get(key: string) { try { return localStorage.getItem(`adam-jesus:reader-${key}`); } catch { return null; } },
  set(key: string, value: string) { try { localStorage.setItem(`adam-jesus:reader-${key}`, value); } catch { /* 私密模式不保存 */ } },
};
/** 經文裡讀得出是誰的人名（家譜樹上的人、只在職位圖的人、歸回連回祖先的家族） */
const isNamed = (token: ReadingToken) => token.k === 'p' && (token.id !== undefined || token.rid !== undefined || token.link !== undefined);
/** 疊在畫布上的畫面（職位圖、名冊、城牆）；家譜樹是底下的畫布本身 */
const OVERLAYS = OVERLAY_STAGES;
/** 經文欄裡歸回連結小卡的標籤：名冊段（拉 2、尼 7）、城牆段（尼 3）和畫面上的字一致 */
function linkLabel(effect: ReadingLink['effect'], segmentStage: StageId): string {
  if (effect === 'town') return '家譜裡有這座城';
  if (effect === 'lost') return '族譜尋不著';
  return segmentStage === 'roster' || segmentStage === 'wall' ? '冊上有名' : '連回祖先';
}

export function createReader(reading: ReadingData, stages: Record<StageId, ReadingStage>, options: {
  speech?: SpeechController;
  onOpenChange?(open: boolean): void;
}): ReaderApi {
  const route = buildRoute(reading);
  const verses = route.verses;
  const motionOn = () => document.documentElement.dataset.motion !== 'off';
  const stageIds: StageId[] = ['tree', 'roles', 'roster', 'wall'];
  /** 小地圖與「偷看」的另一個畫面（規則在 reader-route.ts 的 otherStage） */
  function other(id: StageId): StageId {
    return otherStage(id, verseAt().segment.stage);
  }

  // ── 狀態 ─────────────────────────────────────────────
  let isOpen = false;
  let at = 0;
  let cursor = 0;
  let fired = 0;
  let playing = false;
  let follow = true;
  let speed = Number(storage.get('speed')) || 1;
  if (!SPEEDS.includes(speed as typeof SPEEDS[number])) speed = 1;
  let voiceOn = false;
  let renderedFragment = -1;
  let pauseUntil = 0;
  let lastFrame = 0;
  let frame = 0;
  let gapTimer = 0;
  /** 現在顯示在大畫面的舞台；還沒顯示過是 null */
  let shown: StageId | null = null;
  /** 換畫面的流水號：新的一次開始，舊的（還在等資料載入的）就作廢 */
  let switchSeq = 0;
  const readyStages = new Set<StageId>(['tree']);
  let savedViews: Partial<Record<StageId, unknown>> = {};
  let marks: StageMarks = emptyMarks();
  let revealed: string[] = [];
  let prefetchTimer = 0;
  /** 這一次的游標是跳讀、打開造成的（名冊直接畫好，不播動畫）；照速度往下讀時是 false */
  let cursorJumped = true;
  const lastPersonInSection = new Map<string, string>();
  const sectionOf = (item: RouteVerse) => item.verse.sec ?? item.segment.id;

  // ── 經文欄 ───────────────────────────────────────────
  const segmentSelect = h('select', { className: 'ag-rd-select', 'aria-label': '選段落' });
  const groups = new Map<string, HTMLOptGroupElement>();
  reading.segments.forEach((segment, index) => {
    let group = groups.get(segment.group);
    if (!group) {
      group = h('optgroup', { label: segment.group });
      groups.set(segment.group, group);
      segmentSelect.append(group);
    }
    group.append(h('option', { value: String(index) }, `${segment.title}　${segment.range}`));
  });
  segmentSelect.addEventListener('change', () => {
    const start = route.segmentStart[Number(segmentSelect.value)];
    if (start !== undefined) jump(start, 0, playing);
  });
  const closeButton = button('離開', () => close(), 'ag-rd-close');
  closeButton.setAttribute('aria-label', '離開帶你讀經');
  const panelTitle = h('strong', {}, '');
  const scroll = h('div', { className: 'ag-rd-scroll' });
  const playButton = button('播放', () => togglePlay(), 'ag-rd-play');
  const control = (label: string, symbol: string, action: () => void) => {
    const el = button(symbol, action, 'ag-rd-step');
    el.setAttribute('aria-label', label);
    el.title = label;
    return el;
  };
  const speedSelect = h('select', { className: 'ag-rd-select ag-rd-speed', 'aria-label': '速度' },
    ...SPEEDS.map((value) => h('option', { value: String(value), selected: value === speed }, `${value}×`)));
  speedSelect.addEventListener('change', () => {
    speed = Number(speedSelect.value);
    storage.set('speed', String(speed));
    // 換段的標題卡還在停的時候，語音交給停完的計時器去開，不在這裡先唸（否則會唸兩次）
    if (playing && voiceOn && performance.now() >= pauseUntil) speakFromCursor();
  });
  const voiceButton = button('朗讀', () => toggleVoice(), 'ag-rd-voice');
  voiceButton.setAttribute('aria-pressed', 'false');
  const voiceNote = h('p', { className: 'ag-rd-voice-note', hidden: true }, '這台裝置沒有中文語音，可以用文字跟著讀。');
  const panel = h('section', { className: 'ag-rd-panel', role: 'region', 'aria-label': '帶你讀經', hidden: true },
    h('header', { className: 'ag-rd-head' },
      h('div', { className: 'ag-rd-title' }, h('span', { className: 'ag-rd-eyebrow' }, '帶你讀經'), panelTitle),
      segmentSelect, closeButton),
    scroll,
    h('footer', { className: 'ag-rd-controls' },
      h('div', { className: 'ag-rd-transport' },
        control('上一節', '⇤', () => stepVerse(-1)),
        control('上一個名字', '‹', () => stepName(-1)),
        playButton,
        control('下一個名字', '›', () => stepName(1)),
        control('下一節', '⇥', () => stepVerse(1))),
      h('div', { className: 'ag-rd-options' }, speedSelect, voiceButton),
      voiceNote,
      h('p', { className: 'ag-rd-credit' }, '經文：和合本　讀經字型：霞鶩文楷 TC（SIL Open Font License 1.1）')));
  const returnButton = button('回到朗讀處', () => returnToReading(), 'ag-rd-return');
  returnButton.hidden = true;
  const chapterCard = h('div', { className: 'ag-rd-chapter-card', 'aria-hidden': 'true' });

  // 小地圖：另一個畫面的縮影，上面一個紅點標出現在讀到的人
  const miniView = h('span', { className: 'ag-rd-mini-view' });
  const miniDot = h('i', { className: 'ag-rd-mini-dot', hidden: true });
  const miniName = h('span', { className: 'ag-rd-mini-name' }, '');
  const miniButton = h('button', { className: 'ag-rd-mini', type: 'button', hidden: true }, miniView, miniName);
  miniButton.addEventListener('click', () => peek());
  let miniFor: StageId | null = null;

  const stage = h('div', { className: 'ag-rd-stage' }, chapterCard, miniButton, returnButton);

  for (const id of stageIds) {
    stages[id].onUserCamera(() => {
      if (!isOpen || !follow || shown !== id) return;
      follow = false;
      returnButton.hidden = false;
    });
  }

  const verseAt = () => verses[at]!;

  // ── 經文欄的內容 ─────────────────────────────────────
  function renderFragment(item: RouteVerse) {
    renderedFragment = item.fragmentIndex;
    const heading = chapterHeading(item);
    const article = h('article', { className: 'ag-rd-text' });
    // 段落的第一個片段，上面再加段落標題
    const first = verses[route.segmentStart[item.segmentIndex] ?? 0];
    if (first && first.fragmentIndex === item.fragmentIndex) {
      article.append(h('div', { className: 'ag-rd-segment-head' },
        h('strong', {}, item.segment.title), h('span', {}, item.segment.range)));
    }
    article.append(heading.kind === 'named'
      ? h('h2', { className: 'ag-rd-chapter-head' },
        h('span', { className: 'ag-rd-chapter-no' }, heading.no),
        h('span', { className: 'ag-rd-chapter-name' }, heading.name))
      : h('h2', { className: 'ag-rd-chapter-head' },
        h('span', { className: 'ag-rd-chapter-no is-book' }, heading.label),
        h('span', { className: 'ag-rd-chapter-name' })));
    for (const entry of verses) {
      if (entry.fragmentIndex !== item.fragmentIndex) continue;
      article.append(...renderVerse(entry));
    }
    scroll.replaceChildren(article);
    scroll.scrollTop = 0;
  }

  function renderVerse(item: RouteVerse): HTMLElement[] {
    const line = h('span', { className: 'ag-rd-line' });
    let position = 0;
    const text = item.verse.text;
    const segment = (s: number, e: number, token?: ReadingToken) => {
      const named = token ? isNamed(token) : false;
      const el = h('span', { className: `ag-rd-seg${token ? ` ag-rd-k-${token.k}${named ? ' ag-rd-person' : ''}` : ''}`,
        dataset: { s: String(s), e: String(e) } }, text.slice(s, e));
      if (token && named) {
        el.setAttribute('role', 'button');
        el.tabIndex = 0;
        const go = () => jump(item.index, token.s, playing);
        el.addEventListener('click', go);
        el.addEventListener('keydown', (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); go(); } });
      }
      line.append(el);
    };
    for (const token of item.verse.t) {
      if (token.s > position) segment(position, token.s);
      segment(token.s, token.e, token);
      position = token.e;
    }
    if (position < text.length) segment(position, text.length);
    const number = button(String(item.verse.v), () => jump(item.index, 0, playing), 'ag-rd-vno');
    number.setAttribute('aria-label', `從第 ${item.verse.v} 節讀起`);
    const out: HTMLElement[] = [h('p', { className: 'ag-rd-verse', dataset: { i: String(item.index) } }, number, line)];
    if (item.verse.note !== undefined && reading.notes[item.verse.note]) {
      out.push(h('aside', { className: 'ag-rd-note', dataset: { i: String(item.index) } },
        h('span', { className: 'ag-rd-note-label' }, '讀經提醒'), reading.notes[item.verse.note]!.text));
    }
    for (const index of item.verse.diff ?? []) {
      const diff = reading.diffs[index];
      if (diff) out.push(diffCard(item.index, diff));
    }
    item.verse.t.forEach((token, tokenIndex) => {
      const link = token.link !== undefined ? reading.links[token.link] : undefined;
      if (!link?.card) return;
      out.push(h('aside', { className: 'ag-rd-note ag-rd-linkcard', dataset: { i: String(item.index), t: String(tokenIndex) } },
        h('span', { className: 'ag-rd-note-label' }, linkLabel(link.effect, item.segment.stage)),
        h('span', { className: 'ag-rd-linkcard-text' }, link.card),
        link.refs.length ? h('span', { className: 'ag-rd-linkcard-refs' }, link.refs.join('、')) : null));
    });
    return out;
  }

  function diffCard(index: number, diff: ReadingDiff): HTMLElement {
    return h('aside', { className: 'ag-rd-note ag-rd-diff', dataset: { i: String(index) } },
      h('span', { className: 'ag-rd-note-label' }, '兩處寫法不同'),
      h('span', { className: 'ag-rd-diff-title' }, diff.title),
      ...diff.sides.map((side) => h('span', { className: 'ag-rd-diff-side' },
        h('span', { className: 'ag-rd-diff-text' }, `「${side.text}」`),
        h('span', { className: 'ag-rd-diff-ref' }, side.ref))));
  }

  // 經文欄只捲動自己，不動整頁
  function scrollToVerse(index: number, smooth: boolean) {
    const paragraph = scroll.querySelector<HTMLElement>(`.ag-rd-verse[data-i="${index}"]`);
    if (!paragraph) return;
    // 每個章片段第一節捲回最上面，章名才看得到
    const inside = paragraph.getBoundingClientRect().top - scroll.getBoundingClientRect().top + scroll.scrollTop;
    const top = verses[index]!.firstInFragment ? 0 : inside - scroll.clientHeight * 0.22;
    scroll.scrollTo({ top: Math.max(0, top), behavior: smooth && motionOn() ? 'smooth' : 'auto' });
  }

  function paintText() {
    for (const paragraph of scroll.querySelectorAll<HTMLElement>('.ag-rd-verse')) {
      const index = Number(paragraph.dataset.i);
      paragraph.classList.toggle('is-past', index < at);
      paragraph.classList.toggle('is-now', index === at);
    }
    for (const note of scroll.querySelectorAll<HTMLElement>('.ag-rd-note')) {
      const index = Number(note.dataset.i);
      // 連回祖先的小卡跟著人名出現：讀到那個名字才出現
      const token = note.dataset.t;
      note.classList.toggle('is-shown', token === undefined ? index <= at : index < at || (index === at && Number(token) < fired));
    }
    if (shown !== null && readyStages.has(shown)) stages[shown].setCursor?.(cursor, cursorJumped);
    const paragraph = scroll.querySelector<HTMLElement>(`.ag-rd-verse[data-i="${at}"]`);
    if (!paragraph) return;
    for (const segment of paragraph.querySelectorAll<HTMLElement>('.ag-rd-seg')) {
      const s = Number(segment.dataset.s);
      const e = Number(segment.dataset.e);
      segment.classList.toggle('is-read', e <= cursor);
      segment.classList.toggle('is-now', s <= cursor && cursor < e && segment.classList.contains('ag-rd-person'));
    }
  }

  // ── 舞台與鏡頭 ───────────────────────────────────────
  function pushMarks() {
    for (const id of readyStages) stages[id].setMarks(marks);
  }

  function focusTarget(): string | null {
    const item = verseAt();
    const target = stages[item.stage];
    // 名冊、城牆沒有「人」的位置：鏡頭就是讓讀到的那一行（那一段）留在看得到的地方
    const listTarget = listFocusTarget(item.stage);
    if (listTarget) return listTarget;
    if (marks.current && target.has(marks.current)) return marks.current;
    if (item.stage === 'roles') return item.verse.box ?? null;
    return item.verse.hold ?? lastPersonInSection.get(sectionOf(item)) ?? anchorPerson(route, at);
  }
  /** 每個舞台最後一次鏡頭停的位置：偷看另一個畫面時，鏡頭才不是停在不相干的地方 */
  const lastFocus: Partial<Record<StageId, string>> = {};
  /** 最後讀到的家譜樹人物 */
  let lastTreeId: string | null = null;
  function focusCamera(animate: boolean) {
    const item = verseAt();
    if (shown !== item.stage) return;
    const target = focusTarget();
    if (!target) return;
    lastFocus[item.stage] = target;
    void stages[item.stage].flyTo(target, animate);
  }

  let leaveTimer = 0;
  let enterTimer = 0;
  /** 把 next 換到大畫面。職位圖、名冊是疊在畫布上面的一層：出現時從右上角放大淡入，退下時縮回右上角 */
  function applyFront(next: StageId, animate: boolean) {
    const previous = shown;
    shown = next;
    const motion = animate && motionOn() && previous !== null && previous !== next;
    window.clearTimeout(leaveTimer);
    window.clearTimeout(enterTimer);
    for (const id of OVERLAYS) {
      const overlay = stages[id].el;
      overlay.classList.remove('ag-rd-overlay-enter', 'ag-rd-overlay-leave');
      if (id === next) {
        overlay.classList.add('ag-rd-overlay-on');
        if (motion) {
          overlay.getBoundingClientRect();
          overlay.classList.add('ag-rd-overlay-enter');
          enterTimer = window.setTimeout(() => overlay.classList.remove('ag-rd-overlay-enter'), SWITCH_MS + 60);
        }
      } else if (motion && id === previous && overlay.classList.contains('ag-rd-overlay-on')) {
        overlay.classList.add('ag-rd-overlay-leave');
        leaveTimer = window.setTimeout(() => overlay.classList.remove('ag-rd-overlay-on', 'ag-rd-overlay-leave'), SWITCH_MS);
      } else {
        overlay.classList.remove('ag-rd-overlay-on');
      }
    }
    miniButton.classList.toggle('is-fresh', motion);
    refreshMini(true);
    // 名冊換上來時，先照目前讀到的位置畫好
    if (readyStages.has(next)) stages[next].setCursor?.(cursor, true);
  }

  /** 換畫面：等新舞台準備好 → 出標題卡 → 舊的縮成小地圖、新的浮上來 */
  async function switchTo(next: StageId, opts: { item?: RouteVerse; card?: 'switch' | 'chapter' | null; focus?: boolean; animate?: boolean }) {
    const seq = ++switchSeq;
    if (!readyStages.has(next)) {
      try { await stages[next].ready(); } catch { return; }
      readyStages.add(next);
      if (seq !== switchSeq || !isOpen) return;
      stages[next].reveal(revealed);
    }
    if (seq !== switchSeq || !isOpen) return;
    pushMarks();
    if (opts.card && opts.item) showCard(opts.item, opts.card === 'switch');
    applyFront(next, opts.animate ?? true);
    if (opts.focus && follow) focusCamera(opts.animate ?? true);
  }

  function peek() {
    if (!isOpen || shown === null) return;
    const target = other(shown);
    const home = target === verseAt().stage;
    follow = home;
    returnButton.hidden = home;
    void switchTo(target, { focus: home }).then(() => {
      // 偷看：鏡頭移到現在讀到的人，沒有就停在這個畫面上次停的地方（只移一次，之後使用者自己看）
      if (home || !isOpen || shown !== target) return;
      const spot = marks.current && stages[target].has(marks.current) ? marks.current : lastFocus[target] ?? (target === 'tree' ? lastTreeId : null);
      if (spot) void stages[target].flyTo(spot, false);
    });
  }

  function returnToReading() {
    follow = true;
    returnButton.hidden = true;
    const item = verseAt();
    if (shown !== item.stage) void switchTo(item.stage, { focus: true });
    else focusCamera(true);
  }

  // ── 小地圖 ───────────────────────────────────────────
  function refreshMini(rebuild: boolean) {
    if (!isOpen || shown === null) { miniButton.hidden = true; return; }
    const target = other(shown);
    miniButton.hidden = false;
    if (rebuild || miniFor !== target) {
      miniFor = target;
      miniView.replaceChildren(stages[target].miniature(), miniDot);
      miniName.textContent = STAGE_LABEL[target].view;
      miniButton.setAttribute('aria-label', `看${STAGE_LABEL[target].view}`);
      miniButton.title = `看${STAGE_LABEL[target].view}`;
    }
    // 城牆的縮圖不靠家譜樹上的人：用「現在讀到的那一段」定位
    const spotKey = marks.current ?? (target === 'wall' ? 'wall:now' : null);
    const spot = spotKey ? stages[target].locate(spotKey) : null;
    miniDot.hidden = !spot;
    if (spot) {
      miniDot.style.left = `${(spot.x * 100).toFixed(1)}%`;
      miniDot.style.top = `${(spot.y * 100).toFixed(1)}%`;
    }
  }

  // ── 進到一節 ─────────────────────────────────────────
  /** 回傳這一節進來時要出的標題卡種類（播放時依此決定停多久） */
  function enterVerse(index: number, opts: { keepTrail?: boolean; wantCard?: boolean; opening?: boolean } = {}): 'switch' | 'chapter' | null {
    const { keepTrail = true, wantCard = true, opening = false } = opts;
    const previous = marks;
    at = Math.max(0, Math.min(verses.length - 1, index));
    cursor = 0;
    fired = 0;
    const item = verseAt();
    const plan = entryPlan(item, { renderedFragment, shown, follow, wantCard });
    if (plan.fragmentChanged) renderFragment(item);
    panelTitle.textContent = item.segment.title;
    segmentSelect.value = String(item.segmentIndex);
    marks = {
      ...emptyMarks(),
      trail: keepTrail ? new Set([...previous.lit]) : new Set(),
      boxes: new Set(item.verse.box ? [item.verse.box] : []),
      links: linksReadBefore(route, at),
    };
    const ids = new Set<string>();
    for (const token of item.verse.t) {
      if (token.id) ids.add(token.id);
      if (token.rid) ids.add(token.rid);
      if (token.of) ids.add(token.of);
      for (const from of token.from ?? []) ids.add(from);
      for (const to of token.to ?? []) ids.add(to);
      if (token.link !== undefined) {
        const targets = linkTargets(reading.links[token.link]);
        for (const id of [...targets.tree, ...targets.roles, ...targets.boxes]) ids.add(id);
      }
    }
    if (item.verse.hold) ids.add(item.verse.hold);
    if (item.verse.box) ids.add(item.verse.box);
    // 這一節沒有人名時鏡頭停在前面讀到的人（拉 2:10 停在 2:2 的耶書亞）：直接從這一節打開時那一支還沒展開，也要展開
    if (item.stage === 'tree' && !item.verse.hold) {
      const back = lastPersonInSection.get(sectionOf(item)) ?? anchorPerson(route, at);
      if (back) ids.add(back);
    }
    revealed = [...ids];
    for (const id of stageIds) stages[id].setVerse?.(item.key);
    for (const id of readyStages) stages[id].reveal(revealed);
    pushMarks();

    if (plan.switching) {
      void switchTo(item.stage, { item, card: plan.card, focus: true, animate: !opening });
    } else {
      // 還在等載入的換畫面請求（例如剛跳到職位圖的節、又立刻跳回家譜樹的節）一律作廢
      switchSeq += 1;
      if (plan.card) showCard(item, plan.card === 'switch');
      if (follow) enterCamera(item, plan.fragmentChanged);
    }
    refreshMini(false);
    history.replaceState(null, '', `${location.pathname}${location.search}#read=${encodeURIComponent(item.key)}`);
    storage.set('at', item.key);
    paintText();
    scrollToVerse(at, true);
    return plan.card;
  }

  /** 進到新的一節：沒有人名就把鏡頭停在這一節的位置；換章片段時趁標題卡還在，先飛到第一個人 */
  function enterCamera(item: RouteVerse, fragmentChanged: boolean) {
    const target = stages[item.stage];
    const first = item.verse.t.find(isNamed);
    if (first && !fragmentChanged) return;
    const own = first ? [first.id, first.rid].find((id): id is string => Boolean(id) && target.has(id!)) : undefined;
    const goal = own ?? focusTarget();
    if (!goal) return;
    lastFocus[item.stage] = goal;
    void target.flyTo(goal, true);
  }

  /** 讀到 cursor 為止的標記；quiet 時不要落筆動畫（跳讀時用） */
  function fireUpTo(quiet: boolean) {
    const item = verseAt();
    const tokens = item.verse.t;
    const fresh = new Set<string>();
    let moved = false;
    while (fired < tokens.length && tokens[fired]!.s <= cursor) {
      const token = tokens[fired]!;
      const key = `${at}:${fired}`;
      if (token.k === 'p') {
        const who = token.id ?? token.rid;
        if (who) {
          marks.lit.add(who);
          marks.current = who;
          moved = true;
        }
        if (token.id) {
          lastPersonInSection.set(sectionOf(item), token.id);
          lastTreeId = token.id;
          for (const from of token.from ?? []) {
            marks.ink.push({ from, to: token.id, key: `${key}:${from}` });
            fresh.add(`${key}:${from}`);
          }
          for (const to of token.to ?? []) {
            marks.ink.push({ from: token.id, to, key: `${key}:>${to}` });
            fresh.add(`${key}:>${to}`);
          }
        }
      } else if (token.k === 't' && token.of) {
        marks.seals.push({ id: token.of, label: item.verse.text.slice(token.s, token.e), key });
        fresh.add(key);
      }
      // 歸回連結：家族名（人名）或城名（地名，「家譜裡有這座城」）
      if (token.link !== undefined) {
        const targets = linkTargets(reading.links[token.link]);
        marks.links.add(token.link);
        for (const id of [...targets.tree, ...targets.roles]) marks.lit.add(id);
        for (const box of targets.boxes) marks.boxes.add(box);
        if (targets.current) marks.current = targets.current;
        if (targets.tree[0]) lastPersonInSection.set(sectionOf(item), targets.tree[0]);
        moved = true;
      }
      fired += 1;
    }
    if (fresh.size || moved) {
      marks = { ...marks, fresh: quiet ? new Set() : fresh };
      pushMarks();
      refreshMini(false);
      // 安靜地點亮（跳讀、換章、打開時）不動鏡頭，由呼叫的地方決定怎麼移；
      // 否則這裡會先直接切過去，換章時「先拉遠再推近」就沒有東西可飛
      if (moved && follow && !quiet) focusCamera(true);
    }
  }

  function jump(index: number, toChar: number, keepPlaying: boolean) {
    stopVoice();
    cursorJumped = true;
    enterVerse(index, { keepTrail: false });
    cursor = toChar;
    fireUpTo(true);
    if (follow) focusCamera(true);
    paintText();
    pauseUntil = performance.now() + 250;
    if (keepPlaying) play(); else pause();
  }

  function stepVerse(direction: -1 | 1) {
    jump(Math.max(0, Math.min(verses.length - 1, at + direction)), 0, playing);
  }

  /** 上一個／下一個人名，可以跨節 */
  function stepName(direction: -1 | 1) {
    const persons = (index: number) => verses[index]!.verse.t.filter(isNamed);
    if (direction > 0) {
      const next = persons(at).find((token) => token.s > cursor);
      if (next) { jump(at, next.s, playing); return; }
      for (let index = at + 1; index < verses.length; index += 1) {
        const first = persons(index)[0];
        if (first) { jump(index, first.s, playing); return; }
      }
    } else {
      // 正在讀的是 cursor 之前最後一個名字；往回就是它的前一個
      const list = persons(at);
      let current = -1;
      list.forEach((token, index) => { if (token.s <= cursor) current = index; });
      if (current > 0) { jump(at, list[current - 1]!.s, playing); return; }
      for (let index = at - 1; index >= 0; index -= 1) {
        const list = persons(index);
        if (list.length) { jump(index, list[list.length - 1]!.s, playing); return; }
      }
    }
  }

  // ── 播放 ─────────────────────────────────────────────
  function play() {
    playing = true;
    playButton.textContent = '暫停';
    playButton.classList.add('is-playing');
    lastFrame = performance.now();
    if (voiceOn) speakFromCursor();
    cancelAnimationFrame(frame);
    frame = requestAnimationFrame(tick);
  }
  function pause() {
    playing = false;
    playButton.textContent = '播放';
    playButton.classList.remove('is-playing');
    stopVoice();
    cancelAnimationFrame(frame);
  }
  function togglePlay() { if (playing) pause(); else play(); }

  function endOfVerse() {
    if (at >= verses.length - 1) { pause(); return; }
    cursorJumped = false;
    const card = enterVerse(at + 1);
    // 換章、換畫面的時候讓標題卡停一下
    const gap = gapAfterVerse(card, speed);
    pauseUntil = performance.now() + gap;
    window.clearTimeout(gapTimer);
    if (voiceOn && playing) gapTimer = window.setTimeout(() => { if (playing && voiceOn) speakFromCursor(); }, gap);
  }

  function tick(now: number) {
    if (!playing) return;
    // 背景分頁回來時不要一口氣跳太多
    const dt = Math.max(0, Math.min(0.25, (now - lastFrame) / 1000));
    lastFrame = now;
    if (!voiceOn && now >= pauseUntil) {
      const text = verseAt().verse.text;
      cursor = Math.min(text.length, cursor + dt * CHARS_PER_SECOND * speed);
      cursorJumped = false;
      fireUpTo(false);
      paintText();
      if (cursor >= text.length) endOfVerse();
    }
    frame = requestAnimationFrame(tick);
  }

  // ── 朗讀 ─────────────────────────────────────────────
  function speakFromCursor() {
    const speech = options.speech;
    if (!speech || !voiceOn) return;
    const item = verseAt();
    const start = Math.floor(cursor);
    const index = at;
    speech.speak(item.verse.text, {
      rate: speed,
      startChar: start >= item.verse.text.length ? 0 : start,
      onBoundary(charIndex) {
        if (index !== at || !playing) return;
        cursor = Math.max(cursor, charIndex);
        cursorJumped = false;
        fireUpTo(false);
        paintText();
      },
      onEnd() {
        if (index !== at || !playing) return;
        cursor = item.verse.text.length;
        cursorJumped = false;
        fireUpTo(false);
        paintText();
        endOfVerse();
      },
    });
  }
  function stopVoice() {
    window.clearTimeout(gapTimer);
    options.speech?.stop();
  }
  async function toggleVoice() {
    const speech = options.speech;
    if (!voiceOn) {
      const ok = Boolean(speech?.supported()) && Boolean(await speech?.ready());
      voiceNote.hidden = ok;
      if (!ok) return;
      voiceOn = true;
      if (playing) speakFromCursor();
    } else {
      voiceOn = false;
      stopVoice();
      lastFrame = performance.now();
    }
    voiceButton.setAttribute('aria-pressed', String(voiceOn));
    voiceButton.classList.toggle('is-on', voiceOn);
  }

  // ── 標題卡 ───────────────────────────────────────────
  let cardTimer = 0;
  function showCard(item: RouteVerse, switching: boolean) {
    window.clearTimeout(cardTimer);
    const text = cardText(item, switching);
    chapterCard.replaceChildren(
      h('span', { className: 'ag-rd-card-seal' }, text.seal),
      h('span', { className: `ag-rd-card-no${text.bigIsTitle ? ' is-title' : ''}` }, text.big),
      h('span', { className: 'ag-rd-card-title' }, text.small));
    chapterCard.classList.remove('is-on');
    chapterCard.getBoundingClientRect();
    chapterCard.classList.add('is-on');
    cardTimer = window.setTimeout(() => chapterCard.classList.remove('is-on'), 2400);
  }

  // ── 開關 ─────────────────────────────────────────────
  function open(ref?: string, autoplay = true) {
    const index = startIndex(route, reading.start, ref, storage.get('at'));
    const item = verses[index]!;
    if (!isOpen) {
      isOpen = true;
      shown = null;
      lastTreeId = null;
      for (const id of stageIds) delete lastFocus[id];
      miniFor = null;
      savedViews = Object.fromEntries(stageIds.map((id) => [id, stages[id].saveView()]));
      panel.hidden = false;
      stage.hidden = false;
      document.documentElement.classList.add('ag-reading');
      for (const id of OVERLAYS) stages[id].el.classList.add('ag-rd-overlay');
      for (const id of stageIds) stages[id].setReading(true);
      options.onOpenChange?.(true);
      document.addEventListener('keydown', onKey);
      // 職位圖、名冊的資料晚一點在背景載入，小地圖和換畫面時才不用等
      window.clearTimeout(prefetchTimer);
      prefetchTimer = window.setTimeout(() => {
        for (const id of OVERLAYS) {
          if (!isOpen || readyStages.has(id)) continue;
          void stages[id].ready().then(() => {
            if (!isOpen || readyStages.has(id)) return;
            readyStages.add(id);
            stages[id].reveal(revealed);
            pushMarks();
            refreshMini(true);
          }).catch(() => undefined);
        }
      }, 700);
    }
    cursorJumped = true;
    follow = true;
    returnButton.hidden = true;
    renderedFragment = -1;
    // 從連結直接打開到章中間的某一節時，不放標題卡
    const card = enterVerse(index, { keepTrail: false, wantCard: item.firstInFragment, opening: true });
    const firstPerson = item.verse.t.find(isNamed);
    if (firstPerson && !autoplay) { cursor = firstPerson.s; fireUpTo(true); paintText(); }
    focusCamera(false);
    pauseUntil = performance.now() + (card ? 2600 : 400);
    if (autoplay) play(); else pause();
  }

  function close() {
    if (!isOpen) return;
    pause();
    isOpen = false;
    switchSeq += 1;
    window.clearTimeout(prefetchTimer);
    window.clearTimeout(leaveTimer);
    window.clearTimeout(enterTimer);
    window.clearTimeout(cardTimer);
    panel.hidden = true;
    stage.hidden = true;
    chapterCard.classList.remove('is-on');
    miniButton.hidden = true;
    shown = null;
    for (const id of OVERLAYS) stages[id].el.classList.remove('ag-rd-overlay', 'ag-rd-overlay-on', 'ag-rd-overlay-enter', 'ag-rd-overlay-leave');
    document.documentElement.classList.remove('ag-reading');
    for (const id of stageIds) stages[id].setReading(false);
    for (const id of stageIds) if (savedViews[id] !== null && savedViews[id] !== undefined) stages[id].restoreView(savedViews[id]);
    savedViews = {};
    document.removeEventListener('keydown', onKey);
    if (location.hash.startsWith('#read=')) history.replaceState(null, '', `${location.pathname}${location.search}`);
    options.onOpenChange?.(false);
  }

  function onKey(event: KeyboardEvent) {
    const target = event.target as HTMLElement | null;
    if (target && /^(INPUT|SELECT|TEXTAREA)$/.test(target.tagName)) return;
    if (document.querySelector('.ag-modal-layer:not([hidden])')) return;
    if (event.key === 'ArrowRight') { event.preventDefault(); stepName(1); }
    else if (event.key === 'ArrowLeft') { event.preventDefault(); stepName(-1); }
    // 焦點在按鈕或人名上時，空白鍵是按那個東西，不是播放／暫停
    else if (event.key === ' ' && !target?.closest('button, [role="button"]')) { event.preventDefault(); togglePlay(); }
    else if (event.key === 'Escape') close();
  }

  stage.hidden = true;
  function showOnTree(id: string) {
    if (!isOpen) return;
    follow = false;
    returnButton.hidden = false;
    void switchTo('tree', { focus: false }).then(() => {
      if (!isOpen || shown !== 'tree') return;
      stages.tree.reveal([id]);
      if (stages.tree.has(id)) void stages.tree.flyTo(id, true);
    });
  }

  function jumpTo(key: string) {
    const index = jumpIndex(route, key);
    if (index === null) return;
    if (!isOpen) { open(key, false); return; }
    // 回到朗讀處、繼續跟隨，再跳到那一節
    follow = true;
    returnButton.hidden = true;
    jump(index, 0, playing);
  }

  return { panel, stage, open, close, isOpen: () => isOpen, showOnTree, jumpTo };
}
