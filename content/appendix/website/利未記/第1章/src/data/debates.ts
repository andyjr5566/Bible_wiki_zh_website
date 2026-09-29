import type { Fact, OfferingId, Voice } from './types';

/**
 * 「經文沒說的事」：經文在這些地方留白或只給事實，註釋家各有讀法。
 * 所有 voice.quote 都逐字取自本庫利未記主檔的「本章整理」。
 */
export interface Debate {
  id: string;
  question: string;
  offering?: OfferingId | 'priesthood';
  /** 經文實際說了什麼 */
  text: Fact;
  voices: Voice[];
  /** 原文層能確認的事（取自主檔的「原文能證明什麼」段落） */
  lexical?: Voice;
}

const f = (text: string, status: Fact['status'], refs: string[] = [], q?: string): Fact => ({ text, status, refs, q });

export const DEBATES: Debate[] = [
  {
    id: 'hands',
    question: '按手，是把罪轉給祭牲嗎？',
    offering: 'burnt',
    text: f('經文只說「按手」，接著說「燔祭便蒙悅納，為他贖罪」，沒有解釋按手本身是什麼意思。', 'explicit', ['利1:4'], '他要按手在燔祭牲的頭上'),
    voices: [
      { who: 'CT、丁良才、GT《精讀本》、BH', says: '把罪轉到祭牲身上。', ch: 1 },
      { who: 'GT《舊約聖經背景註釋》', says: '反對轉罪的說法，因為連不是為罪獻的祭也要按手；它認為是認同、替身或宣告所有權。', ch: 1,
        quote: '非贖罪的祭也需要按手' },
      { who: 'KC', says: '方向相反：是祭牲的價值轉到獻祭的人身上。', ch: 1, quote: '神在這祭裡看見他' },
    ],
    lexical: { who: '原文', says: '「按手」的字面是「倚壓」，不是輕輕一碰。', ch: 1 },
  },
  {
    id: 'tiers',
    question: '牛、羊、鳥三級，是按家境分，還是按別的？',
    offering: 'burnt',
    text: f('經文按牛、羊、鳥由大到小排列，沒有說為什麼分三級。', 'synthesis', ['利1:3', '利1:10', '利1:14']),
    voices: [
      { who: 'CT', says: '按家境分，只要動機對，都蒙悅納。', ch: 1, quote: '富厚之家獻公牛，小康之家獻山羊，貧窮人只能獻一隻班鳩' },
      { who: 'KC', says: '按屬靈認識的深淺分。', ch: 1, quote: '說到一個信徒對主耶穌的工作和祂的位格領會了多少' },
    ],
  },
  {
    id: 'east',
    question: '鳥的嗉子為什麼丟在壇的「東邊」？',
    offering: 'burnt',
    text: f('經文只說丟在壇的東邊倒灰的地方，沒有給理由。', 'explicit', ['利1:16'], '丟在壇的東邊倒灰的地方'),
    voices: [
      { who: 'GT《舊約聖經背景註釋》', says: '記下拉比的解釋，也坦白說經文沒有說明。', ch: 1, quote: '經文並無說明理由' },
      { who: '拉比（據 GT 轉述）', says: '因為東邊離開聖所最遠。', ch: 1, quote: '離開聖所最遠' },
      { who: 'CT', says: '正好相反：東邊靠近院子的門，方便清理。', ch: 1, quote: '離外院門口最近的地方，大概方便清理' },
      { who: 'BH', says: '東邊是人來親近神的方向，把污穢丟在那裡，等於把不潔拋在身後。', ch: 1 },
    ],
  },
  {
    id: 'fire-origin',
    question: '壇上的火，是一開始就從不熄滅嗎？',
    offering: 'burnt',
    text: f('利6 要求壇上的火常常燒著、不可熄滅；利1:7 卻寫祭司「把火放在壇上」。', 'explicit', ['利6:13', '利1:7'], '把火放在壇上'),
    voices: [
      { who: 'BH', says: '依利6:13，這火常常燒著，象徵神永在的同在。', ch: 1 },
      { who: 'GT《啟導本》', says: '從利1:7 讀出每次獻祭都要重新點火，可能因為曠野中會幕常常遷移。', ch: 1,
        quote: '應是以色列人在曠野漂泊，會幕隨時遷移的結果' },
    ],
  },
  {
    id: 'aroma',
    question: '「馨香」——神真的喜歡那個氣味嗎？',
    offering: 'burnt',
    text: f('燔祭、素祭、平安祭都被稱為「獻與耶和華為馨香的火祭」。', 'explicit', ['利1:9', '利2:2', '利3:5'], '馨香的火祭'),
    voices: [
      { who: 'GT 丁良才', says: '是借喻。', ch: 1, quote: '被燒的肉和脂油本來沒有什麼香氣' },
      { who: 'GT《啟導本》', says: '也是借喻，神不像偶像那樣吃人間煙火。', ch: 1, quote: '不是說神喜歡聞到祭物燒出的氣味' },
      { who: 'GT《雷氏研讀本》', says: '照字面理解。', ch: 1, quote: '即神喜歡祭物的香味，這香味叫祂喜悅' },
    ],
  },
  {
    id: 'flour',
    question: '「細麵」是篩得最細的，還是篩剩的粗粒？',
    offering: 'grain',
    text: f('經文只說「細麵」。', 'explicit', ['利2:1'], '要用細麵澆上油'),
    voices: [
      { who: 'CT、丁良才、BH', says: '篩到最細、最精的麵粉，是奢侈品。', ch: 2 },
      { who: 'GT《舊約聖經背景註釋》', says: '其實是篩子上留下的顆粒。', ch: 2,
        quote: '小麥磨成麵粉之後留在篩子中的粗麵粉（grit 或 semolina）' },
    ],
  },
  {
    id: 'frankincense',
    question: '烤的餅要不要加乳香？',
    offering: 'grain',
    text: f('生細麵（利2:1）和初熟禾穗（利2:15）都寫了乳香；爐、鐵鏊、煎盤三段（利2:4-7）都沒有提。', 'not_stated', ['利2:1', '利2:15', '利2:4-7']),
    voices: [
      { who: 'GT《舊約聖經背景註釋》', says: '不加。', ch: 2, quote: '用的是同樣的油和粗麵粉，但不加乳香' },
      { who: 'GT《聖經精讀本》', says: '不加，這是體恤窮人。', ch: 2, quote: '神為貧窮人著想，沒有貴重的乳香也能獻素祭' },
      { who: 'GT 丁良才', says: '應該也要加。', ch: 2, quote: '在這些餅上大概也必要加乳香' },
    ],
  },
  {
    id: 'leaven',
    question: '「酵」一定代表罪嗎？',
    offering: 'grain',
    text: f('素祭不可有酵（利2:11）；感謝的平安祭卻要配有酵的餅（利7:13）。', 'explicit', ['利2:11', '利7:13'], '要用有酵的餅'),
    voices: [
      { who: 'CT', says: '酵就是罪。', ch: 2, quote: '能使麵團發起來，亦會使它發霉變壞，所以預表罪' },
      { who: 'GT《啟導本》', says: '酵本身是中立的。', ch: 2, quote: '為中立的，本身無所謂好壞，全看人如何用它' },
    ],
  },
  {
    id: 'honey',
    question: '不可獻的「蜜」，是蜂蜜嗎？',
    offering: 'grain',
    text: f('經文說不可把酵和蜜當作火祭燒給耶和華。', 'explicit', ['利2:11'], '一點蜜'),
    voices: [
      { who: 'GT《舊約聖經背景註釋》', says: '大概是棗子糖漿。', ch: 2, quote: '所指的大概是指蜜棗的糖漿，而非蜂蜜' },
    ],
  },
  {
    id: 'purification',
    question: '「贖罪祭」該改叫「潔淨祭」嗎？',
    offering: 'sin',
    text: f('經文說祭司為他贖罪，他必蒙赦免；大祭司和全會眾的血要帶進會幕，彈在幔子前、抹在香壇角上。', 'explicit', ['利4:6-7', '利4:20'],
      '他們必蒙赦免'),
    voices: [
      { who: 'CT、GT《串珠》', says: '字根有潔淨的意思，重點也包括潔淨敬拜的地方。', ch: 4, quote: '贖罪祭的重點不只贖罪，也潔淨崇拜的地方' },
      { who: 'GT《舊約聖經背景註釋》', says: '主張改名，因為這祭潔淨的是聖所。', ch: 4, quote: '贖罪祭是『潔淨祭』（NIV；purification offering）的傳統稱呼' },
    ],
  },
  {
    id: 'lev5',
    question: '利未記 5 章前半，到底是贖罪祭還是贖愆祭？',
    offering: 'sin',
    text: f('同一節裡兩個祭名都出現：把「贖愆祭牲」牽來「為贖罪祭」。', 'explicit', ['利5:6'], '把他的贖愆祭牲'),
    voices: [
      { who: 'GT 丁良才', says: '仍是贖罪祭，這段本該歸在第四章。', ch: 5 },
      { who: 'GT《啟導本》', says: '後半才是正式的贖愆祭。', ch: 5, quote: '14～19節才是正式的『贖愆祭』' },
      { who: 'KC', says: '介於兩者之間。', ch: 5, quote: '贖罪祭與贖愆祭之間的一種中間形態' },
    ],
  },
  {
    id: 'eat-sin',
    question: '祭司為什麼要吃贖罪祭的肉？',
    offering: 'sin',
    text: f('經文只規定辦這祭的祭司要在會幕的院子裡吃，沒有解釋為什麼。', 'explicit', ['利6:26'], '為贖罪獻這祭的祭司要吃'),
    voices: [
      { who: 'KC', says: '吃，就是與犯罪的人站在一起，把他的罪當作自己的來承認。', ch: 6, quote: '這就是吃贖罪祭' },
      { who: 'GT 丁良才', says: '讓獻祭的人放心。', ch: 6, quote: '這或者是要叫獻這祭的人放心，他的罪已經完全被贖了' },
      { who: 'BH', says: '顯出祭司在制度中擔當會眾罪孽的角色。', ch: 6 },
    ],
  },
  {
    id: 'wave',
    question: '「搖祭」真的要搖嗎？',
    offering: 'peace',
    text: f('經文說把胸在耶和華面前「搖一搖」，沒有描述動作。', 'explicit', ['利7:30'], '搖一搖'),
    voices: [
      { who: 'CT', says: '前後擺動。', ch: 7 },
      { who: 'GT《雷氏研讀本》', says: '向祭壇又離開祭壇，象徵獻給神、神又交回給祭司。', ch: 7 },
      { who: 'GT《舊約聖經背景註釋》', says: '存疑，可能只是在神面前抬起來。', ch: 7, quote: '對經文詳細的研究，證明這些祭並沒有搖什麼東西' },
    ],
  },
  {
    id: 'crowd',
    question: '會幕門口，站得下全體會眾嗎？',
    offering: 'priesthood',
    text: f('經文說會眾聚集在會幕門口。', 'explicit', ['利8:4'], '會眾聚集在會幕門口'),
    voices: [
      { who: 'CT', says: '可能只有長老和百姓代表，或是七天裡輪流觀禮。', ch: 8 },
      { who: 'GT 丁良才', says: '站不下。', ch: 8, quote: '因為會幕的院子不大，不能容很多的人' },
    ],
  },
  {
    id: 'fire',
    question: '第八天那把火，從哪裡來？',
    offering: 'priesthood',
    text: f('經文只說「有火從耶和華面前出來」。', 'explicit', ['利9:24'], '有火從耶和華面前出來'),
    voices: [
      { who: 'GT 丁良才', says: '不是從天上降下。', ch: 9, quote: '乃是從會幕內至聖所的約櫃那裡，或從所顯的榮耀中出來的' },
      { who: 'GT《舊約聖經背景註釋》', says: '從雲柱火柱中出來。', ch: 9, quote: '雲柱火柱是最可能的顯現方式' },
      { who: 'GT《利未記雷氏研讀本》', says: '就是那常燒不滅之火的起點。', ch: 9, quote: '可能是那常常燒的『火』（六12,13）開始焚燒的時候' },
      { who: 'GT《聖經精讀本》', says: '是超自然的火。', ch: 9, quote: '是超自然的，從耶和華神面前出來焚燒燔祭' },
    ],
  },
];

/** 翻牌小卡：「你知道嗎？」全部是經文明說或直接對照 */
export interface Trivia {
  id: string;
  front: string;
  back: Fact;
  offering?: OfferingId;
}

export const TRIVIA: Trivia[] = [
  { id: 'bird-blemish', offering: 'burnt', front: '獻鳥當燔祭，要不要「沒有殘疾」？',
    back: f('牛和羊都明寫「沒有殘疾」「公的」；鳥的段落兩樣都沒寫。', 'synthesis', ['利1:3', '利1:10', '利1:14'], '就要獻斑鳩或是雛鴿為供物') },
  { id: 'skin', offering: 'burnt', front: '燔祭「全燒」，真的什麼都不剩嗎？',
    back: f('皮留下來，歸主持的那位祭司。', 'explicit', ['利7:8'], '要親自得他所獻那燔祭牲的皮') },
  { id: 'clothes', offering: 'burnt', front: '祭司倒灰，為什麼要換衣服？',
    back: f('收灰時穿細麻布衣服，把灰拿到營外之前，要先換上別的衣服。', 'explicit', ['利6:10-11'], '隨後要脫去這衣服，穿上別的衣服') },
  { id: 'salt', offering: 'grain', front: '素祭一定要加的調味料是？',
    back: f('鹽。「一切的供物都要配鹽而獻。」', 'explicit', ['利2:13'], '一切的供物都要配鹽而獻') },
  { id: 'leaven-bread', offering: 'peace', front: '利未記有沒有哪個祭「要」用有酵的餅？',
    back: f('有：為感謝獻的平安祭。', 'explicit', ['利7:13'], '要用有酵的餅和為感謝獻的平安祭') },
  { id: 'third-day', offering: 'peace', front: '平安祭的肉留到第三天才吃，會怎樣？',
    back: f('這祭必不蒙悅納，也不算為祭。', 'explicit', ['利7:18'], '人所獻的也不算為祭') },
  { id: 'fat', offering: 'peace', front: '以色列人不能吃的是哪兩樣？',
    back: f('脂油和血，在一切的住處都不可吃。', 'explicit', ['利3:17'], '脂油和血都不可吃') },
  { id: 'pots', offering: 'sin', front: '煮過贖罪祭肉的鍋子怎麼辦？',
    back: f('瓦器打碎；銅器擦磨，再用水涮淨。', 'explicit', ['利6:28'], '惟有煮祭物的瓦器要打碎') },
  { id: 'garment', offering: 'sin', front: '贖罪祭的血濺到衣服上呢？',
    back: f('那件衣服要在聖處洗淨。', 'explicit', ['利6:27'], '所彈的那一件要在聖處洗淨') },
  { id: 'two-birds', offering: 'sin', front: '窮人贖罪，為什麼要帶「兩隻」鳥？',
    back: f('一隻作贖罪祭，一隻作燔祭，而且要先獻贖罪祭的那一隻。', 'explicit', ['利5:7-8'], '一隻作贖罪祭，一隻作燔祭') },
  { id: 'fifth', offering: 'guilt', front: '虧負了鄰舍，只要還錢就好嗎？',
    back: f('如數歸還，另加五分之一，然後還要獻贖愆祭。', 'explicit', ['利6:5-6'], '另外加上五分之一') },
  { id: 'high-priest-grain', offering: 'grain', front: '祭司可以吃素祭，那他自己獻的素祭呢？',
    back: f('不可吃，要全部燒掉。', 'explicit', ['利6:23'], '祭司的素祭都要燒了，卻不可吃') },
];

export const TWO_BIRDS_VOICE: Voice = {
  who: 'CT', ch: 5, says: '鳥的脂油和肉分不開，所以拆成兩隻。',
  quote: '因為獻鳥時，不能分開脂油和肉，分別兩種用途，故須獻上兩隻',
};
