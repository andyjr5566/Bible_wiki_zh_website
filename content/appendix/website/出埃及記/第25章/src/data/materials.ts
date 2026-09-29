import type { Fact, Voice } from './types';

/** 出25:3-7 百姓送來的禮物，各自在出25–27 變成了什麼 */
export interface Use {
  text: string;
  ref: string;
  q: string;
  /** 對應的導覽站 */
  stop?: string;
}

export interface Material {
  id: string;
  name: string;
  /** 出25:3-7 清單裡的經節 */
  listed: Fact;
  uses: Use[];
  swatch: string;
  voice?: Voice;
}

const listed = (ref: string, q: string): Fact => ({ text: '百姓送來的禮物之一', status: 'explicit', refs: [ref], q });

export const MATERIALS: Material[] = [
  {
    id: 'gold', name: '金子', swatch: '#d9ab3f', listed: listed('出25:3', '就是金、銀、銅'),
    uses: [
      { text: '約櫃裡外包精金', ref: '出25:11', q: '要裡外包上精金', stop: 'ark' },
      { text: '施恩座用精金做', ref: '出25:17', q: '要用精金做施恩座', stop: 'ark' },
      { text: '桌子包精金', ref: '出25:24', q: '要包上精金', stop: 'table' },
      { text: '燈臺用精金錘出', ref: '出25:31', q: '要用精金做一個燈臺', stop: 'lampstand' },
      { text: '豎板和閂都包金', ref: '出26:29', q: '板要用金子包裹', stop: 'boards' },
      { text: '連接幔子的五十個金鉤', ref: '出26:6', q: '又要做五十個金鉤', stop: 'layers' },
    ],
  },
  {
    id: 'silver', name: '銀子', swatch: '#c9d0d8', listed: listed('出25:3', '就是金、銀、銅'),
    uses: [
      { text: '豎板底下的銀座', ref: '出26:19', q: '四十個帶卯的銀座', stop: 'boards' },
      { text: '幔子四根柱子的銀座', ref: '出26:32', q: '柱子安在四個帶卯的銀座上', stop: 'veil' },
      { text: '院子柱子的鉤子和杆子', ref: '出27:10', q: '柱子上的鉤子和杆子都要用銀子做', stop: 'court' },
    ],
  },
  {
    id: 'bronze', name: '銅', swatch: '#b0703a', listed: listed('出25:3', '就是金、銀、銅'),
    uses: [
      { text: '燔祭壇包銅', ref: '出27:2', q: '用銅把壇包裹', stop: 'altar' },
      { text: '壇上一切的器具', ref: '出27:3', q: '壇上一切的器具都用銅做', stop: 'altar' },
      { text: '罩棚的五十個銅鉤', ref: '出26:11', q: '又要做五十個銅鉤', stop: 'layers' },
      { text: '門簾柱子的座', ref: '出26:37', q: '用銅鑄造五個帶卯的座', stop: 'door' },
      { text: '院子柱子的座與一切橛子', ref: '出27:19', q: '都要用銅做', stop: 'court' },
    ],
  },
  {
    id: 'threads', name: '藍色、紫色、朱紅色線', swatch: '#6d3f8f', listed: listed('出25:4', '藍色、紫色、朱紅色線'),
    uses: [
      { text: '最裡層的十幅幔子', ref: '出26:1', q: '這些幔子要用撚的細麻和藍色、紫色、朱紅色線製造', stop: 'layers' },
      { text: '隔開至聖所的幔子', ref: '出26:31', q: '你要用藍色、紫色、朱紅色線，和撚的細麻織幔子', stop: 'veil' },
      { text: '帳幕的門簾', ref: '出26:36', q: '你要拿藍色、紫色、朱紅色線，和撚的細麻', stop: 'door' },
      { text: '院子的門簾', ref: '出27:16', q: '要拿藍色、紫色、朱紅色線', stop: 'court' },
    ],
    voice: { who: 'GT《中文聖經註釋》', ch: 25, says: '這些線比金銀還貴。', quote: '比金銀銅還要值錢' },
  },
  {
    id: 'linen', name: '細麻', swatch: '#efe6d2', listed: listed('出25:4', '細麻'),
    uses: [
      { text: '最裡層的幔子', ref: '出26:1', q: '這些幔子要用撚的細麻', stop: 'layers' },
      { text: '院子四圍的帷子', ref: '出27:18', q: '帷子要用撚的細麻做', stop: 'court' },
    ],
  },
  {
    id: 'goathair', name: '山羊毛', swatch: '#4a3a2e', listed: listed('出25:4', '山羊毛'),
    uses: [{ text: '帳幕以上的罩棚，十一幅', ref: '出26:7', q: '你要用山羊毛織十一幅幔子', stop: 'layers' }],
  },
  {
    id: 'ramskin', name: '染紅的公羊皮', swatch: '#8c3b2e', listed: listed('出25:5', '染紅的公羊皮'),
    uses: [{ text: '罩棚的蓋', ref: '出26:14', q: '又要用染紅的公羊皮做罩棚的蓋', stop: 'layers' }],
  },
  {
    id: 'seacow', name: '海狗皮', swatch: '#6e6a62', listed: listed('出25:5', '海狗皮'),
    uses: [{ text: '最外層的頂蓋', ref: '出26:14', q: '再用海狗皮做一層罩棚上的頂蓋', stop: 'layers' }],
  },
  {
    id: 'acacia', name: '皂莢木', swatch: '#8a5a35', listed: listed('出25:5', '皂莢木'),
    uses: [
      { text: '約櫃', ref: '出25:10', q: '要用皂莢木做一櫃', stop: 'ark' },
      { text: '桌子', ref: '出25:23', q: '要用皂莢木做一張桌子', stop: 'table' },
      { text: '帳幕的豎板和閂', ref: '出26:15', q: '你要用皂莢木做帳幕的豎板', stop: 'boards' },
      { text: '燔祭壇', ref: '出27:1', q: '你要用皂莢木做壇', stop: 'altar' },
    ],
  },
  {
    id: 'oil', name: '點燈的油', swatch: '#c9b23a', listed: listed('出25:6', '點燈的油'),
    uses: [{ text: '搗成的清橄欖油，使燈常常點著', ref: '出27:20', q: '把那為點燈搗成的清橄欖油拿來給你', stop: 'lampstand' }],
  },
  {
    id: 'spices', name: '香料', swatch: '#9c6b3a', listed: listed('出25:6', '做膏油和香的香料'),
    uses: [
      { text: '聖膏油（做法在出30章）', ref: '出30:25', q: '按做香之法調和做成聖膏油' },
      { text: '香（做法在出30章）', ref: '出30:35', q: '按做香之法做成清淨聖潔的香' },
    ],
  },
  {
    id: 'stones', name: '紅瑪瑙與寶石', swatch: '#9c3f2c', listed: listed('出25:7', '紅瑪瑙與別樣的寶石'),
    uses: [{ text: '鑲在以弗得和胸牌上（祭司的衣服，出28章）', ref: '出25:7', q: '可以鑲嵌在以弗得和胸牌上' }],
  },
];

export const GIVING: Fact = {
  text: '凡甘心樂意的，就可以收下。',
  status: 'explicit',
  refs: ['出25:2'],
  q: '凡甘心樂意的，你們就可以收下歸我',
};

/** 金屬由外而內的階梯 */
export interface Zone {
  id: string;
  place: string;
  metal: string;
  swatch: string;
  fact: Fact;
}

export const ZONES: Zone[] = [
  { id: 'court', place: '院子', metal: '銅座、銀鉤', swatch: '#b0703a',
    fact: { text: '柱子的座是銅，鉤子和杆子是銀。', status: 'explicit', refs: ['出27:17'], q: '帶卯的座要用銅做' } },
  { id: 'altar', place: '燔祭壇', metal: '銅', swatch: '#b0703a',
    fact: { text: '整座壇包銅。', status: 'explicit', refs: ['出27:2'], q: '用銅把壇包裹' } },
  { id: 'walls', place: '帳幕的牆腳', metal: '銀', swatch: '#c9d0d8',
    fact: { text: '豎板插在銀座上。', status: 'explicit', refs: ['出26:19'], q: '四十個帶卯的銀座' } },
  { id: 'holy', place: '聖所', metal: '金', swatch: '#d9ab3f',
    fact: { text: '桌子包精金，板包金。', status: 'explicit', refs: ['出25:24', '出26:29'], q: '板要用金子包裹' } },
  { id: 'most', place: '至聖所', metal: '精金', swatch: '#f0c44c',
    fact: { text: '約櫃裡外包精金，施恩座整塊是精金。', status: 'explicit', refs: ['出25:11', '出25:17'], q: '要用精金做施恩座' } },
];
