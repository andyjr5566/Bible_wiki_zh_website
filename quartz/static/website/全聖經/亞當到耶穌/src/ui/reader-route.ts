import type { ReadingChapter, ReadingData, ReadingLink, ReadingSegment, ReadingVerse, StageId } from '../data/types';

/**
 * 讀經路線：把「一串段落」攤平成一節一節，並預先算好換章、換畫面、歸回連結的查表。
 * 這裡只放不碰網頁的純函式，讀經程式（reader.ts）和測試共用。
 */
export interface RouteVerse {
  index: number;
  /** 例如「代上24:10」，也是網址 #read= 與記住讀到哪裡用的 key */
  key: string;
  segmentIndex: number;
  segment: ReadingSegment;
  /** 這一節屬於第幾個章片段（整條路線一起編號；一個段落可以有好幾個章片段） */
  fragmentIndex: number;
  chapter: ReadingChapter;
  verse: ReadingVerse;
  /** 這一節用哪個畫面：verse.stage，沒有就用段落的 stage */
  stage: StageId;
  firstInSegment: boolean;
  firstInFragment: boolean;
}

export interface Route {
  verses: RouteVerse[];
  byKey: Map<string, number>;
  /** 每個段落第一節的位置 */
  segmentStart: number[];
  /** 路線上所有帶 link 的人名標記，依讀到的順序 */
  linkOrder: number[];
  /** 每一節之前（不含這一節）已經有幾個歸回連結讀過，是 linkOrder 的前綴長度 */
  linksBefore: number[];
}

export const STAGE_LABEL: Record<StageId, { card: string; view: string }> = {
  tree: { card: '家譜', view: '家譜樹' },
  roles: { card: '職位', view: '職位圖' },
  roster: { card: '名冊', view: '名冊' },
  wall: { card: '城牆', view: '城牆' },
};

/** 疊在畫布上的畫面（職位圖、名冊、城牆）；家譜樹是底下的畫布本身 */
export const OVERLAY_STAGES: StageId[] = ['roles', 'roster', 'wall'];

/** 這個畫面是「名單類」（名冊、城牆）：沒有人的位置，鏡頭就是讓目前讀到的地方留在看得到的範圍 */
export function isListStage(id: StageId): boolean {
  return id === 'roster' || id === 'wall';
}

/**
 * 小地圖與「偷看」的另一個畫面：名冊、城牆 → 家譜樹（看祖先在樹上哪裡）；
 * 名冊段、城牆段裡的家譜樹或職位圖 → 回到那一段自己的畫面；其他照舊（家譜樹 ↔ 職位圖）
 */
export function otherStage(id: StageId, base: StageId): StageId {
  if (isListStage(id)) return 'tree';
  if (isListStage(base)) return base;
  return id === 'tree' ? 'roles' : 'tree';
}

/** 鏡頭在名單類畫面上的目標：讓目前讀到的地方留在看得到的範圍（'roster:now'、'wall:now'） */
export function listFocusTarget(id: StageId): string | null {
  return isListStage(id) ? `${id}:now` : null;
}

/** 讀經跳到某一節（「拉10:25」）：路線上沒有這一節就回 null */
export function jumpIndex(route: Route, key: string): number | null {
  return resolveRef(route, key);
}

export function buildRoute(reading: ReadingData): Route {
  const verses: RouteVerse[] = [];
  const byKey = new Map<string, number>();
  const segmentStart: number[] = [];
  const linkOrder: number[] = [];
  const linksBefore: number[] = [];
  let fragmentIndex = 0;
  reading.segments.forEach((segment, segmentIndex) => {
    segmentStart.push(verses.length);
    segment.chapters.forEach((chapter) => {
      chapter.verses.forEach((verse, position) => {
        const key = `${chapter.book}${chapter.n}:${verse.v}`;
        if (!byKey.has(key)) byKey.set(key, verses.length);
        linksBefore.push(linkOrder.length);
        for (const token of verse.t) if (token.link !== undefined) linkOrder.push(token.link);
        verses.push({
          index: verses.length, key, segmentIndex, segment, fragmentIndex, chapter, verse,
          stage: verse.stage ?? segment.stage,
          firstInSegment: verses.length === segmentStart[segmentIndex],
          firstInFragment: position === 0,
        });
      });
      fragmentIndex += 1;
    });
  });
  return { verses, byKey, segmentStart, linkOrder, linksBefore };
}

/** 網址、記住的位置可能寫成「代上 24：10」，統一成「代上24:10」 */
export function normalizeRef(ref: string): string {
  return ref.normalize('NFKC').replace(/\s+/g, '');
}

export function resolveRef(route: Route, ref: string | null | undefined): number | null {
  if (!ref) return null;
  const found = route.byKey.get(normalizeRef(ref));
  return found === undefined ? null : found;
}

/** 開啟時從哪一節讀起：網址指定的 → 上次讀到的 → 路線起點 → 第一節 */
export function startIndex(route: Route, start: string, ref?: string | null, saved?: string | null): number {
  return resolveRef(route, ref) ?? resolveRef(route, saved) ?? resolveRef(route, start) ?? 0;
}

// ── 章名 ─────────────────────────────────────────────

const DIGITS = ['零', '一', '二', '三', '四', '五', '六', '七', '八', '九'];
/** 一到九十九的中文數字 */
export function chineseNumber(n: number): string {
  if (!Number.isInteger(n) || n < 0 || n > 99) return String(n);
  if (n < 10) return DIGITS[n]!;
  const tens = Math.floor(n / 10);
  const ones = n % 10;
  return `${tens > 1 ? DIGITS[tens] : ''}十${ones ? DIGITS[ones] : ''}`;
}

/**
 * 章片段的標題。章有自己的名字（代上 1–9 的附錄章名）時，照第一階段寫「第N章　章名」；
 * 其他書卷的片段標題就是段落標題，改寫「書卷全名 第N章」。
 */
export type ChapterHeading =
  | { kind: 'named'; no: string; name: string }
  | { kind: 'book'; label: string };

export function chapterHeading(item: Pick<RouteVerse, 'chapter' | 'segment'>): ChapterHeading {
  const { chapter, segment } = item;
  if (chapter.title && chapter.title !== segment.title) return { kind: 'named', no: `第${chineseNumber(chapter.n)}章`, name: chapter.title };
  return { kind: 'book', label: `${chapter.bookName} 第${chapter.n}章` };
}

export interface CardText {
  seal: string;
  big: string;
  small: string;
  /** 大字是一句標題（不是「第三章」那種短字），字級要小一點 */
  bigIsTitle: boolean;
}

/** 標題卡：換畫面時印章寫畫面名，沒換就寫書卷名 */
export function cardText(item: RouteVerse, switching: boolean): CardText {
  const heading = chapterHeading(item);
  if (!switching && heading.kind === 'named') return { seal: item.chapter.bookName, big: heading.no, small: heading.name, bigIsTitle: false };
  const where = `${item.chapter.bookName} 第${item.chapter.n}章`;
  return {
    seal: switching ? STAGE_LABEL[item.stage].card : item.chapter.bookName,
    big: item.verse.sec ?? item.segment.title,
    small: where,
    bigIsTitle: true,
  };
}

export interface EntryPlan {
  /** 要換畫面（跟隨中，而且這一節的畫面不是現在顯示的） */
  switching: boolean;
  /** 換了章片段（經文欄要重畫） */
  fragmentChanged: boolean;
  /** 標題卡：換畫面出「換畫面」那一張；段落開頭或換章只出章名卡；兩件事同時發生只出一張 */
  card: 'switch' | 'chapter' | null;
}

/** 進到某一節時，要不要換畫面、要不要出標題卡。wantCard 是 false（例如從網址直接跳到章中間）就不出卡 */
export function entryPlan(
  item: RouteVerse,
  state: { renderedFragment: number; shown: StageId | null; follow: boolean; wantCard: boolean },
): EntryPlan {
  const switching = state.follow && state.shown !== item.stage;
  const fragmentChanged = item.fragmentIndex !== state.renderedFragment;
  const card = !state.wantCard ? null : switching ? 'switch' : fragmentChanged ? 'chapter' : null;
  return { switching, fragmentChanged, card };
}

/** 讀完一節接下一節之前停多久（毫秒）：有標題卡就停 2.6 秒讓人看得到 */
export function gapAfterVerse(planCard: EntryPlan['card'], speed: number): number {
  return planCard ? 2600 : 520 / speed;
}

// ── 歸回連結、鏡頭目標 ──────────────────────────────

export interface LinkTargets {
  /** 家譜樹上的人 */
  tree: string[];
  /** 職位圖上的方塊成員，寫成 role:<方塊>:<成員> */
  roles: string[];
  /** 連到的職位方塊 */
  boxes: string[];
  /** 鏡頭和「目前讀到的人」用哪一個：先家譜樹，再職位圖 */
  current: string | null;
}

export function linkTargets(link: ReadingLink | undefined): LinkTargets {
  const result: LinkTargets = { tree: [], roles: [], boxes: [], current: null };
  for (const target of link?.to ?? []) {
    if (target.tree) result.tree.push(target.tree);
    if (target.role) {
      result.boxes.push(target.role);
      if (target.member) result.roles.push(`role:${target.role}:${target.member}`);
    }
  }
  result.current = result.tree[0] ?? result.roles[0] ?? null;
  return result;
}

/** 本小段裡，這一節之前最後一位家譜樹上的人（跳讀時鏡頭停哪裡） */
export function anchorPerson(route: Route, index: number, maxBack = 80): string | null {
  const here = route.verses[index];
  if (!here) return null;
  const section = here.verse.sec ?? here.segment.id;
  for (let i = index; i >= Math.max(0, index - maxBack); i -= 1) {
    const item = route.verses[i]!;
    if ((item.verse.sec ?? item.segment.id) !== section) break;
    for (let t = item.verse.t.length - 1; t >= 0; t -= 1) {
      const token = item.verse.t[t]!;
      if (token.k === 'p' && token.id) return token.id;
    }
  }
  return null;
}

/** 路線上到某一節為止（不含這一節）已經讀過的歸回連結 */
export function linksReadBefore(route: Route, index: number): Set<number> {
  return new Set(route.linkOrder.slice(0, route.linksBefore[index] ?? 0));
}
