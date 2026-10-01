import { OFFERING_BY_ID } from './offerings';
import type { Fact, OfferingId, Ref } from './types';

/**
 * 故事線：照利未記 1–9 章自己的順序分幕。
 * 每一幕上層是重點（任何人都看得懂），下層是可展開的細節。
 * 這裡的每一句話和其他資料一樣進資料閘門（registry.ts → data.test.ts）。
 */

const f = (text: string, status: Fact['status'], refs: Ref[] = [], q?: string): Fact => ({ text, status, refs, q });

export type SceneId =
  | 'intro' | OfferingId | 'manual' | 'ordination' | 'eighth' | 'review' | 'voices';

export type SceneGroup = 'start' | 'offerings' | 'priests' | 'end';

export interface Scene {
  id: SceneId;
  /** 進度列上的短名 */
  short: string;
  /** 經文範圍，給一般讀者看的寫法 */
  range: string;
  group: SceneGroup;
  /** 原型階段：還沒做好的幕顯示預告 */
  ready: boolean;
  /** 預告頁要列出：這一幕會放哪些東西 */
  plan?: string[];
}

export const GROUP_LABEL: Record<SceneGroup, string> = {
  start: '開場',
  offerings: '五種祭（利1:1–6:7）',
  priests: '祭司（利6:8–9章）',
  end: '收尾',
};

export const SCENES: Scene[] = [
  { id: 'intro', short: '開場', range: '出40・利1:1', group: 'start', ready: true },
  { id: 'burnt', short: '燔祭', range: '利1', group: 'offerings', ready: true },
  { id: 'grain', short: '素祭', range: '利2', group: 'offerings', ready: true },
  { id: 'peace', short: '平安祭', range: '利3', group: 'offerings', ready: true },
  { id: 'sin', short: '贖罪祭', range: '利4:1–5:13', group: 'offerings', ready: true },
  { id: 'guilt', short: '贖愆祭', range: '利5:14–6:7', group: 'offerings', ready: true },
  { id: 'manual', short: '給祭司的條例', range: '利6:8–7:38', group: 'priests', ready: true },
  { id: 'ordination', short: '承接聖職', range: '利8', group: 'priests', ready: true },
  { id: 'eighth', short: '第八天', range: '利9', group: 'priests', ready: true },
  { id: 'review', short: '複習', range: '利1–9', group: 'end', ready: true },
  { id: 'voices', short: '各家怎麼讀', range: '', group: 'end', ready: true },
];

export const SCENE_BY_ID = Object.fromEntries(SCENES.map((s) => [s.id, s])) as Record<SceneId, Scene>;

/* ================================================================== 開場 */

export const INTRO = {
  title: '會幕立起來以後',
  beats: [
    f('出埃及記最後，會幕立起來了。雲彩遮蓋會幕，耶和華的榮光充滿帳幕，連摩西都不能進去。', 'explicit',
      ['出40:34-35'], '摩西不能進會幕'),
    f('利未記第一句接著說：神從會幕裡呼叫摩西，要他告訴以色列人怎樣獻供物。', 'explicit',
      ['利1:1-2'], '耶和華從會幕中呼叫摩西'),
    f('1–7 章講百姓帶什麼來、怎麼獻；8–9 章講亞倫和他的兒子怎樣成為祭司，第一次在壇前供職。', 'synthesis',
      ['利1:2', '利8:1-2', '利9:1']),
    f('到第 9 章結尾，摩西、亞倫進入會幕，又出來為百姓祝福，耶和華的榮光就向眾民顯現。', 'explicit',
      ['利9:23'], '耶和華的榮光就向眾民顯現'),
  ],
  /** 「怎麼讀這個網站」 */
  howto: [
    '一幕講一件事，照利未記的順序往下走。上面是重點，下面可以展開細節。',
    '句子後面的「利1:3」可以點，會跳出和合本經文。',
    '沒有標記的句子，經文直接這樣寫。標了「綜合整理」的，是把幾節放在一起看出來的；標了「經文沒說」的，經文在那裡沒有交代。',
    '註釋家的不同讀法，全部集中在最後一幕「各家怎麼讀」。',
  ],
};

/** 開場的路線圖：1–9 章分成五段 */
export const ROADMAP: { range: string; title: string; text: string; scenes: SceneId[] }[] = [
  { range: '利1–3', title: '自願獻的祭', text: '經文說「若有人獻」，沒有規定一定要獻。', scenes: ['burnt', 'grain', 'peace'] },
  { range: '利4:1–6:7', title: '犯了錯要獻的祭', text: '誤犯了罪、或虧負了人，就「當」獻。', scenes: ['sin', 'guilt'] },
  { range: '利6:8–7:38', title: '給祭司的條例', text: '同樣五種祭再講一遍，這次是對亞倫和他的子孫說。', scenes: ['manual'] },
  { range: '利8', title: '七天承接聖職', text: '摩西為亞倫和他的兒子穿聖衣、膏抹、獻祭。', scenes: ['ordination'] },
  { range: '利9', title: '第八天', text: '亞倫第一次自己獻祭，榮光向眾民顯現。', scenes: ['eighth'] },
];

export const ROADMAP_FACTS: Fact[] = [
  f('自願獻的祭', 'explicit', ['利1:2'], '你們中間若有人獻供物給耶和華'),
  f('犯了錯要獻的祭', 'explicit', ['利4:3'], '就當為他所犯的罪'),
  f('給祭司的條例', 'explicit', ['利6:9'], '你要吩咐亞倫和他的子孫說'),
  f('七天承接聖職', 'explicit', ['利8:33'], '因為主叫你們七天承接聖職'),
  f('第八天', 'explicit', ['利9:1'], '到了第八天'),
];

/* ============================================================ 每種祭的重點 */

export type Lane = 'offerer' | 'priest' | 'unstated';

/** 「誰做什麼」兩線圖的一格 */
export interface LaneStep {
  who: Lane;
  label: string;
  fact: Fact;
}

export interface KeyCard {
  id: 'when' | 'bring' | 'who' | 'where';
  title: string;
  lines: Fact[];
}

export interface OfferingKeys {
  offering: OfferingId;
  /** 這一幕的經文範圍（讀經文用） */
  read: { ch: number; from: number; to: number; title: string }[];
  cards: KeyCard[];
  lanes?: { caption: string; steps: LaneStep[]; foot?: Fact };
}

const ls = (who: Lane, label: string, ref: Ref, q?: string): LaneStep => ({ who, label, fact: f(label, 'explicit', [ref], q) });

export const OFFERING_KEYS: Partial<Record<OfferingId, OfferingKeys>> = {
  burnt: {
    offering: 'burnt',
    read: [
      { ch: 1, from: 1, to: 17, title: '利未記第 1 章：燔祭（獻祭的人這邊）' },
      { ch: 6, from: 8, to: 13, title: '利未記 6:8-13：燔祭的條例（祭司這邊）' },
    ],
    cards: [
      { id: 'when', title: '什麼時候獻', lines: [
        f('自願的。經文說「若有人獻」，沒有指定要為哪一件事獻。', 'explicit', ['利1:2'], '你們中間若有人獻供物給耶和華'),
        f('獻上以後，「燔祭便蒙悅納，為他贖罪」。', 'explicit', ['利1:4'], '燔祭便蒙悅納，為他贖罪'),
      ] },
      { id: 'bring', title: '帶什麼來', lines: [
        f('三種，由大到小：公牛；公綿羊或公山羊；斑鳩或雛鴿。', 'explicit', ['利1:3', '利1:10', '利1:14']),
        f('牛和羊都要公的、沒有殘疾；鳥的段落沒有這兩項要求。', 'synthesis', ['利1:3', '利1:10', '利1:14']),
      ] },
      { id: 'who', title: '誰做什麼', lines: [
        f('宰殺、剝皮、切塊，是獻祭的人自己做的；血和壇上的事，歸祭司。', 'explicit', ['利1:5-9'], '他要在耶和華面前宰公牛'),
      ] },
      { id: 'where', title: '最後去了哪裡', lines: [
        f('整隻燒在壇上，只有皮留下，歸主持的那位祭司。', 'explicit', ['利1:9', '利7:8'], '要親自得他所獻那燔祭牲的皮'),
        f('獻祭的人什麼都不留。', 'synthesis', ['利1:9']),
        f('第二天早晨，祭司把灰拿到營外潔淨的地方。', 'explicit', ['利6:10-11'], '把灰拿到營外潔淨之處'),
      ] },
    ],
    lanes: {
      caption: '以公牛為例（利1:3-9）',
      steps: [
        ls('offerer', '牽到會幕門口', '利1:3', '在會幕門口獻一隻沒有殘疾的公牛'),
        ls('offerer', '按手在牛頭上', '利1:4', '他要按手在燔祭牲的頭上'),
        ls('offerer', '宰牛', '利1:5', '他要在耶和華面前宰公牛'),
        ls('priest', '把血灑在壇的周圍', '利1:5', '把血灑在會幕門口、壇的周圍'),
        ls('offerer', '剝皮、切塊', '利1:6', '那人要剝去燔祭牲的皮'),
        ls('priest', '放火、擺柴', '利1:7', '把火放在壇上，把柴擺在火上'),
        ls('priest', '擺上肉塊、頭、脂油', '利1:8', '要把肉塊和頭並脂油擺在壇上火的柴上'),
        ls('unstated', '臟腑和腿用水洗', '利1:9', '但燔祭的臟腑與腿要用水洗'),
        ls('priest', '全部燒在壇上', '利1:9', '祭司就要把一切全燒在壇上'),
      ],
      foot: f('獻鳥的時候不一樣：從揪頭、放血到焚燒，幾乎全由祭司做。', 'synthesis', ['利1:15-17'], '祭司要把鳥拿到壇前'),
    },
  },
  grain: {
    offering: 'grain',
    read: [
      { ch: 2, from: 1, to: 16, title: '利未記第 2 章：素祭（獻祭的人這邊）' },
      { ch: 6, from: 14, to: 23, title: '利未記 6:14-23：素祭的條例（祭司這邊）' },
    ],
    cards: [
      { id: 'when', title: '什麼時候獻', lines: [
        f('自願的。經文說「若有人獻素祭」，沒有指定場合。', 'explicit', ['利2:1'], '若有人獻素祭為供物給耶和華'),
        f('五種祭裡，只有素祭不用牲畜、不流血。', 'synthesis', ['利2:1-16']),
      ] },
      { id: 'bring', title: '帶什麼來', lines: [
        f('細麵、油、乳香；或在爐中、鐵鏊上、煎盤裡做好的無酵餅；或初熟的禾穗。', 'explicit', ['利2:1', '利2:4', '利2:5', '利2:7', '利2:14']),
        f('不可有酵、不可有蜜；一定要加鹽。', 'explicit', ['利2:11', '利2:13'], '一切的供物都要配鹽而獻'),
      ] },
      { id: 'who', title: '誰做什麼', lines: [
        f('獻祭的人把素祭帶到祭司那裡；祭司從中取出一把，作為紀念燒在壇上。', 'explicit', ['利2:2'], '帶到亞倫子孫作祭司的那裡'),
      ] },
      { id: 'where', title: '最後去了哪裡', lines: [
        f('一把細麵、些油和所有的乳香燒在壇上。', 'explicit', ['利2:2'], '取出一把來，並取些油和所有的乳香'),
        f('剩下的歸亞倫和他的子孫，是至聖的。', 'explicit', ['利2:3'], '素祭所剩的要歸給亞倫和他的子孫'),
        f('祭司為自己獻的素祭例外：全部燒掉，不可吃。', 'explicit', ['利6:23'], '祭司的素祭都要燒了，卻不可吃'),
      ] },
    ],
    lanes: {
      caption: '以生細麵為例（利2:1-3）',
      steps: [
        ls('offerer', '細麵澆油、加乳香', '利2:1', '要用細麵澆上油，加上乳香'),
        ls('offerer', '帶到祭司那裡', '利2:2', '帶到亞倫子孫作祭司的那裡'),
        ls('priest', '取出一把作為紀念', '利2:2', '取出一把來，並取些油和所有的乳香'),
        ls('priest', '燒在壇上', '利2:2', '燒在壇上'),
        ls('priest', '剩下的歸祭司', '利2:3', '素祭所剩的要歸給亞倫和他的子孫'),
      ],
      foot: f('祭司自己獻的素祭不一樣：全部燒給耶和華，祭司不可吃。', 'explicit', ['利6:22-23'], '要全燒給耶和華'),
    },
  },
  peace: {
    offering: 'peace',
    read: [
      { ch: 3, from: 1, to: 17, title: '利未記第 3 章：平安祭（獻祭的人這邊）' },
      { ch: 7, from: 11, to: 21, title: '利未記 7:11-21：平安祭的條例' },
      { ch: 7, from: 28, to: 34, title: '利未記 7:28-34：搖祭的胸、舉祭的腿' },
    ],
    cards: [
      { id: 'when', title: '什麼時候獻', lines: [
        f('自願的：為感謝、為還願，或甘心獻上。', 'explicit', ['利7:12', '利7:16'], '若所獻的是為還願，或是甘心獻的'),
        f('為感謝獻的，還要同獻無酵的餅，加上有酵的餅。', 'explicit', ['利7:12-13'], '要用有酵的餅和為感謝獻的平安祭'),
      ] },
      { id: 'bring', title: '帶什麼來', lines: [
        f('牛、綿羊或山羊，公的母的都可以，但要沒有殘疾。', 'explicit', ['利3:1', '利3:6', '利3:12'], '無論是公的是母的'),
        f('條例只列牛、綿羊、山羊，沒有列鳥。', 'synthesis', ['利3:1-16']),
      ] },
      { id: 'who', title: '誰做什麼', lines: [
        f('按手、宰牲是獻祭的人做的；血灑在壇的周圍、脂油燒在壇上，是祭司做的。', 'explicit', ['利3:2-5'], '他要按手在供物的頭上'),
      ] },
      { id: 'where', title: '最後去了哪裡', lines: [
        f('脂油和腰子燒在壇上：「脂油都是耶和華的」。', 'explicit', ['利3:16'], '脂油都是耶和華的'),
        f('胸歸眾祭司，右腿歸灑血的那位祭司。', 'explicit', ['利7:31-33'], '但胸要歸亞倫和他的子孫'),
        f('其餘的肉，獻祭的人和潔淨的人一起吃；感謝祭當天吃完，還願和甘心獻的可以吃到第二天。', 'explicit', ['利7:15-16'], '所剩下的第二天也可以吃'),
        f('到第三天還剩下的，要用火燒掉。', 'explicit', ['利7:17'], '到第三天要用火焚燒'),
      ] },
    ],
    lanes: {
      caption: '以牛為例（利3:1-5；7:29-33）',
      steps: [
        ls('offerer', '牽到會幕門口', '利3:1', '必用沒有殘疾的獻在耶和華面前'),
        ls('offerer', '按手在頭上', '利3:2', '他要按手在供物的頭上'),
        ls('offerer', '宰於會幕門口', '利3:2', '宰於會幕門口'),
        ls('priest', '把血灑在壇的周圍', '利3:2', '要把血灑在壇的周圍'),
        ls('offerer', '親手帶來脂油和胸', '利7:30', '他親手獻給耶和華的火祭'),
        ls('unstated', '胸作搖祭', '利7:30', '好把胸在耶和華面前作搖祭'),
        ls('priest', '脂油燒在壇上', '利3:5', '要把這些燒在壇的燔祭上'),
        ls('priest', '胸和右腿歸祭司', '利7:31', '但胸要歸亞倫和他的子孫'),
        ls('offerer', '其餘的肉一起吃', '利7:15', '要在獻的日子吃'),
      ],
      foot: f('五種祭裡，只有平安祭的肉，獻祭的人自己也吃得到。', 'synthesis', ['利7:15-20']),
    },
  },
  sin: {
    offering: 'sin',
    read: [
      { ch: 4, from: 1, to: 35, title: '利未記第 4 章：四種人犯了罪' },
      { ch: 5, from: 1, to: 13, title: '利未記 5:1-13：力量不夠的人' },
      { ch: 6, from: 24, to: 30, title: '利未記 6:24-30：贖罪祭的條例' },
    ],
    cards: [
      { id: 'when', title: '什麼時候獻', lines: [
        f('不是自願的：誤犯了耶和華吩咐不可行的事，一知道了就要獻。', 'explicit', ['利4:2', '利4:14'], '若有人在耶和華所吩咐不可行的什麼事上誤犯了一件'),
        f('每一段都以同一句話收尾：祭司為他贖罪，他必蒙赦免。', 'explicit', ['利4:20', '利4:26', '利4:31', '利4:35'], '他們必蒙赦免'),
      ] },
      { id: 'bring', title: '帶什麼來', lines: [
        f('看是誰犯了罪：受膏的祭司和全會眾獻公牛犢，官長獻公山羊，百姓獻母山羊或母綿羊羔。', 'explicit', ['利4:3', '利4:14', '利4:23', '利4:28', '利4:32']),
        f('百姓力量不夠，可以改獻兩隻鳥；連鳥也不夠，就獻細麵。', 'explicit', ['利5:7', '利5:11'], '他的力量若不夠獻一隻羊羔'),
      ] },
      { id: 'who', title: '誰做什麼', lines: [
        f('按手、宰牲是獻祭的人做的；血和脂油歸祭司處理。全會眾犯罪，由會中的長老代表按手。', 'explicit', ['利4:15'], '會中的長老就要在耶和華面前按手在牛的頭上'),
      ] },
      { id: 'where', title: '血走多遠、肉歸誰', lines: [
        f('受膏的祭司和全會眾：血帶進會幕，對著幔子彈七次，抹在香壇的四角。', 'explicit', ['利4:6-7'], '對著聖所的幔子彈血七次'),
        f('官長和百姓：血只抹在燔祭壇的四角，其餘倒在壇腳。', 'explicit', ['利4:25', '利4:30'], '抹在燔祭壇的四角上'),
        f('血帶進會幕的，整隻公牛搬到營外燒掉，誰都不可吃；其餘的，祭肉歸辦這祭的祭司。', 'explicit', ['利4:11-12', '利6:26', '利6:30'], '那肉都不可吃，必用火焚燒'),
      ] },
    ],
    lanes: {
      caption: '以官長為例（利4:22-26）',
      steps: [
        ls('offerer', '牽來公山羊', '利4:23', '就要牽一隻沒有殘疾的公山羊為供物'),
        ls('offerer', '按手在羊頭上', '利4:24', '按手在羊的頭上'),
        ls('offerer', '在宰燔祭牲的地方宰', '利4:24', '宰燔祭牲的地方'),
        ls('priest', '血抹在燔祭壇的四角', '利4:25', '抹在燔祭壇的四角上'),
        ls('priest', '其餘的血倒在壇腳', '利4:25', '壇的腳那裡'),
        ls('priest', '脂油燒在壇上', '利4:26', '所有的脂油，祭司都要燒在壇上'),
        ls('priest', '祭司吃祭肉', '利6:26', '為贖罪獻這祭的祭司要吃'),
      ],
      foot: f('受膏的祭司和全會眾犯罪時，血要帶進會幕，整隻公牛搬到營外燒掉。', 'explicit', ['利4:5-12'], '要取些公牛的血帶到會幕'),
    },
  },
  guilt: {
    offering: 'guilt',
    read: [
      { ch: 5, from: 14, to: 19, title: '利未記 5:14-19：在聖物上有差錯' },
      { ch: 6, from: 1, to: 7, title: '利未記 6:1-7：虧負了鄰舍' },
      { ch: 7, from: 1, to: 7, title: '利未記 7:1-7：贖愆祭的條例' },
    ],
    cards: [
      { id: 'when', title: '什麼時候獻', lines: [
        f('不是自願的：在耶和華的聖物上有了差錯，或虧負了鄰舍。', 'explicit', ['利5:15', '利6:2'], '干犯耶和華'),
        f('經文說，虧負鄰舍也就是「干犯耶和華」。', 'explicit', ['利6:2'], '干犯耶和華'),
      ] },
      { id: 'bring', title: '帶什麼來', lines: [
        f('一律是一隻沒有殘疾的公綿羊，照估定的價；沒有替代的鳥或細麵。', 'synthesis', ['利5:15', '利5:18', '利6:6']),
        f('虧欠的要如數歸還，另外加上五分之一。', 'explicit', ['利5:16', '利6:5'], '另外加上五分之一'),
      ] },
      { id: 'who', title: '誰做什麼', lines: [
        f('先賠償，再牽公綿羊來；宰牲、灑血、燒脂油的作法，和燔祭、平安祭一樣。', 'synthesis', ['利6:5-6', '利7:2-5']),
      ] },
      { id: 'where', title: '最後去了哪裡', lines: [
        f('肥尾巴和脂油燒在壇上。', 'explicit', ['利7:3-5'], '又要將肥尾巴和蓋臟的脂油'),
        f('祭肉是至聖的，歸辦這祭的祭司，在聖處吃。', 'explicit', ['利7:6-7'], '要在聖處吃，是至聖的'),
        f('贖罪祭怎樣，贖愆祭也是怎樣，兩個祭是一個條例。', 'explicit', ['利7:7'], '兩個祭是一個條例'),
      ] },
    ],
    lanes: {
      caption: '以虧負鄰舍為例（利6:1-7；7:1-7）',
      steps: [
        ls('offerer', '如數歸還，另加五分之一', '利6:5', '另外加上五分之一'),
        ls('offerer', '牽公綿羊來', '利6:6', '羊群中一隻沒有殘疾的公綿羊'),
        ls('unstated', '在宰燔祭牲的地方宰', '利7:2', '人在哪裡宰燔祭牲，也要在那裡宰贖愆祭牲'),
        ls('priest', '血灑在壇的周圍', '利7:2', '其血，祭司要灑在壇的周圍'),
        ls('priest', '脂油燒在壇上', '利7:5', '祭司要在壇上焚燒'),
        ls('priest', '祭司在聖處吃祭肉', '利7:6', '要在聖處吃'),
      ],
      foot: f('先賠償、再獻祭：查出有罪的那天，就要交還本主。', 'explicit', ['利6:5'], '在查出他有罪的日子要交還本主'),
    },
  },
};

/** 給資料閘門：故事線新增的所有事實 */
export function storyFacts(): Fact[] {
  const out: Fact[] = [...INTRO.beats, ...ROADMAP_FACTS];
  for (const k of Object.values(OFFERING_KEYS)) {
    if (!k) continue;
    for (const c of k.cards) out.push(...c.lines);
    if (k.lanes) {
      out.push(...k.lanes.steps.map((s) => s.fact));
      if (k.lanes.foot) out.push(k.lanes.foot);
    }
  }
  return out;
}

/** 讀經文用：這一幕之前、之後的幕 */
export function neighbors(id: SceneId): { prev?: Scene; next?: Scene } {
  const i = SCENES.findIndex((s) => s.id === id);
  return { prev: SCENES[i - 1], next: SCENES[i + 1] };
}

export const offeringName = (id: OfferingId) => OFFERING_BY_ID[id].name;
