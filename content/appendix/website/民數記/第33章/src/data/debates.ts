import { FHL_STATEMENTS, SITE_VOICES } from './sites';
import type { Fact, Voice } from './types';
import { WHY_DIFFERENT } from './compare';

/** 「清單沒說的事」：經文沒有交代、或各家讀法不同的地方。只列經文原話與各家讀法，不下結論 */
export interface Debate {
  id: string;
  title: string;
  ask: string;
  facts: Fact[];
  voices: Voice[];
  /** 要在卡片裡列出 OpenBible 候選地點的鍵（candidates.json） */
  cands?: string;
  /** 跳到哪一站 */
  go?: number;
}

const MAIN = '04 民數記/第33章.md';
const CT_RAW = 'raw_data/ccbiblestudy_CT_numbers_33.txt';
const REDSEA = 'link_folder/解經爭議/紅海指的是哪個海.md';
const DISPUTE = 'link_folder/解經爭議/民21 與民33 的站名為何不同.md';
const WILD = 'link_folder/主題/曠野四十二站.md';
const KADESH = 'link_folder/地點/加低斯.md';

export const DEBATES: Debate[] = [
  {
    id: 'crossing',
    title: '以色列人過的是哪一片海？',
    ask: '清單說「經過海中」，是在密奪和瑪拉之間。',
    go: 4,
    cands: 'crossing',
    facts: [
      { text: '從比哈希錄對面起行，經過海中，到了書珥曠野', status: 'explicit', refs: ['民33:8'], q: '經過海中到了書珥曠野' },
      { text: '安營在比哈希錄前，密奪和海的中間，對著巴力洗分', status: 'explicit', refs: ['出14:2'], q: '安營在比哈希錄前，密奪和海的中間，對著巴力洗分，靠近海邊安營' },
      { text: '神領百姓繞道，走紅海曠野的路', status: 'explicit', refs: ['出13:18'], q: '走紅海曠野的路' },
      { text: '過海的確切地點，經文沒有寫', status: 'not_stated' },
    ],
    voices: [
      { who: 'GT《啟導本》', says: '原文可直譯「蘆葦海」，古代的「紅海」範圍很大，以色列人所過的當非今天的紅海', quote: '以色列人所過的海當非今天的紅海', file: REDSEA },
      { who: 'GT《啟導本》', says: '過海的確切位置沒有定論', quote: '以色列人過海的確切位置迄無定論', file: REDSEA },
      { who: 'GT《舊約背景註釋》', says: '從巴力洗分的位置推，最近的湖是巴拉湖', quote: '他們若是在此安營，最按近的湖泊就是巴拉湖。', file: 'link_folder/地點/巴力洗分.md' },
      { who: 'GT《舊約背景註釋》', says: '海太淺就淹不死埃及軍，也立不成水牆', quote: '海水要是淺得可以因東風或潮汐變幹，就不足以淹死埃及兵團，或立為水牆。', file: REDSEA },
    ],
  },
  {
    id: 'sinai',
    title: '西乃山在哪裡？',
    ask: '第 12 站是「西乃的曠野」，山在其中；山的位置沒有定論。',
    go: 12,
    cands: 'sinai',
    facts: [
      { text: '出埃及後滿了三個月，來到西乃的曠野，就在那裡的山下安營', status: 'explicit', refs: ['出19:1', '出19:2'], q: '就來到西乃的曠野' },
      { text: '離開耶和華的山，往前行了三天的路程', status: 'explicit', refs: ['民10:33'], q: '離開耶和華的山，往前行了三天的路程' },
      { text: '山的現代位置，經文沒有寫', status: 'not_stated' },
    ],
    voices: SITE_VOICES[12],
  },
  {
    id: 'rithmah',
    title: '利提瑪就是加低斯嗎？',
    ask: '第 15 站利提瑪，和第 33 站加低斯，可能是同一個地方。',
    go: 15,
    cands: 'rithmah',
    facts: [
      { text: '從哈洗錄起行，在巴蘭的曠野安營', status: 'explicit', refs: ['民12:16'], q: '從哈洗錄起行，在巴蘭的曠野安營' },
      { text: '探子回到「巴蘭曠野的加低斯」', status: 'explicit', refs: ['民13:26'], q: '到了巴蘭曠野的加低斯' },
      { text: '清單：從哈洗錄起行，安營在利提瑪', status: 'explicit', refs: ['民33:18'], q: '從哈洗錄起行，安營在利提瑪' },
      { text: '清單：安營在尋的曠野，就是加低斯', status: 'explicit', refs: ['民33:36'], q: '安營在尋的曠野，就是加低斯' },
      { text: '利提瑪與加低斯是不是同一地，經文沒有直接說', status: 'not_stated' },
    ],
    voices: [
      ...SITE_VOICES[15],
      { who: 'GT 丁良才', says: '利提瑪可能是古名，加低斯是後起的名字', quote: '有注釋家以為利提瑪就是以色列人在巴蘭曠野安營的地方（十二16）', file: DISPUTE },
      { who: 'CT', says: '利提瑪與加低斯是同一地方', quote: '利提瑪與加低斯該是同一地方', file: DISPUTE },
    ],
  },
  {
    id: 'wandering',
    title: '三十八年是哪幾站？每站停多久？',
    ask: '民33 沒有把三十八年單獨標出來。',
    go: 16,
    facts: [
      { text: '從離開加低斯巴尼亞到過了撒烈溪，共有三十八年', status: 'explicit', refs: ['申2:14'], q: '共有三十八年' },
      { text: '雲彩停多久，他們就住營多久：兩天、一月、一年都有', status: 'explicit', refs: ['民9:22'], q: '無論是兩天，是一月，是一年，以色列人就住營不起行' },
      { text: '第二次到加低斯是「正月間」，哪一年經文沒有寫', status: 'not_stated', refs: ['民20:1'] },
      { text: '每一站各停了多久，經文沒有寫', status: 'not_stated' },
    ],
    voices: [
      FHL_STATEMENTS.wandering,
      { who: 'FHL〈民圖五〉', says: '每一地約停留兩年左右（這是 FHL 的估算，經文沒有記）', quote: '每地約停留約兩年左右', file: 'appendix/fhl_maps/maps/024.md', plain: true },
      { who: 'CT', says: '從加低斯到加低斯過了三十八年，卻仍在原地踏步', quote: '以色列人從加低斯(參十三26)到加低斯，其間，過了三十八年，不知走了多長的路，結果卻仍在原地踏步。', file: KADESH },
      FHL_STATEMENTS.whyUnknown1,
      FHL_STATEMENTS.whyUnknown2,
      FHL_STATEMENTS.whyUnknown3,
    ],
  },
  {
    id: 'missing',
    title: '清單漏了誰？',
    ask: '這份清單不是完整的旅行日誌。',
    facts: [
      { text: '他備拉：因為耶和華的火燒在他們中間', status: 'explicit', refs: ['民11:3'], q: '那地方便叫做他備拉' },
      { text: '瑪撒、米利巴：因以色列人爭鬧，又試探耶和華', status: 'explicit', refs: ['出17:7'], q: '他給那地方起名叫瑪撒（就是試探的意思），又叫米利巴（就是爭鬧的意思）' },
      { text: '比珥、瑪他拿、拿哈列、巴末：民21 有，民33 沒有', status: 'explicit', refs: ['民21:16', '民21:19'], q: '從拿哈列到巴末' },
    ],
    voices: [
      { who: 'GT《舊約背景註釋》', says: '這份表略去了一些重要的地點，並不完備', quote: '但此表也略去了一些重要的地點（瑪撒、米利巴），表示它也非完備。', file: WILD },
      { who: 'GT《串珠》', says: '另列了他備拉、瑪他拿、拿哈列、巴末幾處沒有記進來', keys: ['他備拉、瑪他拿、拿哈列、巴末'], file: WILD },
    ],
  },
  {
    id: 'names',
    title: '站名為什麼對不上？',
    ask: '同一段路，民21 與民33 的站名不同，申10:6-7 的次序甚至相反。',
    facts: [
      { text: '民33:45-49：以耶亞巴琳、底本迦得、亞門低比拉太音、亞巴琳山、摩押平原', status: 'explicit', refs: ['民33:44', '民33:46'], q: '安營在亞門低比拉太音' },
      { text: '民21:11-20：以耶亞巴琳、撒烈谷、亞嫩河那邊、比珥、瑪他拿、拿哈列、巴末、毘斯迦', status: 'explicit', refs: ['民21:12', '民21:19'], q: '安營在撒烈谷' },
      { text: '經文沒有說明為什麼兩處的站名不同', status: 'not_stated' },
    ],
    voices: WHY_DIFFERENT,
  },
  {
    id: 'silent',
    title: '清單為什麼不寫背叛？',
    ask: '四十二站排得井然有序，三十八年的悖逆一個字也沒有。',
    facts: [
      { text: '摩西遵著耶和華的吩咐記載他們所行的路程', status: 'explicit', refs: ['民33:2'], q: '摩西遵著耶和華的吩咐記載他們所行的路程' },
      { text: '為什麼這樣寫，經文沒有說', status: 'not_stated' },
    ],
    voices: [
      { who: 'KingComments', says: '在這份列表裡，神說的不是背叛，而是前進', keys: ['神說的不是背叛，而是前進'], file: MAIN },
      { who: 'CT', says: '神不題加低斯這個名字，是神的赦免使那裡的失敗沒有留在記錄中', quote: '加低斯是以色列惹神怒氣最嚴重的地方，在那裡開始了四十年的飄流。在行程的記錄裡，神不題加低斯這個名字，這不是說他們沒有到過加低斯，而是神的赦免使加低斯的失敗沒有留下在記錄中。', file: MAIN },
      { who: 'GT《聖經精讀本》', says: '這些地名是犯罪、苦難、掙扎、眼淚和恩典的記錄；同一份清單，讀出的方向相反', keys: ['犯罪、苦難、掙扎、眼淚和恩典的記錄'], file: MAIN },
    ],
  },
  {
    id: 'hor',
    title: '亞倫死在何珥山，還是摩西拉？',
    ask: '民33 說何珥山；申10:6 說摩西拉。',
    go: 34,
    cands: 'hor',
    facts: [
      { text: '祭司亞倫遵著耶和華的吩咐上何珥山，就死在那裡', status: 'explicit', refs: ['民33:38'], q: '祭司亞倫遵著耶和華的吩咐上何珥山，就死在那裡' },
      { text: '亞倫就死在山頂那裡', status: 'explicit', refs: ['民20:28'], q: '亞倫就死在山頂那裡' },
      { text: '到了摩西拉。亞倫死在那裡，就葬在那裡', status: 'explicit', refs: ['申10:6'], q: '到了摩西拉。亞倫死在那裡，就葬在那裡' },
      { text: '兩處是不是同一個地方，經文沒有說', status: 'not_stated' },
    ],
    voices: [
      SITE_VOICES[34][0],
      { who: 'CT', says: '摩西錄（複數）就是單數的摩西拉，亞倫死在那裡', quote: '聖經學者認為摩西錄(複數詞)就是單數詞的摩西拉(參申十6)。亞倫的死亡和埋葬，以及以利亞撒的接任發生在那裡。', file: CT_RAW, plain: true },
    ],
  },
];
