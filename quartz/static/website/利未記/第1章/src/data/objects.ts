import type { Fact, OfferingId, PlaceId, Voice } from './types';

const f = (text: string, status: Fact['status'], refs: string[] = [], q?: string, note?: string): Fact => ({
  text, status, refs, q, note,
});

export type ObjectKind = 'furniture' | 'place' | 'material' | 'vessel';

export interface SacredObject {
  id: string;
  name: string;
  kind: ObjectKind;
  /** 3D 場景裡的節點名，有才能「在 3D 裡看」 */
  node?: string;
  /** 在流程地圖上的位置 */
  place?: PlaceId;
  icon: string;
  summary: string;
  facts: Fact[];
  usedBy: OfferingId[];
  voices?: Voice[];
  /** 重建說明 */
  reconstruction?: string;
}

export const OBJECTS: SacredObject[] = [
  {
    id: 'altar', name: '燔祭壇（銅壇）', kind: 'furniture', node: 'altar', place: 'altar', icon: 'altar',
    summary: '院子裡最大的器具，五祭都在這裡燒。血灑在它的周圍、抹在它的角上、倒在它的腳下。',
    facts: [
      f('四方的，長五肘、寬五肘、高三肘。', 'explicit', ['出27:1'], '長五肘，寬五肘，高三肘'),
      f('四個拐角上各有一個角，和壇連成一塊，外面用銅包裹。', 'explicit', ['出27:2'], '要在壇的四拐角上做四個角'),
      f('四面圍腰板以下有銅網，從下面到壇的半腰。', 'explicit', ['出27:5'], '使網從下達到壇的半腰'),
      f('壇是空心的，用板做成。', 'explicit', ['出27:8'], '壇是空的'),
      f('安在帳幕門前。', 'explicit', ['出40:6'], '把燔祭壇安在帳幕門前'),
      f('壇上的火要常常燒著，不可熄滅。', 'explicit', ['利6:13'], '在壇上必有常常燒著的火，不可熄滅'),
    ],
    usedBy: ['burnt', 'grain', 'peace', 'sin', 'guilt'],
    reconstruction: '尺寸、四角、銅網、抬槓照出27；網與圍腰板的細部樣式是示意。',
  },
  {
    id: 'altar-parts', name: '壇的周圍、四角、腳、旁邊', kind: 'place', node: 'altar', place: 'horns', icon: 'drop',
    summary: '同樣是處理血，各祭用的位置不同。這是分辨五祭最快的線索之一。',
    facts: [
      f('燔祭、平安祭、贖愆祭：灑在壇的周圍。', 'explicit', ['利1:5', '利3:2', '利7:2'], '把血灑在會幕門口、壇的周圍'),
      f('官長和百姓的贖罪祭：抹在燔祭壇的四角上，其餘倒在壇腳。', 'explicit', ['利4:25'], '抹在燔祭壇的四角上'),
      f('鳥：流在壇的旁邊。', 'explicit', ['利1:15'], '鳥的血要流在壇的旁邊'),
    ],
    usedBy: ['burnt', 'peace', 'sin', 'guilt'],
    voices: [{ who: 'CT', ch: 3, says: '「灑」的字義註解是投、擲、扔，是從盆裡潑出去，不是輕輕點灑。' }],
  },
  {
    id: 'north', name: '壇的北邊', kind: 'place', node: 'altar', place: 'north', icon: 'compass',
    summary: '宰羊作燔祭的地方；贖罪祭、贖愆祭也在「宰燔祭牲的地方」宰。',
    facts: [
      f('要把羊宰於壇的北邊。', 'explicit', ['利1:11'], '要把羊宰於壇的北邊'),
      f('贖愆祭牲在宰燔祭牲的地方宰。', 'explicit', ['利7:2'], '人在哪裡宰燔祭牲，也要在那裡宰贖愆祭牲'),
      f('平安祭沒有指定在壇的哪一邊宰。', 'not_stated', ['利3:2'], '宰於會幕門口'),
    ],
    usedBy: ['burnt', 'sin', 'guilt'],
  },
  {
    id: 'ash', name: '壇東邊倒灰的地方', kind: 'place', node: 'ash_heap', place: 'east', icon: 'ash',
    summary: '鳥的嗉子和髒物丟在這裡。每天早晨從壇上收下來的灰，先倒在壇的旁邊。',
    facts: [
      f('把鳥的嗉子和髒物除掉，丟在壇的東邊倒灰的地方。', 'explicit', ['利1:16'], '丟在壇的東邊倒灰的地方'),
      f('祭司把壇上燒剩的灰收起來，倒在壇的旁邊。', 'explicit', ['利6:10'], '倒在壇的旁邊'),
    ],
    usedBy: ['burnt'],
  },
  {
    id: 'laver', name: '洗濯盆', kind: 'furniture', node: 'laver', place: 'laver', icon: 'laver',
    summary: '放在會幕和壇的中間，是給祭司洗手洗腳用的。利1-7 的獻祭條例裡沒有提到它。',
    facts: [
      f('放在會幕和壇的中間，盆裡盛水。', 'explicit', ['出30:18'], '要將盆放在會幕和壇的中間'),
      f('亞倫和他的兒子在這盆裡洗手洗腳，免得死亡。', 'explicit', ['出30:19-21'], '亞倫和他的兒子要在這盆裡洗手洗腳'),
      f('是用會幕門前伺候的婦人的鏡子做的。', 'explicit', ['出38:8'], '是用會幕門前伺候的婦人之鏡子做的'),
      f('承接聖職那天，摩西用膏油抹了洗濯盆和盆座。', 'explicit', ['利8:11'], '並洗濯盆和盆座'),
      f('經文沒有給洗濯盆的尺寸和形狀。', 'not_stated', ['出30:17-21']),
    ],
    usedBy: [],
    reconstruction: '經文沒有尺寸，模型的形狀完全是示意。',
  },
  {
    id: 'front', name: '會幕門口', kind: 'place', node: 'altar', place: 'front', icon: 'door',
    summary: '獻祭的人把牲畜牽到這裡。燔祭壇就安在帳幕門前，所以「會幕門口」和壇是同一帶。',
    facts: [
      f('燔祭要在會幕門口獻上。', 'explicit', ['利1:3'], '在會幕門口獻一隻沒有殘疾的公牛'),
      f('燔祭壇安在會幕的帳幕門前。', 'explicit', ['出40:29'], '在會幕的帳幕門前，安設燔祭壇'),
      f('承接聖職的七天，祭司晝夜住在會幕門口。', 'explicit', ['利8:35'], '七天你們要晝夜住在會幕門口'),
    ],
    usedBy: ['burnt', 'peace', 'sin'],
  },
  {
    id: 'incense', name: '香壇（金壇）', kind: 'furniture', node: 'incense_altar', place: 'incense', icon: 'incense',
    summary: '在會幕裡面、幔子前。平常燒香；大祭司或全會眾犯了罪，贖罪祭的血要抹在它的四角上。',
    facts: [
      f('四方的，長一肘、寬一肘、高二肘。', 'explicit', ['出30:2'], '長一肘，寬一肘，高二肘'),
      f('上面、四圍、四角都用精金包裹。', 'explicit', ['出30:3'], '要用精金把壇的上面與壇的四圍，並壇的四角包裹'),
      f('放在法櫃前的幔子外。', 'explicit', ['出30:6'], '要把壇放在法櫃前的幔子外'),
      f('不可在這壇上獻燔祭、素祭。', 'explicit', ['出30:9'], '不可獻燔祭、素祭'),
      f('受膏的祭司犯罪時，血抹在香壇的四角上。', 'explicit', ['利4:7'], '香壇的四角上'),
    ],
    usedBy: ['sin'],
  },
  {
    id: 'veil', name: '幔子', kind: 'furniture', node: 'veil', place: 'veil', icon: 'veil',
    summary: '把聖所和至聖所隔開。贖罪祭的血對著它彈七次，但不進到裡面。',
    facts: [
      f('用藍色、紫色、朱紅色線和撚的細麻織成，繡上基路伯。', 'explicit', ['出26:31'], '以巧匠的手工繡上基路伯'),
      f('把聖所和至聖所隔開。', 'explicit', ['出26:33'], '這幔子要將聖所和至聖所隔開'),
      f('受膏的祭司對著聖所的幔子彈血七次。', 'explicit', ['利4:6'], '對著聖所的幔子彈血七次'),
    ],
    usedBy: ['sin'],
    voices: [{ who: 'GT《舊約聖經背景註釋》', ch: 4, says: '七次，是一次淨化整個聖所的方法。',
      quote: '彈血七次是同時淨化聖所每一部分，不必分別處理的方法。' }],
  },
  {
    id: 'court', name: '會幕的院子（聖處）', kind: 'place', node: 'fence_linen', place: 'court', icon: 'court',
    summary: '祭司吃「至聖」祭物的地方：素祭、贖罪祭、贖愆祭。',
    facts: [
      f('院子長一百肘，寬五十肘，帷子高五肘。', 'explicit', ['出27:18'], '院子要長一百肘，寬五十肘，高五肘'),
      f('素祭剩下的，祭司要在會幕的院子裡吃。', 'explicit', ['利6:16'], '要在會幕的院子裡吃'),
      f('贖罪祭的肉，在聖處，就是會幕的院子裡吃。', 'explicit', ['利6:26'], '要在聖處，就是在會幕的院子裡吃'),
    ],
    usedBy: ['grain', 'sin', 'guilt'],
  },
  {
    id: 'outside', name: '營外潔淨之地', kind: 'place', place: 'outside', icon: 'outside',
    summary: '倒灰的地方。血帶進會幕的贖罪祭，整隻公牛在這裡燒掉。',
    facts: [
      f('全公牛要搬到營外潔淨之地、倒灰之所，用火燒在柴上。', 'explicit', ['利4:12'], '要搬到營外潔淨之地、倒灰之所，用火燒在柴上'),
      f('每天早晨的壇灰也運到這裡。', 'explicit', ['利6:11'], '把灰拿到營外潔淨之處'),
    ],
    usedBy: ['sin', 'burnt'],
    voices: [{ who: 'GT 丁良才', ch: 4, says: '中文都寫「燒」，原文是兩個字：營外是燒成灰，壇上是使香氣上升。',
      quote: '被燒在燔祭壇上的是表示神的喜悅，被燒在營外的是表示神的震怒' }],
  },
  {
    id: 'cookware', name: '爐、鐵鏊、煎盤', kind: 'vessel', place: 'front', icon: 'pan',
    summary: '素祭的三種做法，做出來的東西歸主持獻祭的那位祭司。',
    facts: [
      f('爐中烤：調油的無酵細麵餅，或抹油的無酵薄餅。', 'explicit', ['利2:4'], '若用爐中烤的物為素祭'),
      f('鐵鏊上做：調油的無酵細麵，分塊澆油。', 'explicit', ['利2:5-6'], '若用鐵鏊上做的物為素祭'),
      f('煎盤做：用油與細麵做成。', 'explicit', ['利2:7'], '若用煎盤做的物為素祭'),
      f('這三種做的都歸那獻祭的祭司。', 'explicit', ['利7:9'], '都要歸那獻祭的祭司'),
    ],
    usedBy: ['grain'],
    voices: [
      { who: 'GT 丁良才', ch: 2, says: '爐是一種能搬動的罐形瓦爐，高約三尺。' },
      { who: 'GT 丁良才', ch: 2, says: '煎盤是能盛油的深鍋。' },
    ],
  },
  {
    id: 'ingredients', name: '細麵、油、乳香、鹽', kind: 'material', place: 'front', icon: 'grain',
    summary: '素祭的材料。乳香要「全部」燒掉；鹽一樣都不能少。',
    facts: [
      f('細麵澆上油，加上乳香。', 'explicit', ['利2:1'], '要用細麵澆上油，加上乳香'),
      f('祭司要取所有的乳香燒在壇上。', 'explicit', ['利2:2'], '所有的乳香'),
      f('一切的供物都要配鹽而獻。', 'explicit', ['利2:13'], '一切的供物都要配鹽而獻'),
      f('窮人的贖罪祭用細麵，但不可加油、不可加乳香。', 'explicit', ['利5:11'], '不可加上油，也不可加上乳香'),
    ],
    usedBy: ['grain', 'sin'],
    voices: [{ who: 'GT《舊約聖經背景註釋》', ch: 2, says: '乳香只長在特定地區，所以很貴。', quote: '雨量、氣溫、土壤不合，就不會生長' }],
  },
  {
    id: 'breads', name: '感謝祭的四種餅', kind: 'material', place: 'front', icon: 'bread',
    summary: '三種無酵的，加上一種有酵的。每樣取一個歸給灑血的祭司。',
    facts: [
      f('調油的無酵餅、抹油的無酵薄餅、油調細麵做的餅。', 'explicit', ['利7:12'], '並用油調勻細麵做的餅'),
      f('還要加上有酵的餅。', 'explicit', ['利7:13'], '要用有酵的餅'),
      f('每樣取一個作舉祭，歸灑血的祭司。', 'explicit', ['利7:14'], '他要把一個餅獻給耶和華為舉祭'),
    ],
    usedBy: ['peace'],
    voices: [{ who: 'GT 丁良才', ch: 7, says: '這些有酵的餅不可燒在祭壇上；阿摩司責備以色列人，正是因為他們犯了這條例（摩4:5）。' }],
  },
  {
    id: 'linen', name: '祭司的細麻布衣服', kind: 'material', icon: 'linen',
    summary: '收壇灰時穿；把灰拿出營外之前要換掉。',
    facts: [
      f('穿上細麻布衣服和細麻布褲子，收壇上的灰。', 'explicit', ['利6:10'], '祭司要穿上細麻布衣服，又要把細麻布褲子穿在身上'),
      f('脫下這衣服，穿上別的衣服，再把灰拿到營外。', 'explicit', ['利6:11'], '隨後要脫去這衣服，穿上別的衣服'),
    ],
    usedBy: ['burnt'],
  },
  {
    id: 'pots', name: '瓦器與銅器', kind: 'vessel', place: 'court', icon: 'pot',
    summary: '煮過贖罪祭肉的鍋子：瓦器打碎，銅器擦洗。',
    facts: [f('煮祭物的瓦器要打碎；煮在銅器裡，要擦磨、在水中涮淨。', 'explicit', ['利6:28'], '若是煮在銅器裡，這銅器要擦磨，在水中涮淨')],
    usedBy: ['sin'],
    voices: [{ who: 'GT《舊約聖經背景註釋》', ch: 6, says: '陶器會吸收，銅器容易洗乾淨。', quote: '陶器本質多孔，能夠吸收所裝之物的不潔' }],
  },
  {
    id: 'shekel', name: '聖所的舍客勒', kind: 'material', place: 'front', icon: 'coin',
    summary: '贖愆祭的公綿羊要照估定的價，用聖所的標準算。',
    facts: [f('按聖所的舍客勒拿銀子。', 'explicit', ['利5:15'], '按聖所的舍客勒拿銀子')],
    usedBy: ['guilt'],
    voices: [
      { who: 'CT', ch: 5, says: '聖所內使用的砝碼，每一舍客勒約折合 11.5 公克。' },
      { who: 'GT《舊約聖經背景註釋》', ch: 5, says: '出土的舍客勒法碼約 9.3 到 10.5 公克。', quote: '重量在九又十分之三至十又二分之一克之間' },
    ],
  },
];
