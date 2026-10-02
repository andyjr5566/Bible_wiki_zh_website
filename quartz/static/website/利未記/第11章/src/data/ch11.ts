import type { Fact, Voice } from './types';

/**
 * 利未記 11 章：什麼可以吃、碰到死的怎麼辦。
 * 原文欄位（he／tr／gloss／lex／strong）取自本庫 raw_data/stepbible_leviticus_11.txt
 * （STEP Bible／STEPBible-Data，CC BY 4.0）。gloss 是 STEP 的本節譯義，lex 是簡要辭典義，
 * 兩者都只是可能義域，網站不據此判定是哪一種動物。
 */

export type Verdict = 'clean' | 'unclean' | 'detest';

export const VERDICT_LABEL: Record<Verdict, string> = {
  clean: '可以吃',
  unclean: '不潔淨',
  detest: '可憎，不可吃',
};

/* ------------------------------------------------------------ 走獸：兩個條件 */

export interface LandAnimal {
  id: string;
  name: string;
  /** PhyloPic 剪影 id（沒有就用圖示） */
  sil?: string;
  hoof: boolean;
  cud: boolean;
  verdict: Verdict;
  fact: Fact;
}

export const LAND_RULE: Fact = {
  text: '走獸要同時「蹄分兩瓣」又「倒嚼」才可以吃',
  status: 'explicit',
  refs: ['利11:3'],
  q: '凡蹄分兩瓣、倒嚼的走獸，你們都可以吃',
};

export const LAND: LandAnimal[] = [
  {
    id: 'cattle', name: '牛', sil: 'cattle', hoof: true, cud: true, verdict: 'clean',
    fact: { text: '申命記重述同一套條例時，點名牛、綿羊、山羊是可吃的牲畜', status: 'explicit', refs: ['申14:4'], q: '可吃的牲畜就是牛、綿羊、山羊' },
  },
  {
    id: 'sheep', name: '綿羊', sil: 'sheep', hoof: true, cud: true, verdict: 'clean',
    fact: { text: '申命記重述同一套條例時，點名牛、綿羊、山羊是可吃的牲畜', status: 'explicit', refs: ['申14:4'], q: '可吃的牲畜就是牛、綿羊、山羊' },
  },
  {
    id: 'goat', name: '山羊', sil: 'goat', hoof: true, cud: true, verdict: 'clean',
    fact: { text: '申命記重述同一套條例時，點名牛、綿羊、山羊是可吃的牲畜', status: 'explicit', refs: ['申14:4'], q: '可吃的牲畜就是牛、綿羊、山羊' },
  },
  {
    id: 'camel', name: '駱駝', sil: 'camel', hoof: false, cud: true, verdict: 'unclean',
    fact: { text: '駱駝倒嚼，卻不分蹄', status: 'explicit', refs: ['利11:4'], q: '因為倒嚼不分蹄' },
  },
  {
    id: 'hyrax', name: '沙番', sil: 'hyrax', hoof: false, cud: true, verdict: 'unclean',
    fact: { text: '沙番倒嚼，卻不分蹄', status: 'explicit', refs: ['利11:5'], q: '因為倒嚼不分蹄' },
  },
  {
    id: 'hare', name: '兔子', sil: 'hare', hoof: false, cud: true, verdict: 'unclean',
    fact: { text: '兔子倒嚼，卻不分蹄', status: 'explicit', refs: ['利11:6'], q: '因為倒嚼不分蹄' },
  },
  {
    id: 'pig', name: '豬', sil: 'pig', hoof: true, cud: false, verdict: 'unclean',
    fact: { text: '豬分蹄，卻不倒嚼', status: 'explicit', refs: ['利11:7'], q: '蹄分兩瓣，卻不倒嚼' },
  },
];

export const LAND_EXTRA: Fact[] = [
  { text: '利未記 11 章沒有點名任何一種可吃的走獸，只給判準；點名的四種都是例外', status: 'synthesis', refs: ['利11:2-7'] },
  { text: '用掌行走的四足走獸也不潔淨', status: 'explicit', refs: ['利11:27'], q: '凡四足的走獸，用掌行走的，是與你們不潔淨' },
  { text: '這些不潔淨走獸的肉不可吃，死的也不可摸', status: 'explicit', refs: ['利11:8'], q: '這些獸的肉，你們不可吃；死的，你們不可摸' },
];

/* ------------------------------------------------------------ 水族 */

export const WATER_RULE: Fact = {
  text: '水裡的活物，有翅（鰭）有鱗的才可以吃',
  status: 'explicit',
  refs: ['利11:9'],
  q: '有翅有鱗的，都可以吃',
};
export const WATER_NO: Fact = {
  text: '沒有翅、沒有鱗的，當以為可憎',
  status: 'explicit',
  refs: ['利11:10'],
  q: '無翅無鱗的，你們都當以為可憎',
};
export const WATER_NAMES: Fact = { text: '水族一種也沒有點名，只有判準', status: 'synthesis', refs: ['利11:9-12'] };

/* ------------------------------------------------------------ 飛鳥：只有名單 */

export interface NamedCreature {
  zh: string;
  ref: string;
  he: string;
  tr: string;
  gloss: string;
  lex: string;
  strong: string;
}

export const BIRD_RULE: Fact = {
  text: '飛鳥沒有判準，經文直接列出二十種不可吃的',
  status: 'synthesis',
  refs: ['利11:13-19'],
};

/** 和合本的名稱照原文次序一一對應（v13–19） */
export const BIRDS: NamedCreature[] = [
  { zh: '鵰', ref: '利11:13', he: 'נֶשֶׁר', tr: 'ne.sher', gloss: 'eagle', lex: 'eagle', strong: 'H5404' },
  { zh: '狗頭鵰', ref: '利11:13', he: 'פֶּרֶס', tr: 'pe.res', gloss: 'bearded vulture', lex: 'vulture', strong: 'H6538' },
  { zh: '紅頭鵰', ref: '利11:13', he: 'עָזְנִיָּה', tr: "'a.ze.ni.yah", gloss: 'osprey', lex: 'vulture', strong: 'H5822' },
  { zh: '鷂鷹', ref: '利11:14', he: 'דָּאָה', tr: "da.'ah", gloss: 'black kite', lex: 'kite', strong: 'H1676' },
  { zh: '小鷹', ref: '利11:14', he: 'אַיָּה', tr: "'ai.yah", gloss: 'hawk', lex: 'falcon', strong: 'H344' },
  { zh: '烏鴉', ref: '利11:15', he: 'עֹרֵב', tr: "'o.rev", gloss: 'raven', lex: 'raven', strong: 'H6158' },
  { zh: '鴕鳥', ref: '利11:16', he: 'בַּת הַיַּעֲנָה', tr: "bat ha.ya.'a.nah", gloss: '[the] daughter of the ostrich', lex: 'ostrich', strong: 'H3284' },
  { zh: '夜鷹', ref: '利11:16', he: 'תַּחְמָס', tr: 'tach.mas', gloss: 'screech owl', lex: 'ostrich', strong: 'H8464' },
  { zh: '魚鷹', ref: '利11:16', he: 'שַׁחַף', tr: 'sha.chaf', gloss: 'gull', lex: 'gull', strong: 'H7828' },
  { zh: '鷹', ref: '利11:16', he: 'נֵץ', tr: 'netz', gloss: 'falcon', lex: 'hawk', strong: 'H5322B' },
  { zh: '鴞鳥', ref: '利11:17', he: 'כּוֹס', tr: 'kos', gloss: 'little owl', lex: 'owl', strong: 'H3563B' },
  { zh: '鸕鶿', ref: '利11:17', he: 'שָׁלָךְ', tr: 'sha.lakh', gloss: 'cormorant', lex: 'cormorant', strong: 'H7994' },
  { zh: '貓頭鷹', ref: '利11:17', he: 'יַנְשׁוּף', tr: 'yan.shuf', gloss: 'great owl', lex: 'owl', strong: 'H3244' },
  { zh: '角鴟', ref: '利11:18', he: 'תִּנְשֶׁמֶת', tr: 'tin.she.met', gloss: 'barn owl', lex: 'chameleon', strong: 'H8580' },
  { zh: '鵜鶘', ref: '利11:18', he: 'קָאָת', tr: "ka.'at", gloss: 'desert owl', lex: 'pelican', strong: 'H6893' },
  { zh: '禿鵰', ref: '利11:18', he: 'רָחָם', tr: 'ra.cham', gloss: 'Egyptian vulture', lex: 'carrion', strong: 'H7360' },
  { zh: '鸛', ref: '利11:19', he: 'חֲסִידָה', tr: 'cha.si.dah', gloss: 'stork', lex: 'stork', strong: 'H2624' },
  { zh: '鷺鷥', ref: '利11:19', he: 'אֲנָפָה', tr: "'a.na.fah", gloss: 'heron', lex: 'heron', strong: 'H601' },
  { zh: '戴鵀', ref: '利11:19', he: 'דּוּכִיפַת', tr: 'du.khi.fat', gloss: 'hoopoe', lex: 'hoopoe', strong: 'H1744' },
  { zh: '蝙蝠', ref: '利11:19', he: 'עֲטַלֵּף', tr: "'a.ta.lef", gloss: 'bat', lex: 'bat', strong: 'H5847' },
];

/* ------------------------------------------------------------ 有翅膀的爬物（昆蟲） */

export const INSECT_RULE: Fact = {
  text: '有翅膀、用四足爬行的，一律可憎',
  status: 'explicit',
  refs: ['利11:20'],
  q: '凡有翅膀用四足爬行的物，你們都當以為可憎',
};
export const INSECT_EXCEPT: Fact = {
  text: '例外：有足有腿、在地上蹦跳的，可以吃',
  status: 'explicit',
  refs: ['利11:21'],
  q: '有足有腿，在地上蹦跳的，你們還可以吃',
};
export const INSECTS: NamedCreature[] = [
  { zh: '蝗蟲', ref: '利11:22', he: 'אַרְבֶּה', tr: "'ar.beh", gloss: 'locust', lex: 'locust', strong: 'H697' },
  { zh: '螞蚱', ref: '利11:22', he: 'סָלְעָם', tr: "sal.'am", gloss: 'locust', lex: 'locust', strong: 'H5556' },
  { zh: '蟋蟀', ref: '利11:22', he: 'חַרְגֹּל', tr: 'char.gol', gloss: 'locust', lex: 'locust', strong: 'H2728' },
  { zh: '蚱蜢', ref: '利11:22', he: 'חָגָב', tr: 'cha.gav', gloss: 'grasshopper', lex: 'locust', strong: 'H2284' },
];

/* ------------------------------------------------------------ 地上的爬物 */

export const CREEP_RULE: Fact = {
  text: '地上一切爬物都是可憎的，不可吃',
  status: 'explicit',
  refs: ['利11:41-42'],
  q: '凡用肚子行走的和用四足行走的，或是有許多足的，就是一切爬在地上的，你們都不可吃',
};
export const CREEP_EIGHT: Fact = {
  text: '其中八種，死了以後碰到會使人不潔淨',
  status: 'explicit',
  refs: ['利11:29-31'],
  q: '這些爬物都是與你們不潔淨的',
};
export const CREEPERS: NamedCreature[] = [
  { zh: '鼬鼠', ref: '利11:29', he: 'חֹלֶד', tr: 'cho.led', gloss: 'weasel', lex: 'weasel', strong: 'H2467' },
  { zh: '鼫鼠', ref: '利11:29', he: 'עַכְבָּר', tr: "'akh.bar", gloss: 'mouse', lex: 'mouse', strong: 'H5909' },
  { zh: '蜥蜴', ref: '利11:29', he: 'צָב', tr: 'tzav', gloss: 'great lizard', lex: 'lizard', strong: 'H6632B' },
  { zh: '壁虎', ref: '利11:30', he: 'אֲנָקָה', tr: "'a.na.kah", gloss: 'gecko', lex: 'gecko', strong: 'H604' },
  { zh: '龍子', ref: '利11:30', he: 'כֹּחַ', tr: 'ko.ach', gloss: 'monitor lizard', lex: 'reptile', strong: 'H3581A' },
  { zh: '守宮', ref: '利11:30', he: 'לְטָאָה', tr: "le.ta.'ah", gloss: 'wall lizard', lex: 'lizard', strong: 'H3911' },
  { zh: '蛇醫', ref: '利11:30', he: 'חֹמֶט', tr: 'cho.met', gloss: 'skink', lex: 'lizard', strong: 'H2546' },
  { zh: '蝘蜓', ref: '利11:30', he: 'תִּנְשֶׁמֶת', tr: 'tin.sha.met', gloss: 'chameleon', lex: 'chameleon', strong: 'H8580' },
];

/** 給研經的人：和合本與 STEP 本節譯義不一致、或同一個字出現兩次的地方 */
export const NAME_NOTES: Fact[] = [
  {
    text: '「角鴟」（v18，列在飛鳥裡）和「蝘蜓」（v30，列在爬物裡）在原文是同一個字 תִּנְשֶׁמֶת（H8580）；STEP 在 v18 譯作 barn owl，在 v30 譯作 chameleon',
    status: 'explicit',
    refs: ['利11:18', '利11:30'],
  },
  {
    text: '和合本與 STEP 的譯名不一定對得上：例如「魚鷹」STEP 作 gull，「鵜鶘」STEP 作 desert owl（簡要辭典作 pelican）。網站並列兩邊，不判斷哪一個是對的',
    status: 'synthesis',
    refs: ['利11:16', '利11:18'],
  },
];

/* ------------------------------------------------------------ 死了掉進來怎麼辦 */

export interface KitchenThing {
  id: string;
  name: string;
  icon: string;
  /** 結果：打破、放水中到晚上、仍潔淨、不潔淨 */
  result: 'break' | 'water' | 'clean' | 'unclean' | 'evening';
  label: string;
  fact: Fact;
}

export const KITCHEN: KitchenThing[] = [
  {
    id: 'clay', name: '瓦罐', icon: 'jar', result: 'break', label: '打破，裡面的東西也不潔淨',
    fact: { text: '死的掉在瓦器裡，裡面的東西都不潔淨，瓦器要打破', status: 'explicit', refs: ['利11:33'], q: '你們要把這瓦器打破了' },
  },
  {
    id: 'wood', name: '木碗', icon: 'bowl', result: 'water', label: '放在水中，到晚上才潔淨',
    fact: { text: '木器、衣服、皮子、口袋都一樣：放在水中，到晚上', status: 'explicit', refs: ['利11:32'], q: '須要放在水中，必不潔淨到晚上，到晚上才潔淨了' },
  },
  {
    id: 'cloth', name: '衣服', icon: 'linen', result: 'water', label: '放在水中，到晚上才潔淨',
    fact: { text: '木器、衣服、皮子、口袋都一樣：放在水中，到晚上', status: 'explicit', refs: ['利11:32'], q: '無論是木器、衣服、皮子、口袋' },
  },
  {
    id: 'oven', name: '爐子、鍋臺', icon: 'oven', result: 'break', label: '打碎',
    fact: { text: '爐子、鍋臺要打碎', status: 'explicit', refs: ['利11:35'], q: '不拘是爐子，是鍋臺，就要打碎' },
  },
  {
    id: 'food', name: '沾過水的食物', icon: 'bread', result: 'unclean', label: '不潔淨',
    fact: { text: '可吃的食物沾過水的，就不潔淨；器皿裡可喝的也不潔淨', status: 'explicit', refs: ['利11:34'], q: '其中一切可吃的食物，沾水的就不潔淨' },
  },
  {
    id: 'spring', name: '泉源、水池', icon: 'spring', result: 'clean', label: '仍是潔淨',
    fact: { text: '泉源和聚水的池子仍是潔淨', status: 'explicit', refs: ['利11:36'], q: '但是泉源或是聚水的池子仍是潔淨' },
  },
  {
    id: 'seed', name: '乾的種子', icon: 'grain', result: 'clean', label: '仍是潔淨',
    fact: { text: '掉在要種的子粒上，子粒仍是潔淨', status: 'explicit', refs: ['利11:37'], q: '子粒仍是潔淨' },
  },
  {
    id: 'wetseed', name: '澆過水的種子', icon: 'sprout', result: 'unclean', label: '不潔淨',
    fact: { text: '若子粒已經澆過水，就不潔淨', status: 'explicit', refs: ['利11:38'], q: '若水已經澆在子粒上，那死的有一點掉在上頭，這子粒就與你們不潔淨' },
  },
  {
    id: 'hand', name: '人的手', icon: 'hand', result: 'evening', label: '不潔淨到晚上',
    fact: { text: '摸了死的爬物，不潔淨到晚上', status: 'explicit', refs: ['利11:31'], q: '凡摸了的，必不潔淨到晚上' },
  },
];

/* ------------------------------------------------------------ 摸、拿、吃 */

export interface Contact {
  verb: string;
  what: string;
  evening: boolean;
  wash: boolean;
  fact: Fact;
}

export const CONTACT: Contact[] = [
  { verb: '摸', what: '不潔淨動物的屍體', evening: true, wash: false, fact: { text: '摸了死的，不潔淨到晚上', status: 'explicit', refs: ['利11:24'], q: '凡摸了死的，必不潔淨到晚上' } },
  { verb: '拿', what: '不潔淨動物的屍體', evening: true, wash: true, fact: { text: '拿了死的，還要洗衣服', status: 'explicit', refs: ['利11:25'], q: '凡拿了死的，必不潔淨到晚上，並要洗衣服' } },
  { verb: '摸', what: '可吃的走獸，自己死了的', evening: true, wash: false, fact: { text: '可吃的走獸若是死了，摸了也不潔淨到晚上', status: 'explicit', refs: ['利11:39'], q: '你們可吃的走獸若是死了，有人摸他，必不潔淨到晚上' } },
  { verb: '吃', what: '可吃的走獸，自己死了的', evening: true, wash: true, fact: { text: '吃了，不潔淨到晚上，並要洗衣服', status: 'explicit', refs: ['利11:40'], q: '有人吃那死了的走獸，必不潔淨到晚上，並要洗衣服' } },
  { verb: '拿', what: '可吃的走獸，自己死了的', evening: true, wash: true, fact: { text: '拿了，不潔淨到晚上，並要洗衣服', status: 'explicit', refs: ['利11:40'], q: '拿了死走獸的，必不潔淨到晚上，並要洗衣服' } },
];

/* ------------------------------------------------------------ 理由 */

export const WHY: Fact = {
  text: '全章的理由寫在最後：因為神是聖潔的',
  status: 'explicit',
  refs: ['利11:44-45'],
  q: '所以你們要成為聖潔，因為我是聖潔的',
};
export const SEPARATE: Fact = {
  text: '這份條例的用處：把潔淨的和不潔淨的分別出來',
  status: 'explicit',
  refs: ['利11:47'],
  q: '要把潔淨的和不潔淨的，可吃的與不可吃的活物，都分別出來',
};
export const LINK_10_10: Fact = {
  text: '前一章才吩咐祭司要會分別潔淨的、不潔淨的',
  status: 'explicit',
  refs: ['利10:10'],
  q: '潔淨的、不潔淨的，分別出來',
};

/** 給研經的人：原文層 */
export const HEBREW_11: Fact[] = [
  {
    text: '利10:10 吩咐祭司「分別出來」的動詞是 בָּדַל（H914），v47「都分別出來」用的是同一個字',
    status: 'explicit',
    refs: ['利10:10', '利11:47'],
  },
  {
    text: '走獸段說「不潔淨」用 טָמֵא（H2931）；水族、飛鳥、爬物段另用 שֶׁקֶץ（H8263，「可憎」）。同一章裡兩個不同的字',
    status: 'explicit',
    refs: ['利11:4-8', '利11:10-13', '利11:41'],
  },
  {
    text: 'v43「使自己不潔淨」和 v44「你們要成為聖潔」在原文都是反身的 Hithpael 字形：一個是不要把自己弄髒，一個是要把自己分別出來',
    status: 'explicit',
    refs: ['利11:43-44'],
  },
  {
    text: 'v3 的「蹄分兩瓣」原文疊了兩組詞（פָּרַס＋פַּרְסָה「分開的蹄」、שָׁסַע＋שֶׁסַע「裂成兩瓣」）；「倒嚼」是「把反芻物帶上來」',
    status: 'explicit',
    refs: ['利11:3'],
  },
];

/* ------------------------------------------------------------ 註釋家 */

export const VOICES_11: Record<string, Voice> = {
  pair: { who: 'CT', says: '兩個條件缺一不可', quote: '分蹄和倒嚼二者必須相輔——豬分瓣，卻不倒嚼，所以不算潔淨。', ch: 11 },
  sight: { who: 'GT 丁良才', says: '這是給一般百姓看得懂的分法，不是生物學分類', quote: '神的律例是為眾百姓設立的，因此本章所記的動物不是按科學的考察分類，乃是按眾目所見的規定，使人容易遵行', ch: 11 },
  carry: { who: 'GT 丁良才', says: '拿比摸多一道手續的理由', quote: '凡拿了死的，不但不潔到晚上，還要洗衣服，因為他所染的不潔，比摸著死的更甚。', ch: 11 },
  clay: { who: 'GT 丁良才', says: '瓦器要打破，是因為它會吸', quote: '這是因為瓦器是能滲透的', ch: 11 },
  spring: { who: 'GT 丁良才', says: '水池為什麼仍算潔淨', quote: '池子裡的水，既是很多的，死物的污毒自然也是最稀薄的……因此池子裡的水不必全然棄了', ch: 11 },
  springGrace: { who: 'GT《聖經精讀本》', says: '若連水源都算不潔，會帶來飲水困難', quote: '就會帶來飲水困難', ch: 11 },
  evening: { who: 'GT《啟導本》', says: '「到晚上」就是新的一天開始', quote: '也就是第二天開始時（希伯來人的一天從頭天晚間算起）', ch: 11 },
  birds: { who: 'GT 丁良才', says: '飛鳥沒有記號，只有名單', quote: '這幾節中沒有提及什麼指定的記號，使人能知道何等算為潔淨，何等算為不潔淨', ch: 11 },
  holy: { who: 'GT《聖經精讀本》', says: '聖潔的原意是分離', quote: '『聖潔』原意『分離』。從所有罪和不潔中分離的狀態就是聖潔。', ch: 11 },
  locust: { who: 'GT《啟導本》', says: '近東居民一向以蝗蟲為食', quote: '沙漠中的貧戶，把蝗蟲與蜂蜜同食，攝取身體所需養料', ch: 11 },
  hyrax: { who: 'GT《啟導本》', says: '沙番這個名字是音譯', quote: '從希伯來文shaphan音譯過來', ch: 11 },
};

/* ------------------------------------------------------------ 新約 */

export const NT_11: Fact = {
  text: '馬可福音記耶穌說，從外面進去的不能污穢人；經文接著說：各樣的食物都是潔淨的',
  status: 'explicit',
  refs: ['可7:15', '可7:18-19'],
  q: '各樣的食物都是潔淨的',
};

export function ch11Facts(): Fact[] {
  return [
    LAND_RULE, ...LAND.map((a) => a.fact), ...LAND_EXTRA,
    WATER_RULE, WATER_NO, WATER_NAMES,
    BIRD_RULE, INSECT_RULE, INSECT_EXCEPT, CREEP_RULE, CREEP_EIGHT, ...NAME_NOTES,
    ...KITCHEN.map((k) => k.fact), ...CONTACT.map((c) => c.fact),
    WHY, SEPARATE, LINK_10_10, ...HEBREW_11, NT_11,
    ...[...BIRDS, ...INSECTS, ...CREEPERS].map((c) => ({ text: c.zh, status: 'explicit' as const, refs: [c.ref], q: c.zh })),
  ];
}

export function ch11Voices(): Voice[] {
  return Object.values(VOICES_11);
}
