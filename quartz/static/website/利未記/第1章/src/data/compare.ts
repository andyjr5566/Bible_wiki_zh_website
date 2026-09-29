import type { Fact, OfferingId } from './types';

const f = (text: string, status: Fact['status'], refs: string[] = [], q?: string): Fact => ({ text, status, refs, q });

export interface CompareRow {
  id: string;
  label: string;
  cells: Record<OfferingId, Fact>;
}

export const COMPARE: CompareRow[] = [
  {
    id: 'blood', label: '流不流血', cells: {
      burnt: f('流血', 'explicit', ['利1:5'], '要奉上血'),
      grain: f('不流血，五祭中唯一', 'synthesis', ['利2:1-16']),
      peace: f('流血', 'explicit', ['利3:2'], '要把血灑在壇的周圍'),
      sin: f('流血（最窮的人可改獻細麵）', 'synthesis', ['利4:5', '利5:11']),
      guilt: f('流血', 'explicit', ['利7:2'], '其血，祭司要灑在壇的周圍'),
    },
  },
  {
    id: 'bring', label: '帶什麼來', cells: {
      burnt: f('公牛；公綿羊或公山羊；斑鳩或雛鴿', 'explicit', ['利1:3', '利1:10', '利1:14']),
      grain: f('細麵、油、乳香；或爐烤、鐵鏊、煎盤做的無酵餅；或初熟的禾穗', 'explicit', ['利2:1-16']),
      peace: f('牛、綿羊、山羊', 'explicit', ['利3:1', '利3:6', '利3:12']),
      sin: f('看是誰犯罪：公牛犢、公山羊、母山羊或母綿羊羔；再窮可獻兩隻鳥或細麵', 'explicit', ['利4:3', '利4:23', '利4:28', '利4:32', '利5:7', '利5:11']),
      guilt: f('只有公綿羊', 'explicit', ['利5:15', '利5:18', '利6:6'], '沒有殘疾的公綿羊'),
    },
  },
  {
    id: 'sex', label: '公的還是母的', cells: {
      burnt: f('牛、羊要公的；鳥沒有規定', 'synthesis', ['利1:3', '利1:10', '利1:14']),
      grain: f('不適用', 'synthesis', ['利2:1']),
      peace: f('公母都可以', 'explicit', ['利3:1'], '無論是公的是母的'),
      sin: f('祭司、會眾、官長用公的；百姓用母的', 'synthesis', ['利4:3', '利4:23', '利4:28', '利4:32']),
      guilt: f('公綿羊', 'explicit', ['利5:15'], '公綿羊'),
    },
  },
  {
    id: 'will', label: '自願還是必須', cells: {
      burnt: f('自願：「若有人獻」', 'explicit', ['利1:2'], '你們中間若有人獻供物給耶和華'),
      grain: f('自願：「若有人獻」', 'explicit', ['利2:1'], '若有人獻素祭為供物給耶和華'),
      peace: f('自願：感謝、還願、甘心', 'explicit', ['利7:12', '利7:16'], '或是甘心獻的'),
      sin: f('必須：誤犯了罪就「當」獻', 'explicit', ['利4:3'], '就當為他所犯的罪'),
      guilt: f('必須，還要先賠償', 'explicit', ['利5:16', '利6:5']),
    },
  },
  {
    id: 'hands', label: '按手', cells: {
      burnt: f('牛要按手；羊和鳥的段落沒寫', 'synthesis', ['利1:4', '利1:10-17']),
      grain: f('經文沒提', 'not_stated', ['利2:1-16']),
      peace: f('要按手', 'explicit', ['利3:2', '利3:8', '利3:13'], '他要按手在供物的頭上'),
      sin: f('要按手；全會眾由長老代表', 'explicit', ['利4:4', '利4:15'], '會中的長老就要在耶和華面前按手在牛的頭上'),
      guilt: f('條例沒提', 'not_stated', ['利7:1-7']),
    },
  },
  {
    id: 'bloodway', label: '血怎麼處理', cells: {
      burnt: f('灑在壇的周圍（鳥：流在壇的旁邊）', 'explicit', ['利1:5', '利1:15'], '把血灑在會幕門口、壇的周圍'),
      grain: f('沒有血', 'synthesis', ['利2:1-16']),
      peace: f('灑在壇的周圍', 'explicit', ['利3:2'], '要把血灑在壇的周圍'),
      sin: f('抹燔祭壇的四角、倒在壇腳；大祭司和會眾的要帶進會幕，對幔子彈七次、抹香壇四角', 'explicit', ['利4:6-7', '利4:25'], '對著聖所的幔子彈血七次'),
      guilt: f('灑在壇的周圍', 'explicit', ['利7:2'], '其血，祭司要灑在壇的周圍'),
    },
  },
  {
    id: 'altar', label: '燒在壇上的', cells: {
      burnt: f('全部（皮除外）', 'synthesis', ['利1:9', '利7:8'], '把一切全燒在壇上'),
      grain: f('一把細麵、些油、所有的乳香', 'explicit', ['利2:2'], '取出一把來，並取些油和所有的乳香'),
      peace: f('脂油、腰子、肝上的網子（綿羊加肥尾巴）', 'explicit', ['利3:3-5', '利3:9']),
      sin: f('脂油等，和平安祭一樣', 'explicit', ['利4:8-10', '利4:26'], '與平安祭公牛上所取的一樣'),
      guilt: f('肥尾巴、脂油、腰子、肝上的網子', 'explicit', ['利7:3-5'], '又要將肥尾巴和蓋臟的脂油'),
    },
  },
  {
    id: 'priest', label: '祭司得到的', cells: {
      burnt: f('皮', 'explicit', ['利7:8'], '要親自得他所獻那燔祭牲的皮'),
      grain: f('剩下的全部', 'explicit', ['利2:3'], '素祭所剩的要歸給亞倫和他的子孫'),
      peace: f('胸（眾祭司）、右腿（灑血的祭司）', 'explicit', ['利7:31-33'], '但胸要歸亞倫和他的子孫'),
      sin: f('祭肉（血帶進會幕的除外）', 'explicit', ['利6:26', '利6:30'], '為贖罪獻這祭的祭司要吃'),
      guilt: f('祭肉', 'explicit', ['利7:6-7'], '獻贖愆祭贖罪的祭司要得這祭物'),
    },
  },
  {
    id: 'offerer', label: '獻祭者得到的', cells: {
      burnt: f('沒有', 'synthesis', ['利1:9']),
      grain: f('沒有', 'synthesis', ['利2:3']),
      peace: f('其餘的肉，和潔淨的人同吃', 'synthesis', ['利7:15-20'], '凡潔淨的人都要吃'),
      sin: f('沒有', 'synthesis', ['利6:26-29']),
      guilt: f('沒有，還要賠償加五分之一', 'synthesis', ['利5:16', '利6:5']),
    },
  },
  {
    id: 'outside', label: '營外燒掉的', cells: {
      burnt: f('只有每天的灰', 'explicit', ['利6:11'], '把灰拿到營外潔淨之處'),
      grain: f('沒有', 'synthesis', ['利2:1-16']),
      peace: f('第三天還剩的肉（經文沒說在哪裡燒）', 'explicit', ['利7:17'], '到第三天要用火焚燒'),
      sin: f('血帶進會幕的，整隻公牛燒在營外', 'explicit', ['利4:12', '利4:21'], '要搬到營外潔淨之地、倒灰之所，用火燒在柴上'),
      guilt: f('沒有', 'synthesis', ['利7:1-7']),
    },
  },
  {
    id: 'when', label: '吃的期限', cells: {
      burnt: f('不吃', 'synthesis', ['利1:9']),
      grain: f('經文沒規定', 'not_stated', ['利6:14-18']),
      peace: f('感謝祭當天；還願、甘心的可到第二天', 'explicit', ['利7:15-16'], '所剩下的第二天也可以吃'),
      sin: f('經文沒規定', 'not_stated', ['利6:24-30']),
      guilt: f('經文沒規定', 'not_stated', ['利7:1-7']),
    },
  },
  {
    id: 'holy', label: '「至聖」嗎', cells: {
      burnt: f('經文沒這樣稱', 'not_stated', ['利1:1-17']),
      grain: f('至聖', 'explicit', ['利2:3'], '這是獻與耶和華的火祭中為至聖的'),
      peace: f('經文沒這樣稱', 'not_stated', ['利3:1-17']),
      sin: f('至聖', 'explicit', ['利6:25'], '這是至聖的'),
      guilt: f('至聖', 'explicit', ['利7:1'], '這祭是至聖的'),
    },
  },
  {
    id: 'aroma', label: '稱為「馨香」', cells: {
      burnt: f('是', 'explicit', ['利1:9'], '馨香的火祭'),
      grain: f('是', 'explicit', ['利2:2'], '馨香的火祭'),
      peace: f('是', 'explicit', ['利3:5'], '馨香的火祭'),
      sin: f('只有百姓那一段', 'explicit', ['利4:31'], '在耶和華面前作為馨香的祭'),
      guilt: f('經文沒這樣稱', 'not_stated', ['利7:1-7']),
    },
  },
  {
    id: 'poor', label: '窮人的替代', cells: {
      burnt: f('斑鳩或雛鴿', 'explicit', ['利1:14'], '就要獻斑鳩或是雛鴿為供物'),
      grain: f('沒有分級', 'synthesis', ['利2:1-16']),
      peace: f('沒有列出鳥', 'not_stated', ['利3:1-16']),
      sin: f('兩隻鳥；再不夠，細麵', 'explicit', ['利5:7', '利5:11'], '他的力量若不夠獻一隻羊羔'),
      guilt: f('沒有，一律公綿羊', 'synthesis', ['利5:15', '利5:18', '利6:6']),
    },
  },
];

/** 分份圖：每一種祭，東西最後到了哪裡（以最常見的分支為代表） */
export type Dest = 'god' | 'priest' | 'offerer' | 'outside';
export const DEST_LABEL: Record<Dest, string> = {
  god: '燒在壇上',
  priest: '歸祭司',
  offerer: '獻祭者吃',
  outside: '營外燒掉',
};

export const PORTIONS: Record<OfferingId, Record<Dest, string[]>> = {
  burnt: { god: ['整隻'], priest: ['皮'], offerer: [], outside: ['灰（隔天）'] },
  grain: { god: ['一把', '油', '全部乳香'], priest: ['其餘的'], offerer: [], outside: [] },
  peace: { god: ['脂油', '腰子', '肝網'], priest: ['胸', '右腿'], offerer: ['其餘的肉'], outside: ['第三天剩的'] },
  sin: { god: ['脂油', '腰子', '肝網'], priest: ['祭肉（官長、百姓）'], offerer: [], outside: ['整隻公牛（大祭司、會眾）'] },
  guilt: { god: ['肥尾巴', '脂油', '腰子', '肝網'], priest: ['祭肉'], offerer: [], outside: [] },
};
