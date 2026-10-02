import type { Fact, Voice } from './types';

export type SceneId = 'intro' | 'c11' | 'c12' | 'c13' | 'c14' | 'c15' | 'overview' | 'voices';

export interface Scene {
  id: SceneId;
  short: string;
  range: string;
  color: string;
  ready: boolean;
  /** 還沒做好的幕，先說明會放什麼 */
  plan?: string[];
}

export const SCENES: Scene[] = [
  { id: 'intro', short: '序幕', range: '利10:10', color: 'var(--bronze)', ready: true },
  { id: 'c11', short: '吃什麼', range: '11 章', color: 'var(--c11)', ready: true },
  {
    id: 'c12', short: '生產之後', range: '12 章', color: 'var(--c12)', ready: true,
    plan: ['這一家添了一個孩子：40 天和 80 天的日曆，一天一格', '第 8 天的割禮', '滿日後帶羊羔或兩隻鳥到會幕門口；馬利亞獻鳥（路2:24）'],
  },
  {
    id: 'c13', short: '祭司察看', range: '13 章', color: 'var(--c13)', ready: true,
    plan: ['父親身上起了一塊斑：一步一步的察看流程，關鎖七天、再看', '確診後的四個哀悼動作，和利10:6 並排', '衣服上的災病：洗、撕、燒'],
  },
  {
    id: 'c14', short: '回到營裡', range: '14 章', color: 'var(--c14)', ready: true,
    plan: ['3D：祭司出營、兩隻鳥、洗剃、帳棚外七天、第八天在會幕門口', '和利8 承接聖職的抹血並排', '多年後在迦南：房屋的災病'],
  },
  {
    id: 'c15', short: '身體的漏症', range: '15 章', color: 'var(--c15)', ready: true,
    plan: ['3D：母親的血一直沒有止住，家裡的座位和墊子成了不潔淨，碰到的人到晚上才潔淨', '家裡的東西：床、座位、鞍子、瓦器、木器，碰到會怎樣', '男人、女人各兩種情況，痊癒後的第八天', '血漏婦人摸主衣繸（太9:20-22）'],
  },
  {
    id: 'overview', short: '總覽', range: '11–15 章', color: 'var(--bronze)', ready: true,
    plan: ['所有情況排在同一條時間軸：到晚上、七天、四十／八十天、直到痊癒', '哪些要獻祭、獻什麼', '利10:10 → 11–15 → 16 章贖罪日'],
  },
  {
    id: 'voices', short: '各家怎麼讀', range: '附錄', color: 'var(--ev-interp)', ready: true,
    plan: ['為什麼是這些動物：五種說法', '生女孩為什麼加倍、大痲瘋是什麼病、不潔是不是罪', '兩隻鳥算不算祭、漏症要不要出營'],
  },
];

export const SCENE_BY_ID = Object.fromEntries(SCENES.map((s) => [s.id, s])) as Record<SceneId, Scene>;

export function neighbors(id: SceneId) {
  const i = SCENES.findIndex((s) => s.id === id);
  return { prev: SCENES[i - 1], next: SCENES[i + 1] };
}

/* ------------------------------------------------------------ 序幕 */

export const EPIGRAPH: Fact = {
  text: '使你們可以將聖的、俗的，潔淨的、不潔淨的，分別出來',
  status: 'explicit',
  refs: ['利10:10'],
  q: '使你們可以將聖的、俗的，潔淨的、不潔淨的，分別出來',
};

/** 一家人（虛構） */
export const CAST = [
  { id: 'father', name: '父親', note: '13–14 章，他身上起了一塊斑' },
  { id: 'mother', name: '母親', note: '11 章在帳棚前煮飯；12 章生了一個孩子；15 章血一直沒有止住' },
  { id: 'daughter', name: '女兒', note: '問了很多「為什麼」' },
] as const;

/** 能走多近：從會幕往外一圈一圈 */
/** 能走多近：這一區要說的一句話 */
export const NEAR_POINT: Fact = {
  text: '會幕是神住的地方。不潔淨的人不能接近聖物和聖所；越嚴重，被隔得越遠，最重的要住到營外。得潔淨以後，再一步一步走回來，最後在會幕門口獻祭',
  status: 'synthesis',
  refs: ['民5:3', '利7:20', '利12:4', '利13:46', '利14:3-11', '利15:31'],
};

/** 不潔淨的時候：被擋在哪裡（由輕到重） */
export const BLOCKED: { label: string; fact: Fact }[] = [
  { label: '到晚上、七天', fact: { text: '不可吃獻給耶和華的平安祭肉', status: 'explicit', refs: ['利7:20'], q: '人若不潔淨而吃了，這人必從民中剪除' } },
  { label: '生產後', fact: { text: '不可摸聖物，也不可進聖所', status: 'explicit', refs: ['利12:4'], q: '不可摸聖物，也不可進入聖所' } },
  { label: '大痲瘋', fact: { text: '連營都不能住，要獨居營外', status: 'explicit', refs: ['利13:46'], q: '就要獨居營外' } },
];

/** 得潔淨的時候：怎麼走回來（以第 14 章長大痲瘋的人為例），編號對應圖上的路線 */
export const RETURN: { label: string; fact: Fact }[] = [
  { label: '營外', fact: { text: '祭司出到營外去察看他', status: 'explicit', refs: ['利14:3'], q: '祭司要出到營外察看' } },
  { label: '進營', fact: { text: '洗衣、剃毛、洗澡以後，可以進營', status: 'explicit', refs: ['利14:8'], q: '然後可以進營' } },
  { label: '自己的帳棚外', fact: { text: '還不能回家，要在自己的帳棚外住七天', status: 'explicit', refs: ['利14:8'], q: '只是要在自己的帳棚外居住七天' } },
  { label: '會幕門口', fact: { text: '第八天，帶著祭物站在會幕門口、耶和華面前', status: 'explicit', refs: ['利14:10-11'], q: '安置在會幕門口、耶和華面前' } },
  { label: '潔淨了', fact: { text: '祭司獻完祭，他就潔淨了', status: 'explicit', refs: ['利14:20'], q: '他就潔淨了' } },
];

export const NEAR_VOICE: Voice = { who: 'GT《串珠聖經註釋》', says: '營外是什麼地方', quote: '營外的地方是遠離神的地方，也是罪人及不潔淨的人被放逐之處', ch: 13 };

/** 不潔淨有多久 */
export const LENGTHS: { label: string; fact: Fact }[] = [
  { label: '到晚上', fact: { text: '摸了死的爬物、夢遺、夫妻同房', status: 'explicit', refs: ['利11:31', '利15:16', '利15:18'], q: '必不潔淨到晚上' } },
  { label: '七天', fact: { text: '女人行經', status: 'explicit', refs: ['利15:19'], q: '必污穢七天' } },
  { label: '四十天／八十天', fact: { text: '生男孩七加三十三天，生女孩十四加六十六天', status: 'synthesis', refs: ['利12:2-5'] } },
  { label: '病在身上的日子', fact: { text: '大痲瘋：災病在他身上的日子', status: 'explicit', refs: ['利13:46'], q: '災病在他身上的日子，他便是不潔淨' } },
];

/** 五章各講什麼 */
export const ROADMAP: { scene: SceneId; title: string; fact: Fact }[] = [
  { scene: 'c11', title: '吃什麼、碰到死的', fact: { text: '動物', status: 'explicit', refs: ['利11:46-47'], q: '這是走獸、飛鳥，和水中游動的活物，並地上爬物的條例' } },
  { scene: 'c12', title: '生產之後', fact: { text: '產婦', status: 'explicit', refs: ['利12:7'], q: '這條例是為生育的婦人' } },
  { scene: 'c13', title: '皮膚和衣服上的災病', fact: { text: '祭司察看', status: 'explicit', refs: ['利13:2-3'], q: '祭司要察看肉皮上的災病' } },
  { scene: 'c14', title: '回到營裡；房屋', fact: { text: '得潔淨的條例', status: 'explicit', refs: ['利14:2'], q: '長大痲瘋得潔淨的日子，其例乃是這樣' } },
  { scene: 'c15', title: '身體流出來的', fact: { text: '漏症', status: 'explicit', refs: ['利15:2'], q: '人若身患漏症，他因這漏症就不潔淨了' } },
];

export const REASON: Fact = {
  text: '這些條例為什麼要緊：不潔淨的人若接近帳幕，會玷污它',
  status: 'explicit',
  refs: ['利15:31'],
  q: '你們要這樣使以色列人與他們的污穢隔絕，免得他們玷污我的帳幕，就因自己的污穢死亡',
};

export const CLOUD: Fact = {
  text: '會幕上方：日間有雲彩，夜間雲中有火',
  status: 'explicit',
  refs: ['出40:38'],
  q: '日間，耶和華的雲彩是在帳幕以上；夜間，雲中有火',
};

export function storyFacts(): Fact[] {
  return [EPIGRAPH, NEAR_POINT, ...BLOCKED.map((r) => r.fact), ...RETURN.map((r) => r.fact), ...LENGTHS.map((l) => l.fact), ...ROADMAP.map((r) => r.fact), REASON, CLOUD];
}
