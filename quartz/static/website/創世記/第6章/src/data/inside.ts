import type { Fact, Voice } from './types';

/**
 * 「走進方舟」裡的標示。座標是方舟本地座標（公尺）：x 沿船長（船頭 −、船尾 +），
 * y 向上（0 是船底平面），z 橫向（門在 −z 那一側）。
 * deck：0 下層、1 中層、2 上層、'out' 在船外看。
 */
export interface Spot {
  id: string;
  deck: 0 | 1 | 2 | 'out';
  at: [number, number, number];
  title: string;
  /** 一句白話 */
  text: string;
  facts: Fact[];
  voices?: Voice[];
  /** 畫面裡哪些是示意 */
  shown?: string;
}

export const SPOTS: Spot[] = [
  // ---------------------------------------------------------------- 下層
  {
    id: 'pens', deck: 0, at: [-22, 3.4, 7.5], title: '一間一間的隔間',
    text: '神吩咐挪亞把方舟分成一間一間。這裡把下層做成兩排隔欄，中間留走道。',
    facts: [
      { text: '要分一間一間地造', status: 'explicit', refs: ['創6:14'], q: '分一間一間地造' },
      { text: '「一間一間」原文直譯也可作「巢穴」', status: 'synthesis', refs: ['創6:14'] },
      { text: '隔間多大、怎麼排', status: 'not_stated' },
    ],
    voices: [{ who: 'KC', says: '方舟不是一個空蕩蕩的大統艙，每一隻動物都有自己的位置，看得出神照顧得很細。', ch: 6 }],
  },
  {
    id: 'pairs', deck: 0, at: [6, 3.6, -7.5], title: '成對的牲畜',
    text: '動物一對一對、有公有母地進來。潔淨的畜類帶七公七母，不潔淨的帶一公一母。',
    facts: [
      { text: '一對一對，有公有母', status: 'explicit', refs: ['創7:9'], q: '都是一對一對的，有公有母' },
      { text: '潔淨的畜類帶七公七母', status: 'explicit', refs: ['創7:2'], q: '凡潔淨的畜類，你要帶七公七母' },
      { text: '船上有哪些動物、一共多少', status: 'not_stated' },
    ],
    shown: '畫面裡的動物種類只是舉例。',
  },
  {
    id: 'feed', deck: 0, at: [15, 2.6, 4.3], title: '飼槽與草料',
    text: '每一欄前面放一條飼槽，欄裡鋪草。神要挪亞為人和動物積蓄食物。',
    facts: [
      { text: '食物要夠人和動物吃', status: 'explicit', refs: ['創6:21'], q: '好作你和他們的食物' },
      { text: '怎麼餵、多久餵一次', status: 'not_stated' },
    ],
    shown: '飼槽、墊草的樣子是想像。',
  },
  {
    id: 'water', deck: 0, at: [-38, 2.9, -2.6], title: '水桶',
    text: '這麼多活物在船上一年多，要喝的水從哪裡來、怎麼存，經文完全沒有提。',
    facts: [{ text: '飲水怎麼存放', status: 'not_stated' }],
    shown: '木桶是示意。',
  },
  {
    id: 'door-in', deck: 0, at: [10.7, 4.8, -10.2], title: '開在旁邊的門',
    text: '全船只有這一道門。人和動物都進去之後，是耶和華把門關上的。',
    facts: [
      { text: '門開在旁邊', status: 'explicit', refs: ['創6:16'], q: '方舟的門要開在旁邊' },
      { text: '耶和華關了門', status: 'explicit', refs: ['創7:16'], q: '耶和華就把他關在方舟裡頭' },
      { text: '門開在哪一層、多大', status: 'not_stated' },
    ],
  },
  {
    id: 'ladder', deck: 0, at: [-21.8, 4.3, 4.6], title: '上下層的梯子',
    text: '三層之間怎麼上下，經文沒寫。這裡放了木梯，讓你可以想像人怎麼走動。',
    facts: [
      { text: '方舟分上、中、下三層', status: 'explicit', refs: ['創6:16'], q: '方舟要分上、中、下三層' },
      { text: '層與層之間怎麼通行', status: 'not_stated' },
    ],
    shown: '梯子和樓梯口的位置是示意。',
  },
  // ---------------------------------------------------------------- 中層
  {
    id: 'stores', deck: 1, at: [-14, 7.6, -7.5], title: '積蓄的食物',
    text: '中層放糧食：穀物、乾草、一罐一罐的存糧。經文只說要把各樣食物積蓄起來。',
    facts: [
      { text: '把各樣食物積蓄起來', status: 'explicit', refs: ['創6:21'], q: '你要拿各樣食物積蓄起來' },
      { text: '食物放在哪一層', status: 'not_stated' },
    ],
    shown: '糧食放在中層是網站的安排。',
  },
  {
    id: 'hay', deck: 1, at: [20, 7.3, 6.5], title: '乾草堆',
    text: '牲畜要吃草。成捆的乾草疊在艙壁邊，離地面遠一點比較不會受潮。',
    facts: [{ text: '船上帶了哪些飼料', status: 'not_stated' }],
    shown: '草捆的形狀是想像。',
  },
  {
    id: 'jars', deck: 1, at: [4, 7.5, 8.2], title: '陶罐',
    text: '罐子裡可能裝油、裝水、裝種子。裝的是什麼，經文沒有交代。',
    facts: [{ text: '罐子裡裝什麼', status: 'not_stated' }],
  },
  {
    id: 'lamp', deck: 1, at: [4, 8.4, 0], title: '油燈',
    text: '船艙裡怎麼照明，經文沒說。畫面用油燈，是為了讓你看得見。',
    facts: [
      { text: '船艙裡的光從哪裡來', status: 'not_stated' },
      { text: '頂上留了透光處', status: 'explicit', refs: ['創6:16'], q: '方舟上邊要留透光處' },
    ],
  },
  // ---------------------------------------------------------------- 上層
  {
    id: 'rooms', deck: 2, at: [-4.5, 12, -6.5], title: '挪亞一家的住處',
    text: '進方舟的是八個人：挪亞、他的妻子、三個兒子和三個兒婦。網站把他們安排在上層。',
    facts: [
      { text: '八個人進了方舟', status: 'explicit', refs: ['創7:13'], q: '挪亞和他三個兒子閃、含、雅弗，並挪亞的妻子和三個兒婦，都進入方舟' },
      { text: '他們住在哪一層、哪一間', status: 'not_stated' },
    ],
    shown: '房間、床鋪的樣子是想像。',
  },
  {
    id: 'birds', deck: 2, at: [6, 11.8, 8.4], title: '飛鳥',
    text: '天上的飛鳥也按種類成對進來，潔淨的也是七公七母。',
    facts: [
      { text: '飛鳥各從其類', status: 'explicit', refs: ['創6:20'], q: '飛鳥各從其類' },
      { text: '飛鳥也帶七公七母', status: 'explicit', refs: ['創7:3'], q: '空中的飛鳥也要帶七公七母' },
    ],
    shown: '棲木和鳥籠是示意。',
  },
  {
    id: 'hearth', deck: 2, at: [-27, 11, -3.5], title: '爐灶與餐桌',
    text: '八個人要在船上生活一年多。煮飯、吃飯的地方，經文沒有描寫。',
    facts: [
      { text: '在船上怎麼生火煮食', status: 'not_stated' },
      { text: '洪水從二月十七日到隔年二月二十七日', status: 'synthesis', refs: ['創7:11', '創8:14'] },
    ],
    shown: '陶爐、桌子、水罐是想像。',
  },
  {
    id: 'tsohar', deck: 2, at: [0, 12.6, 0], title: '透光處，高一肘',
    text: '抬頭看屋脊：屋頂和屋脊蓋板之間留了一道約 45 公分的縫，光和空氣從這裡進來。',
    facts: [
      { text: '上邊留透光處，高一肘', status: 'explicit', refs: ['創6:16'], q: '方舟上邊要留透光處，高一肘' },
      { text: '原文資料把這個字譯作「頂蓋」，也有譯本譯成窗戶', status: 'synthesis', refs: ['創6:16'] },
    ],
    shown: '沿屋脊整條開口是一種重建方式。',
  },
  {
    id: 'window', deck: 2, at: [-32.5, 11.4, -10.4], title: '窗戶',
    text: '洪水退了以後，挪亞打開這扇窗，放出烏鴉和鴿子。',
    facts: [
      { text: '挪亞開了窗戶', status: 'explicit', refs: ['創8:6'], q: '挪亞開了方舟的窗戶' },
      { text: '窗在哪裡、多大', status: 'not_stated' },
    ],
  },
  // ---------------------------------------------------------------- 船外
  {
    id: 'o-size', deck: 'out', at: [-50, 15.5, 0], title: '300 × 50 × 30 肘',
    text: '照一肘約 45 公分，約長 135、寬 22.5、高 13.5 公尺。',
    facts: [{ text: '長三百肘，寬五十肘，高三十肘', status: 'explicit', refs: ['創6:15'], q: '要長三百肘，寬五十肘，高三十肘' }],
  },
  {
    id: 'o-door', deck: 'out', at: [10.7, 6.6, -12], title: '門',
    text: '全船唯一的出入口，開在側面。',
    facts: [{ text: '門開在旁邊', status: 'explicit', refs: ['創6:16'], q: '方舟的門要開在旁邊' }],
  },
  {
    id: 'o-pitch', deck: 'out', at: [-30, 4, -12.2], title: '松香',
    text: '船殼裡外都抹上松香，把木板的縫封起來。',
    facts: [{ text: '裡外抹上松香', status: 'explicit', refs: ['創6:14'], q: '裡外抹上松香' }],
  },
  {
    id: 'o-window', deck: 'out', at: [-32.5, 12, -12.2], title: '窗戶',
    text: '挪亞後來打開的那扇窗。位置是示意。',
    facts: [{ text: '挪亞開了窗戶', status: 'explicit', refs: ['創8:6'], q: '挪亞開了方舟的窗戶' }],
  },
  {
    id: 'o-tsohar', deck: 'out', at: [30, 14.4, 0], title: '透光處',
    text: '屋脊蓋板架高一肘，留出一整條開口。',
    facts: [{ text: '上邊留透光處，高一肘', status: 'explicit', refs: ['創6:16'], q: '方舟上邊要留透光處，高一肘' }],
  },
  {
    id: 'o-cover', deck: 'out', at: [0, 13.6, -6], title: '方舟的蓋',
    text: '水乾了以後，挪亞撤去方舟的蓋往外看。網站把這一段屋頂做成可以拆下來。',
    facts: [{ text: '撤去方舟的蓋', status: 'explicit', refs: ['創8:13'], q: '挪亞撤去方舟的蓋觀看' }],
  },
];
