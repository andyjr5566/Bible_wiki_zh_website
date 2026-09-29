import type { Fact, Move, PlaceId, Step, Variant, Voice } from './types';

const f = (text: string, status: Fact['status'], refs: string[] = [], q?: string, note?: string): Fact => ({
  text, status, refs, q, note,
});
const mv = (item: Move['item'], to: PlaceId, how: Move['how'], from?: PlaceId, count?: number): Move => ({
  item, to, how, from, count,
});
const st = (actor: Step['actor'], text: string, at: PlaceId, refs: string[], q?: string, extra: Partial<Step> = {}): Step => ({
  actor, text, at, refs, q, status: 'explicit', ...extra,
});

/* ------------------------------------------------------------ 聖衣 */

export interface Garment {
  id: string;
  name: string;
  /** 利8 穿戴的經節 */
  put: Fact;
  /** 出28 的做法 */
  made: Fact[];
  who: 'aaron' | 'both';
}

export const GARMENTS: Garment[] = [
  {
    id: 'tunic', name: '內袍', who: 'both',
    put: f('第一件：內袍', 'explicit', ['利8:7'], '給亞倫穿上內袍'),
    made: [f('用雜色細麻線織成', 'explicit', ['出28:39'], '要用雜色細麻線織內袍')],
  },
  {
    id: 'sash', name: '腰帶', who: 'both',
    put: f('束上腰帶', 'explicit', ['利8:7'], '束上腰帶'),
    made: [f('用繡花的手工做', 'explicit', ['出28:39'], '又用繡花的手工做腰帶')],
  },
  {
    id: 'robe', name: '外袍', who: 'aaron',
    put: f('穿上外袍', 'explicit', ['利8:7'], '穿上外袍'),
    made: [
      f('顏色全是藍的', 'explicit', ['出28:31'], '顏色全是藍的'),
      f('底邊一個金鈴鐺、一個石榴，交替一圈', 'explicit', ['出28:34'], '一個金鈴鐺一個石榴'),
    ],
  },
  {
    id: 'ephod', name: '以弗得', who: 'aaron',
    put: f('加上以弗得，用巧工織的帶子繫緊', 'explicit', ['利8:7'], '又加上以弗得'),
    made: [
      f('金線和藍色、紫色、朱紅色線，加上撚的細麻', 'explicit', ['出28:6'], '他們要拿金線和藍色、紫色、朱紅色線，並撚的細麻'),
      f('兩肩各一塊紅瑪瑙，刻以色列兒子的名字', 'explicit', ['出28:9'], '要取兩塊紅瑪瑙，在上面刻以色列兒子的名字'),
    ],
  },
  {
    id: 'breastpiece', name: '胸牌', who: 'aaron',
    put: f('戴上胸牌，把烏陵和土明放在胸牌內', 'explicit', ['利8:8'], '把烏陵和土明放在胸牌內'),
    made: [
      f('四行寶石，刻十二個支派的名字', 'explicit', ['出28:17', '出28:21'], '刻十二個支派的名字'),
      f('四方的，長寬各一虎口', 'explicit', ['出28:16'], '長一虎口，寬一虎口'),
    ],
  },
  {
    id: 'turban', name: '冠冕', who: 'aaron',
    put: f('把冠冕戴在頭上', 'explicit', ['利8:9'], '把冠冕戴在他頭上'),
    made: [f('用細麻布做', 'explicit', ['出28:39'], '用細麻布做冠冕')],
  },
  {
    id: 'plate', name: '金牌（聖冠）', who: 'aaron',
    put: f('在冠冕前面釘上金牌，就是聖冠', 'explicit', ['利8:9'], '在冠冕的前面釘上金牌，就是聖冠'),
    made: [f('用精金做，刻著「歸耶和華為聖」', 'explicit', ['出28:36'], '刻著歸耶和華為聖')],
  },
  {
    id: 'cap', name: '裹頭巾', who: 'both',
    put: f('亞倫的兒子：包上裹頭巾', 'explicit', ['利8:13'], '包上裹頭巾'),
    made: [f('為榮耀，為華美', 'explicit', ['出28:40'], '為榮耀，為華美')],
  },
];

export const AARON_ORDER = ['tunic', 'sash', 'robe', 'ephod', 'breastpiece', 'turban', 'plate'];
export const SONS_ORDER = ['tunic', 'sash', 'cap'];

export const GARMENT_FACTS: Fact[] = [
  f('亞倫的兒子只穿三件：內袍、腰帶、裹頭巾。', 'explicit', ['利8:13'], '給他們穿上內袍，束上腰帶，包上裹頭巾'),
  f('穿的次序都是「照耶和華所吩咐摩西的」。', 'explicit', ['利8:9'], '都是照耶和華所吩咐摩西的'),
];

export const GARMENT_VOICES: Voice[] = [
  { who: 'KC', says: '出埃及記 28 章描述聖衣是從外往內講；利未記 8 章是照實際穿戴的次序，從內往外。', ch: 8 },
  { who: 'CT', says: '烏陵和土明可能是兩塊小玉石，被擄時就失蹤了。', ch: 8, quote: '可能是兩塊小玉石' },
  { who: 'GT《串珠聖經註釋》', says: '名字的意思是「光明與完全」。', ch: 8, quote: '希伯來文字義是『光明與完全』。' },
];

/* ------------------------------------------------------------ 抹血三處 */

export interface BodyMark {
  id: 'ear' | 'thumb' | 'toe';
  name: string;
  fact: Fact;
}

export const BODY_MARKS: BodyMark[] = [
  { id: 'ear', name: '右耳垂', fact: f('血抹在右耳垂上', 'explicit', ['利8:23'], '摩西把些血抹在亞倫的右耳垂上') },
  { id: 'thumb', name: '右手大拇指', fact: f('血抹在右手的大拇指上', 'explicit', ['利8:23'], '右手的大拇指上') },
  { id: 'toe', name: '右腳大拇指', fact: f('血抹在右腳的大拇指上', 'explicit', ['利8:23'], '並右腳的大拇指上') },
];

export const BODY_VOICES: Voice[] = [
  { who: 'CT、GT、KC、BH', says: '四家讀法一致：耳朵今後專為聽神的話，手為作神的工，腳為行神的路。', ch: 8 },
  { who: 'GT《啟導本》', says: '說得最直白。', ch: 8, quote: '凡手所作的事，腳所走的路完全遵照神旨不偏離；不沾世務，專心侍奉神。' },
  { who: 'KC', says: '血先抹耳朵：先聽，才知道要做什麼。', ch: 8, quote: '先聽，才知道主要我們作什麼' },
];

/* ------------------------------------------------------------ 承接聖職的三隻祭牲（利8） */

export const ORDINATION: Variant[] = [
  {
    id: 'ord-sin', label: '贖罪祭的公牛', axis: {}, refs: ['利8:14-17'],
    note: '這一章由摩西擔任祭司的工作，因為亞倫和他兒子還沒有承接聖職。',
    steps: [
      st('moses', '摩西牽來贖罪祭的公牛。', 'front', ['利8:14'], '他牽了贖罪祭的公牛來', { moves: [mv('bull', 'front', 'carry', 'gate')] }),
      st('aaron', '亞倫和他兒子按手在公牛頭上。', 'front', ['利8:14'], '亞倫和他兒子按手在贖罪祭公牛的頭上',
        { moves: [mv('hand', 'front', 'place')] }),
      st('unstated', '宰了公牛。', 'front', ['利8:15'], '就宰了公牛'),
      st('moses', '摩西用指頭蘸血，抹在壇上四角的周圍，使壇潔淨。', 'horns', ['利8:15'], '摩西用指頭蘸血，抹在壇上四角的周圍，使壇潔淨',
        { moves: [mv('blood', 'horns', 'daub', 'front')] }),
      st('moses', '把血倒在壇腳，使壇成聖。', 'base', ['利8:15'], '把血倒在壇的腳那裡，使壇成聖', { moves: [mv('blood', 'base', 'pour', 'horns')] }),
      st('moses', '臟上的脂油、肝上的網子、兩個腰子和腰子上的脂油，都燒在壇上。', 'altar', ['利8:16'], '都燒在壇上',
        { moves: [mv('fat', 'altar', 'burn', 'front'), mv('smoke', 'altar', 'burn')] }),
      st('moses', '公牛連皮帶肉並糞，用火燒在營外。', 'outside', ['利8:17'], '用火燒在營外',
        { moves: [mv('meat', 'outside', 'burn', 'front')] }),
    ],
    outcome: {
      animal: f('公牛', 'explicit', ['利8:14']), blood: f('抹在壇的四角，其餘倒在壇腳', 'explicit', ['利8:15']),
      altar: f('脂油、肝上的網子、腰子', 'explicit', ['利8:16']), priest: f('不吃', 'synthesis', ['利8:17']),
      offerer: f('不吃', 'synthesis', ['利8:17']), outside: f('皮、肉、糞燒在營外', 'explicit', ['利8:17']),
      when: f('不吃', 'synthesis', ['利8:17']), where: f('不吃', 'synthesis', ['利8:17']),
    },
  },
  {
    id: 'ord-burnt', label: '燔祭的公綿羊', axis: {}, refs: ['利8:18-21'],
    steps: [
      st('moses', '摩西奉上燔祭的公綿羊。', 'front', ['利8:18'], '他奉上燔祭的公綿羊', { moves: [mv('ram', 'front', 'carry', 'gate')] }),
      st('aaron', '亞倫和他兒子按手在羊頭上。', 'front', ['利8:18'], '亞倫和他兒子按手在羊的頭上', { moves: [mv('hand', 'front', 'place')] }),
      st('moses', '宰了公羊，摩西把血灑在壇的周圍。', 'around', ['利8:19'], '摩西把血灑在壇的周圍',
        { moves: [mv('blood', 'around', 'splash', 'front')] }),
      st('moses', '把羊切成塊子，頭、肉塊和脂油都燒了。', 'altar', ['利8:20'], '把羊切成塊子，把頭和肉塊並脂油都燒了',
        { moves: [mv('meat', 'altar', 'burn', 'front')] }),
      st('moses', '用水洗了臟腑和腿，把全羊燒在壇上，為馨香的燔祭。', 'altar', ['利8:21'], '就把全羊燒在壇上為馨香的燔祭',
        { moves: [mv('smoke', 'altar', 'burn')] }),
    ],
    outcome: {
      animal: f('公綿羊', 'explicit', ['利8:18']), blood: f('灑在壇的周圍', 'explicit', ['利8:19']),
      altar: f('全羊', 'explicit', ['利8:21']), priest: f('不吃', 'synthesis', ['利8:21']),
      offerer: f('不吃', 'synthesis', ['利8:21']), outside: f('沒有', 'synthesis', ['利8:18-21']),
      when: f('不吃', 'synthesis', ['利8:21']), where: f('不吃', 'synthesis', ['利8:21']),
    },
  },
  {
    id: 'ord-ram', label: '承接聖職的羊', axis: {}, refs: ['利8:22-32'],
    note: '「承接聖職」的原文字面是「把手裝滿」——這一步真的把東西放滿了他們的手。',
    steps: [
      st('moses', '奉上第二隻公綿羊，就是承接聖職之禮的羊。', 'front', ['利8:22'], '就是承接聖職之禮的羊',
        { moves: [mv('ram', 'front', 'carry', 'gate')] }),
      st('aaron', '亞倫和他兒子按手在羊頭上，宰了羊。', 'front', ['利8:22-23'], '亞倫和他兒子按手在羊的頭上',
        { moves: [mv('hand', 'front', 'place')] }),
      st('moses', '摩西把血抹在亞倫的右耳垂、右手大拇指、右腳大拇指上。', 'front', ['利8:23'], '摩西把些血抹在亞倫的右耳垂上'),
      st('moses', '亞倫的兒子也一樣；其餘的血灑在壇的周圍。', 'around', ['利8:24'], '又把血灑在壇的周圍',
        { moves: [mv('blood', 'around', 'splash', 'front')] }),
      st('moses', '取脂油、肥尾巴、臟上的脂油、肝上的網子、兩個腰子和脂油，加上右腿；再放上無酵餅、油餅、薄餅各一個。', 'front',
        ['利8:25-26'], '一個無酵餅，一個油餅，一個薄餅'),
      st('moses', '把這一切放在亞倫和他兒子的手上，在耶和華面前搖一搖。', 'front', ['利8:27'], '把這一切放在亞倫的手上和他兒子的手上作搖祭',
        { moves: [mv('fat', 'front', 'wave'), mv('thigh', 'front', 'wave'), mv('bread', 'front', 'wave')] }),
      st('moses', '摩西從他們手上拿下來，燒在壇上的燔祭上。', 'altar', ['利8:28'], '摩西從他們的手上拿下來，燒在壇上的燔祭上',
        { moves: [mv('fat', 'altar', 'burn', 'front'), mv('smoke', 'altar', 'burn')] }),
      st('moses', '羊的胸作搖祭，這一次歸摩西。', 'front', ['利8:29'], '歸摩西的分', { moves: [mv('breast', 'front', 'wave')] }),
      st('moses', '摩西取膏油和壇上的血，彈在亞倫、他兒子和他們的衣服上。', 'front', ['利8:30'], '摩西取點膏油和壇上的血'),
      st('aaron', '肉煮在會幕門口，就在那裡吃，也吃筐子裡的餅。', 'front', ['利8:31'], '把肉煮在會幕門口，在那裡吃',
        { moves: [mv('meat', 'front', 'eat')] }),
      st('aaron', '剩下的肉和餅用火燒掉。', 'altar', ['利8:32'], '剩下的肉和餅，你們要用火焚燒', { later: true }),
    ],
    outcome: {
      animal: f('第二隻公綿羊', 'explicit', ['利8:22']), blood: f('抹在右耳垂、右手與右腳大拇指，其餘灑在壇周圍', 'explicit', ['利8:23-24']),
      altar: f('脂油、肥尾巴、右腿與三樣餅', 'explicit', ['利8:25-28']), priest: f('亞倫和他兒子吃肉和餅', 'explicit', ['利8:31']),
      offerer: f('胸歸摩西', 'explicit', ['利8:29']), outside: f('剩下的肉和餅用火燒掉', 'explicit', ['利8:32']),
      when: f('經文沒有明說期限；剩下的要燒掉', 'synthesis', ['利8:31-32']), where: f('會幕門口', 'explicit', ['利8:31']),
    },
  },
];

/* ------------------------------------------------------------ 七天與第八天 */

export interface TimelineItem {
  id: string;
  day: string;
  title: string;
  fact: Fact;
  who?: 'self' | 'people' | 'all';
}

export const SEVEN_DAYS: TimelineItem[] = [
  { id: 'gather', day: '第一天', title: '招聚會眾', fact: f('全會眾聚集在會幕門口觀禮。', 'explicit', ['利8:4'], '於是會眾聚集在會幕門口') },
  { id: 'wash', day: '第一天', title: '水洗', fact: f('摩西帶亞倫和他兒子來，用水洗了他們。', 'explicit', ['利8:6'], '用水洗了他們') },
  { id: 'dress', day: '第一天', title: '穿聖衣', fact: f('亞倫穿七件，兒子穿三件。', 'explicit', ['利8:7-9', '利8:13'], '給亞倫穿上內袍') },
  { id: 'anoint', day: '第一天', title: '膏抹', fact: f('膏油抹帳幕和一切器具，在壇上彈七次，再倒在亞倫頭上。', 'explicit', ['利8:10-12'],
    '又把膏油倒在亞倫的頭上膏他') },
  { id: 'sacrifice', day: '第一天', title: '三隻祭牲', fact: f('贖罪祭公牛、燔祭公綿羊、承接聖職的羊。', 'explicit', ['利8:14-29'],
    '他又奉上第二隻公綿羊') },
  { id: 'stay', day: '七天', title: '晝夜住在會幕門口', fact: f('七天不可出會幕的門，要晝夜住在會幕門口。', 'explicit', ['利8:33', '利8:35'],
    '七天你們要晝夜住在會幕門口') },
];

export const EIGHTH_DAY: TimelineItem[] = [
  { id: 'call', day: '第八天', title: '摩西召集', who: 'all', fact: f('摩西召了亞倫和他兒子，並以色列的眾長老。', 'explicit', ['利9:1'], '到了第八天') },
  { id: 'self-sin', day: '為自己', title: '贖罪祭：牛犢', who: 'self',
    fact: f('亞倫先為自己宰贖罪祭的牛犢，血抹在壇的四角、倒在壇腳。', 'explicit', ['利9:8-9'], '宰了為自己作贖罪祭的牛犢') },
  { id: 'self-burnt', day: '為自己', title: '燔祭', who: 'self', fact: f('再獻自己的燔祭，血灑在壇的周圍。', 'explicit', ['利9:12'], '亞倫宰了燔祭牲') },
  { id: 'people-sin', day: '為百姓', title: '贖罪祭：公山羊', who: 'people',
    fact: f('把給百姓作贖罪祭的公山羊宰了，和先獻的一樣。', 'explicit', ['利9:15'], '和先獻的一樣') },
  { id: 'people-burnt', day: '為百姓', title: '燔祭', who: 'people', fact: f('照例獻上燔祭。', 'explicit', ['利9:16'], '也奉上燔祭，照例而獻') },
  { id: 'people-grain', day: '為百姓', title: '素祭', who: 'people',
    fact: f('取一滿把素祭燒在壇上，在早晨的燔祭以外。', 'explicit', ['利9:17'], '從其中取一滿把，燒在壇上') },
  { id: 'people-peace', day: '為百姓', title: '平安祭：公牛和公綿羊', who: 'people',
    fact: f('胸和右腿作搖祭。', 'explicit', ['利9:18', '利9:21'], '胸和右腿，亞倫當作搖祭') },
  { id: 'bless', day: '然後', title: '舉手祝福', who: 'all', fact: f('亞倫向百姓舉手祝福，然後下來。', 'explicit', ['利9:22'], '亞倫向百姓舉手，為他們祝福') },
  { id: 'glory', day: '然後', title: '榮光顯現', who: 'all',
    fact: f('摩西、亞倫進入會幕，出來為百姓祝福，耶和華的榮光向眾民顯現。', 'explicit', ['利9:23'], '耶和華的榮光就向眾民顯現') },
  { id: 'fire', day: '高潮', title: '火從耶和華面前出來', who: 'all',
    fact: f('有火從耶和華面前出來，在壇上燒盡燔祭和脂油；眾民歡呼，俯伏在地。', 'explicit', ['利9:24'],
      '有火從耶和華面前出來，在壇上燒盡燔祭和脂油') },
];

export const EIGHTH_DAY_ORDER_VOICES: Voice[] = [
  { who: 'GT《串珠聖經註釋》', says: '次序本身就是道理。', ch: 9,
    quote: '首先是罪的救贖，然後是生命的奉獻和成聖，最後才是在感恩餐中與神交通。' },
  { who: 'CT', says: '獻祭的根本在於順服。', ch: 9, quote: '給我們顯明了獻祭的根本不在於儀式，而在於順服。' },
];

export const PRIESTHOOD_FACTS: Fact[] = [
  f('亞倫先為自己獻，後為百姓獻。', 'explicit', ['利9:7'], '為自己與百姓贖罪'),
  f('眾民一見，就都歡呼，俯伏在地。', 'explicit', ['利9:24'], '眾民一見，就都歡呼，俯伏在地'),
];
