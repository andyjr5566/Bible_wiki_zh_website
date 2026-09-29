import type { Fact, Voice } from './types';

export interface Debate {
  id: string;
  question: string;
  stop: string;
  text: Fact;
  voices: Voice[];
}

const f = (text: string, status: Fact['status'], refs: string[] = [], q?: string): Fact => ({ text, status, refs, q });

/** 丁良才列的「聖書上沒有記明」的十一件事 */
export const UNWRITTEN = {
  items: ['約櫃各板的厚薄', '施恩座的厚薄', '基路伯的詳情', '桌子的厚薄', '燈檯的大小', '豎板的厚薄', '門的厚薄', '基路伯幔子的掛法', '公羊皮蓋的大小', '海狗皮的大小', '銅祭壇板子的厚薄'],
  source: { who: 'GT 丁良才', ch: 25, says: '這些是故意沒寫的。',
    quote: '所以現在沒有人能完完全全的造成會幕，這無非是出於神的旨意，免得後人按式另造會幕' } as Voice,
  list: { who: 'GT 丁良才', ch: 25, says: '十一件事的原文清單。',
    quote: '①約櫃各板的厚薄；②施恩座的厚薄；③基路伯的詳情；④桌子的厚薄；⑤燈檯的大小；⑥豎板的厚薄；⑦門的厚薄；⑧基路伯幔子的掛法；⑨公羊皮蓋的大小；⑩海狗皮的大小；⑪銅祭壇板子的厚薄等。' } as Voice,
};

export const DEBATES: Debate[] = [
  {
    id: 'roof', question: '帳幕的頂是平的，還是尖的？', stop: 'layers',
    text: f('經文給了幔子的長寬和層數，沒有說頂的形狀。', 'not_stated', ['出26:1-14']),
    voices: [
      { who: 'GT《啟導本》', ch: 26, says: '坦白說不知道。', quote: '會幕的頂是平的抑或象我國民房的尖頂，未有說明' },
    ],
  },
  {
    id: 'stack', question: '四層是怎麼疊上去的？', stop: 'layers',
    text: f('經文說山羊毛幔子是「帳幕以上的罩棚」，外面再加兩層皮。', 'explicit', ['出26:7', '出26:14'], '作為帳幕以上的罩棚'),
    voices: [
      { who: 'GT 丁良才', ch: 26, says: '主張罩棚另成一層，舉了七個理由，其中一個是雨水。', quote: '雨水下到上面，也就無法流下去，必定聚存在會幕上' },
      { who: 'GT《丁道爾》', ch: 26, says: '對第三、第四層存疑。', quote: '這似乎是太重而且多餘了。' },
    ],
  },
  {
    id: 'boards', question: '豎板是實心木板，還是空心框架？', stop: 'boards',
    text: f('經文只給了長十肘、寬一肘半，沒有給厚度。', 'not_stated', ['出26:16']),
    voices: [
      { who: 'GT《每日研經叢書》', ch: 26, says: '框架：實心板太重，也會把最美的幔子擋住。', quote: '硬板重量，大約是每塊一噸' },
      { who: 'GT 丁良才', ch: 26, says: '厚板：原文和「艙板」是同一個字。', quote: '有注釋家想是厚半肘' },
    ],
  },
  {
    id: 'grate', question: '銅網在壇的裡面，還是外面？', stop: 'altar',
    text: f('經文說網安在圍腰板以下，到壇的半腰，沒說功用。', 'explicit', ['出27:4-5'], '把網安在壇四面的圍腰板以下'),
    voices: [
      { who: 'GT《丁道爾》', ch: 27, says: '坦言經文沒說清楚，並列兩說；它記下多數學者的看法：網是壇底的外壁，讓空氣流通。', quote: '然而大部分的學者都接受德萊維的解釋' },
      { who: 'GT《中文聖經註釋》', ch: 27, says: '說得更保留。', quote: '這銅網的形式和用處，均未說明。大概是為裝飾之用。' },
    ],
  },
  {
    id: 'hollow', question: '「壇是空的」，裡面填土嗎？', stop: 'altar',
    text: f('經文只說壇是空的，用板做成。出20 另有「為我築土壇」的吩咐。', 'explicit', ['出27:8', '出20:24'], '壇是空的'),
    voices: [
      { who: 'GT 丁良才', ch: 27, says: '大概用土或石頭填滿，和出20 不衝突。', quote: '本句與二十24-25節沒有什麼不符' },
      { who: 'GT《中文聖經註釋》', ch: 27, says: '認為矛盾很大，推到年代問題。', quote: '與約書的吩咐相違反卻是最大的問題' },
    ],
  },
  {
    id: 'poles', question: '約櫃的槓，穿在長邊還是短邊？', stop: 'ark',
    text: f('經文說金環安在櫃的「四腳」上，這邊兩環、那邊兩環。', 'explicit', ['出25:12'], '這邊兩環，那邊兩環'),
    voices: [
      { who: 'CT', ch: 25, says: '多數解經家認為在短邊，抬的時候可以直走。', quote: '應當安在兩短頭而非兩長邊' },
    ],
  },
  {
    id: 'talent', question: '一他連得的精金，到底多重？', stop: 'lampstand',
    text: f('經文只說用精金一他連得，沒有換算。', 'explicit', ['出25:39'], '要用精金一他連得'),
    voices: [
      { who: 'CT', ch: 25, says: '約 34 公斤。', quote: '一他連得約合三十四公斤重' },
      { who: 'GT 丁良才', ch: 25, says: '約 96 磅，是幾家裡唯一明顯偏高的數字。', quote: '一他連得約有九十六磅' },
      { who: 'GT《中文聖經註釋》', ch: 25, says: '約 34 公斤，並由此推論這不是曠野裡搬得動的東西。', quote: '所以學者多認為這聖幕是住居迦南後的產品' },
    ],
  },
  {
    id: 'lamp', question: '「常常點著」，是晝夜不熄嗎？', stop: 'lampstand',
    text: f('經文說使燈常常點著，下一節說「從晚上到早晨」。', 'explicit', ['出27:20-21'], '使燈常常點著'),
    voices: [
      { who: 'GT 丁良才', ch: 27, says: '是每晚點。', quote: '這未必說他們晝夜常點著，乃是說夜夜點著' },
      { who: 'GT《中文聖經註釋》', ch: 27, says: '結論相同。', quote: '這是指經常性的點燈，就是每晚要點燈，而不是永不熄滅地常常點的意思。' },
    ],
  },
  {
    id: 'which-lamp', question: '出27:20 這盞燈，就是出25 的金燈臺嗎？', stop: 'lampstand',
    text: f('出27:20-21 只說「燈」，沒有說是哪一座。', 'not_stated', ['出27:20-21']),
    voices: [
      { who: 'GT《啟導本》《串珠》', ch: 27, says: '就是金燈臺。', quote: '這燈就是金燈檯' },
      { who: 'GT《丁道爾》', ch: 27, says: '保留。', quote: '經文沒有清楚說明這燈是否二十五章31節的金燈臺' },
    ],
  },
  {
    id: 'seacow', question: '「海狗皮」是什麼動物的皮？', stop: 'layers',
    text: f('和合本譯作海狗皮。', 'explicit', ['出26:14'], '再用海狗皮做一層罩棚上的頂蓋'),
    voices: [
      { who: 'BH', ch: 25, says: '譯作「上等皮革」，也有譯作獾皮、海豚皮的；究竟是哪種動物並不確定。' },
      { who: '《舊約背景註釋》', ch: 25, says: '可能是儒艮或海豚，紅海都有出產。' },
    ],
  },
];
