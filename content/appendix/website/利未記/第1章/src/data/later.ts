import type { Fact, Move, PlaceId, Ref, Step, Variant } from './types';

/**
 * 故事線後半：給祭司的條例（利6:8–7:38）、承接聖職（利8）、第八天（利9）、複習。
 * 和 story.ts 一樣，每一句都進資料閘門。
 */

const f = (text: string, status: Fact['status'], refs: Ref[] = [], q?: string): Fact => ({ text, status, refs, q });
const mv = (item: Move['item'], to: PlaceId, how: Move['how'], from?: PlaceId, extra: Partial<Move> = {}): Move => ({ item, to, how, from, ...extra });
const st = (actor: Step['actor'], text: string, at: PlaceId, refs: Ref[], q: string | undefined, extra: Partial<Step> = {}): Step => ({
  actor, text, at, refs, q, status: 'explicit', ...extra,
});

export interface Card { title: string; lines: Fact[] }
export interface Reading { ch: number; from: number; to: number; title: string }

/* ============================================================ 給祭司的條例 */

export const MANUAL = {
  lede: '同樣五種祭再講一遍，這一次是說給亞倫和他的子孫聽：祭司要知道的事。',
  cards: [
    { title: '這一段寫給誰', lines: [
      f('第 1–5 章，是要摩西「曉諭以色列人」；從 6:8 起，改成「吩咐亞倫和他的子孫」。', 'explicit', ['利1:2', '利6:9'], '你要吩咐亞倫和他的子孫說'),
      f('次序也換了：燔祭、素祭、贖罪祭、贖愆祭，平安祭放到最後。', 'synthesis', ['利6:9', '利6:14', '利6:25', '利7:1', '利7:11']),
    ] },
    { title: '壇上的火', lines: [
      f('壇上的火要常常燒著，不可熄滅。', 'explicit', ['利6:13'], '在壇上必有常常燒著的火，不可熄滅'),
      f('祭司每天早晨在上面燒柴，把燔祭擺上去。', 'explicit', ['利6:12'], '祭司要每日早晨在上面燒柴'),
      f('收灰時穿細麻布衣服；把灰拿到營外以前，要換上別的衣服。', 'explicit', ['利6:10-11'], '隨後要脫去這衣服，穿上別的衣服'),
    ] },
    { title: '新加的規定', lines: [
      f('摸這些至聖祭物的，都要成為聖。', 'explicit', ['利6:18'], '摸這些祭物的，都要成為聖'),
      f('牛、綿羊、山羊的脂油不可吃；雀鳥和野獸的血也不可吃。', 'explicit', ['利7:23', '利7:26'], '你們都不可吃'),
      f('平安祭的胸作搖祭、右腿作舉祭，給祭司作永得的分。', 'explicit', ['利7:34'], '作他們從以色列人中所永得的分'),
    ] },
    { title: '收尾的一句話', lines: [
      f('第 7 章最後把這些條例收在一起：燔祭、素祭、贖罪祭、贖愆祭、平安祭，還有承接聖職的禮，都是耶和華在西乃山吩咐摩西的。', 'explicit',
        ['利7:37-38'], '這就是燔祭、素祭、贖罪祭、贖愆祭，和平安祭的條例'),
    ] },
  ] as Card[],
  read: [
    { ch: 6, from: 8, to: 30, title: '利未記 6:8-30：燔祭、素祭、贖罪祭的條例' },
    { ch: 7, from: 1, to: 38, title: '利未記第 7 章：贖愆祭、平安祭的條例，和總結' },
  ] as Reading[],
};

/* ============================================================ 承接聖職 */

export const ORDAIN = {
  lede: '摩西照耶和華的吩咐，為亞倫和他的兒子穿聖衣、膏抹、獻祭；七天不出會幕的門，第八天才開始供職。',
  cards: [
    { title: '誰在做祭司的工作', lines: [
      f('摩西照耶和華所吩咐的行，會眾聚集在會幕門口。', 'explicit', ['利8:4'], '摩西就照耶和華所吩咐的行了'),
      f('這一天由摩西做祭司的工作：抹血、灑血、燒脂油都是摩西；亞倫和他兒子負責按手。', 'synthesis', ['利8:14-28']),
    ] },
    { title: '三隻祭牲', lines: [
      f('贖罪祭的公牛、燔祭的公綿羊，和承接聖職的公綿羊。', 'explicit', ['利8:14', '利8:18', '利8:22'], '就是承接聖職之禮的羊'),
      f('三隻都由亞倫和他兒子按手。', 'explicit', ['利8:14', '利8:18', '利8:22'], '亞倫和他兒子按手在'),
    ] },
    { title: '血抹在哪裡', lines: [
      f('承接聖職的羊，血抹在亞倫和他兒子的右耳垂、右手大拇指、右腳大拇指上。', 'explicit', ['利8:23-24'], '摩西把些血抹在亞倫的右耳垂上'),
    ] },
    { title: '七天', lines: [
      f('七天不可出會幕的門，要晝夜住在會幕門口。', 'explicit', ['利8:33', '利8:35'], '七天你們要晝夜住在會幕門口'),
      f('亞倫和他兒子行了耶和華藉著摩西所吩咐的一切事。', 'explicit', ['利8:36'], '於是亞倫和他兒子行了耶和華藉著摩西所吩咐的一切事'),
    ] },
  ] as Card[],
  read: [{ ch: 8, from: 1, to: 36, title: '利未記第 8 章：承接聖職' }] as Reading[],
};

/* ============================================================ 第八天 */

export const EIGHTH = {
  lede: '亞倫第一次自己在壇前獻祭：先為自己，再為百姓。最後耶和華的榮光向眾民顯現，有火從耶和華面前出來。',
  cards: [
    { title: '先為自己，再為百姓', lines: [
      f('摩西對亞倫說：獻你的贖罪祭和燔祭，為自己與百姓贖罪，又獻上百姓的供物。', 'explicit', ['利9:7'], '為自己與百姓贖罪'),
      f('前面學過的五種祭，這一天用上了四種：贖罪祭、燔祭、素祭、平安祭。', 'synthesis', ['利9:2-4']),
    ] },
    { title: '結局', lines: [
      f('摩西、亞倫進入會幕，又出來為百姓祝福，耶和華的榮光就向眾民顯現。', 'explicit', ['利9:23'], '耶和華的榮光就向眾民顯現'),
      f('有火從耶和華面前出來，在壇上燒盡燔祭和脂油；眾民一見，就都歡呼，俯伏在地。', 'explicit', ['利9:24'], '眾民一見，就都歡呼，俯伏在地'),
    ] },
    { title: '回到開場', lines: [
      f('出埃及記最後，摩西不能進會幕；到第 9 章，摩西和亞倫進入會幕，又出來為百姓祝福。', 'explicit', ['出40:35', '利9:23'], '摩西、亞倫進入會幕'),
    ] },
  ] as Card[],
  read: [{ ch: 9, from: 1, to: 24, title: '利未記第 9 章：第八天' }] as Reading[],
};

const part = (m: Move): Move => ({ ...m, part: true });

/** 第八天的 3D 演練：照利9 的次序，每一種祭只演關鍵動作 */
export const EIGHTH_VARIANT: Variant = {
  id: 'eighth-day',
  label: '第八天',
  axis: {},
  refs: ['利9:1-24'],
  note: '每一種祭只演出關鍵的幾個動作；完整的步驟在前面各幕。',
  steps: [
    st('moses', '到了第八天，摩西召了亞倫和他兒子，並以色列的眾長老；全會眾都近前來，站在耶和華面前。', 'front', ['利9:1', '利9:5'], '到了第八天',
      { act: 'gather' }),
    st('aaron', '亞倫就近壇前，宰了為自己作贖罪祭的牛犢。', 'front', ['利9:8'], '宰了為自己作贖罪祭的牛犢',
      { act: 'slay', moves: [mv('bull', 'front', 'carry', 'gate')] }),
    st('aaron', '兒子把血奉給他，他用指頭蘸血，抹在壇的四角上，又把血倒在壇腳。', 'horns', ['利9:9'], '抹在壇的四角上',
      { moves: [mv('blood', 'horns', 'daub', 'front'), mv('blood', 'base', 'pour', 'horns')] }),
    st('aaron', '脂油、腰子和肝上的網子燒在壇上；肉和皮用火燒在營外。', 'altar', ['利9:10-11'], '又用火將肉和皮燒在營外',
      { moves: [mv('fat', 'altar', 'burn', 'front'), mv('smoke', 'altar', 'burn'), mv('meat', 'outside', 'burn', 'front')] }),
    st('aaron', '再為自己獻燔祭：宰了公綿羊，把血灑在壇的周圍，連頭帶肉塊燒在壇上。', 'around', ['利9:12-13'], '他就灑在壇的周圍',
      { act: 'slay', moves: [mv('ram', 'front', 'carry', 'gate'), mv('blood', 'around', 'splash', 'front'), mv('meat', 'altar', 'burn', 'front')] }),
    st('aaron', '為百姓獻贖罪祭：把公山羊宰了，和先獻的一樣。', 'horns', ['利9:15'], '和先獻的一樣',
      { act: 'slay', moves: [mv('goat', 'front', 'carry', 'gate'), mv('blood', 'horns', 'daub', 'front'), mv('fat', 'altar', 'burn', 'front')] }),
    st('aaron', '也照例獻上百姓的燔祭。', 'around', ['利9:16'], '也奉上燔祭，照例而獻',
      { act: 'slay', moves: [mv('lamb', 'front', 'carry', 'gate'), mv('blood', 'around', 'splash', 'front'), mv('meat', 'altar', 'burn', 'front')] }),
    st('aaron', '又奉上素祭，從其中取一滿把，燒在壇上。', 'altar', ['利9:17'], '從其中取一滿把，燒在壇上',
      { moves: [mv('flour', 'front', 'carry', 'gate'), part(mv('flour', 'altar', 'burn', 'front'))] }),
    st('aaron', '宰了百姓的平安祭公牛和公綿羊，把血灑在壇的周圍。', 'around', ['利9:18'], '亞倫宰了那給百姓作平安祭的公牛和公綿羊',
      { act: 'slay', moves: [mv('bull', 'front', 'carry', 'gate'), mv('blood', 'around', 'splash', 'front')] }),
    st('aaron', '脂油燒在壇上；胸和右腿在耶和華面前搖一搖，作搖祭。', 'front', ['利9:20-21'], '胸和右腿，亞倫當作搖祭',
      { act: 'cut', moves: [mv('breast', 'front', 'wave'), mv('thigh', 'front', 'wave'), mv('fat', 'altar', 'burn', 'front'), mv('smoke', 'altar', 'burn')] }),
    st('aaron', '亞倫向百姓舉手，為他們祝福，然後下來。', 'front', ['利9:22'], '亞倫向百姓舉手，為他們祝福', { act: 'bless' }),
    st('moses', '摩西、亞倫進入會幕，又出來為百姓祝福，耶和華的榮光就向眾民顯現。', 'door', ['利9:23'], '耶和華的榮光就向眾民顯現', { act: 'glory' }),
    st('people', '有火從耶和華面前出來，在壇上燒盡燔祭和脂油；眾民一見，就都歡呼，俯伏在地。', 'altar', ['利9:24'],
      '有火從耶和華面前出來，在壇上燒盡燔祭和脂油', { act: 'godfire' }),
  ],
  outcome: {
    animal: f('為自己：牛犢、公綿羊；為百姓：公山羊、牛犢和綿羊羔、公牛和公綿羊、素祭', 'explicit', ['利9:2-4']),
    blood: f('贖罪祭抹在壇的四角，燔祭和平安祭灑在壇的周圍', 'explicit', ['利9:9', '利9:12', '利9:18']),
    altar: f('脂油、燔祭、一滿把素祭', 'explicit', ['利9:10', '利9:13', '利9:17']),
    priest: f('胸和右腿作搖祭', 'explicit', ['利9:21'], '胸和右腿，亞倫當作搖祭'),
    offerer: f('經文沒提', 'not_stated', ['利9:1-24']),
    outside: f('為自己的贖罪祭，肉和皮燒在營外', 'explicit', ['利9:11'], '又用火將肉和皮燒在營外'),
    when: f('經文沒提', 'not_stated', ['利9:1-24']),
    where: f('經文沒提', 'not_stated', ['利9:1-24']),
  },
};

/* ============================================================ 複習 */

export interface Question { q: string; answers: Fact[]; scenes: string[] }

export const QUESTIONS: Question[] = [
  { q: '哪幾種祭是自願獻的？哪幾種是犯了錯必須獻的？', scenes: ['burnt', 'sin'], answers: [
    f('燔祭、素祭、平安祭是自願的：經文說「若有人獻」。', 'explicit', ['利1:2', '利2:1', '利7:16'], '你們中間若有人獻供物給耶和華'),
    f('贖罪祭、贖愆祭是必須的：誤犯了罪、或虧負了人，就要獻。', 'explicit', ['利4:3', '利6:5'], '就當為他所犯的罪'),
  ] },
  { q: '五種祭裡，哪一種不流血？哪一種的肉，獻祭的人自己也吃得到？', scenes: ['grain', 'peace'], answers: [
    f('不流血的是素祭：細麵、油、乳香。', 'explicit', ['利2:1'], '要用細麵澆上油，加上乳香'),
    f('平安祭的肉，獻祭的人和潔淨的人一起吃。', 'explicit', ['利7:15', '利7:19'], '凡潔淨的人都要吃'),
  ] },
  { q: '燔祭獻上以後，祭司得到什麼？', scenes: ['burnt'], answers: [
    f('只有皮。其餘整隻燒在壇上。', 'explicit', ['利7:8'], '要親自得他所獻那燔祭牲的皮'),
  ] },
  { q: '贖罪祭的血，什麼時候要帶進會幕？', scenes: ['sin'], answers: [
    f('受膏的祭司或全會眾犯了罪：血帶進會幕，對著幔子彈七次；整隻公牛搬到營外燒掉。', 'explicit', ['利4:5-6', '利4:12'], '對著聖所的幔子彈血七次'),
  ] },
  { q: '亞倫和他的兒子是怎樣成為祭司的？', scenes: ['ordination'], answers: [
    f('摩西用水洗他們、給他們穿聖衣、用膏油膏亞倫，再獻三隻祭牲，把血抹在他們的右耳垂、右手和右腳的大拇指上。', 'explicit', ['利8:6-12', '利8:23-24'],
      '摩西把些血抹在亞倫的右耳垂上'),
    f('七天晝夜住在會幕門口。', 'explicit', ['利8:35'], '七天你們要晝夜住在會幕門口'),
  ] },
  { q: '第八天發生了什麼事？', scenes: ['eighth'], answers: [
    f('亞倫先為自己、再為百姓獻祭，然後舉手為百姓祝福。', 'explicit', ['利9:7', '利9:22'], '亞倫向百姓舉手，為他們祝福'),
    f('耶和華的榮光向眾民顯現；有火從耶和華面前出來，燒盡壇上的祭物，眾民歡呼，俯伏在地。', 'explicit', ['利9:23-24'], '眾民一見，就都歡呼，俯伏在地'),
  ] },
];

export function laterFacts(): Fact[] {
  return [
    ...[MANUAL, ORDAIN, EIGHTH].flatMap((x) => x.cards.flatMap((c) => c.lines)),
    ...QUESTIONS.flatMap((q) => q.answers),
    ...Object.values(EIGHTH_VARIANT.outcome),
  ];
}
