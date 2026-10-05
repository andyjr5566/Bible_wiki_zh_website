import CANDIDATES from './candidates.json';
import { STATIONS } from './stations';
import type { Candidate, Voice } from './types';

/**
 * 每一站的位置。
 *
 * 經文只給站名，不給座標。候選現代地點與可信度分數取自 OpenBible.info 的 Bible Geocoding Data
 * （CC BY 4.0，https://www.openbible.info/geo/），由 scripts/build-geodata.mjs 抽成 candidates.json。
 * 知識庫的地點條目、FHL〈民圖五〉的說明是另一條線的說法，並列在資訊卡上，閘門逐字比對。
 *
 * 位置可信度（level）由分數機械推出，不手寫：
 *   高 ≥ 700、中 400–699、低 100–399、不詳 < 100。
 *   只知道「大概一帶」（center）的，最高只算「低」；代表點（representative point）最高算「中」。
 */
export type Level = 'high' | 'mid' | 'low' | 'none';
/**
 * site＝畫在候選遺址上；area＝只知道一帶；route＝沒有座標，依前後站畫在路線上；span＝一段範圍；
 * zone＝三十八年飄流那一段：來源說位置多半不詳，候選又分散，圖上畫在「可信候選的中間值」，
 *        並用一個很淡的圈圈出候選散布的範圍
 */
export type PosMode = 'site' | 'area' | 'route' | 'span' | 'zone';

/** 三十八年飄流中間的站（第 16–31 站）。FHL：「除了以甸迦別和加低斯兩地之外，其它的位置都無法確定」 */
export const WANDER = { from: 16, to: 31 } as const;
export const isWander = (n: number) => n >= WANDER.from && n <= WANDER.to;

/**
 * 「可能在這一帶」：把一站的可信候選取中間值，並算出圈住它們的範圍。
 *  - 可信候選：分數 > 0，而且不低於最高分的 35%（低分的雜訊候選不參與，但仍列在資訊卡）。
 *  - 中間值：分數加權平均。
 *  - 半徑（公里）：候選離中間值最遠的距離；OpenBible 的候選若自己就是「某點 N 公里內」，至少取 N；
 *    最小 8 公里，圈才看得見。
 */
export const ZONE_MIN_SCORE_RATIO = 0.35;
export const ZONE_MIN_R_KM = 8;
const KM_PER_DEG = 111;
const COS30 = Math.cos((30 * Math.PI) / 180);
export const kmBetween = (aLon: number, aLat: number, bLon: number, bLat: number) =>
  Math.hypot((aLon - bLon) * COS30 * KM_PER_DEG, (aLat - bLat) * KM_PER_DEG);

export interface Zone {
  lon: number;
  lat: number;
  rKm: number;
  /** 參與計算的候選 */
  used: Candidate[];
}

export function zoneOf(cands: Candidate[]): Zone | null {
  const pos = cands.filter((c) => c.score > 0);
  if (!pos.length) return null;
  const top = Math.max(...pos.map((c) => c.score));
  const used = pos.filter((c) => c.score >= top * ZONE_MIN_SCORE_RATIO);
  const w = used.reduce((s, c) => s + c.score, 0);
  const lon = used.reduce((s, c) => s + c.lon * c.score, 0) / w;
  const lat = used.reduce((s, c) => s + c.lat * c.score, 0) / w;
  const spread = Math.max(...used.map((c) => kmBetween(c.lon, c.lat, lon, lat)));
  const declared = Math.max(0, ...used.filter((c) => c.kind === 'center').map((c) => Number(/(\d+)\s*km/.exec(c.name)?.[1] ?? 0)));
  return { lon, lat, rKm: Math.max(spread, declared, ZONE_MIN_R_KM), used };
}

export interface OBEntry { friendly: string; slug: string; cands: Candidate[] }
export const OB_DATA = CANDIDATES as Record<string, OBEntry>;
export const obUrl = (key: string) => `https://www.openbible.info/geo/ancient/${OB_DATA[key].slug}/`;

/**
 * OpenBible 的候選名稱多半是英文短語：「within 50 km of Mithkah」「another name for Pelusium」。
 * 讀者看不懂，所以把這幾種句型換成中文；提到的地名若正好是本章的站，就用站名。
 * 遺址與乾河的名字（Tell Abu Sefeh、Wadi Refayid…）是現代地名，保留原文。
 */
const EN_TO_ZH: Record<string, string> = {
  ...Object.fromEntries(
    STATIONS.flatMap((s) => {
      const en = OB_DATA[s.key]?.friendly?.replace(/ \d+$/, '');
      return en ? [[en, s.name]] : [];
    }),
  ),
  'Mount Sinai': '西乃山',
  'Mount Hor': '何珥山',
  'Red Sea': '紅海',
};
const zhName = (en: string): string => {
  const z = EN_TO_ZH[en.replace(/ \d+$/, '')];
  return z ? `「${z}」` : en;
};

export function candLabel(name: string): string {
  let m = /^within (\d+) km of (.+)$/.exec(name);
  if (m) return `離${zhName(m[2])} ${m[1]} 公里內`;
  m = /^another name for (.+)$/.exec(name);
  if (m) return `${zhName(m[1])}的別名（同一個地點）`;
  m = /^about (\d+) km around (.+)$/.exec(name);
  if (m) return `${zhName(m[2])}周圍約 ${m[1]} 公里`;
  m = /^region around (.+)$/.exec(name);
  if (m) return `${m[1]} 一帶`;
  m = /^along (.+)$/.exec(name);
  if (m) return `沿 ${m[1]} 一帶`;
  m = /^plain near (.+)$/.exec(name);
  if (m) return `${m[1]} 附近的平原`;
  m = /^mouth of (.+)$/.exec(name);
  if (m) return `${m[1]} 的出口`;
  m = /^in (.+)$/.exec(name);
  if (m) return `在 ${m[1]}`;
  return name;
}

/**
 * 完整的地點條目：連到公開 GitHub 專案裡渲染好的網頁（不需要 Obsidian、任何裝置都打得開）。
 * 網站會部署到公開網域，所以不能連到只在本機有用的 obsidian:// 網址。
 */
// 知識庫網站的網址。換網域時建置前設 VITE_WIKI_BASE（例如 VITE_WIKI_BASE=https://example.org/wiki npm run build），不必改程式。
export const WIKI_BASE = ((import.meta.env?.VITE_WIKI_BASE as string | undefined) || 'https://andyjr5566.github.io/Bible_wiki_zh_website').replace(/\/+$/, '');
export const entryUrl = (entry: string): string => `${WIKI_BASE}/link_folder/${encodeURIComponent('地點')}/${encodeURIComponent(entry)}`;

export const LEVEL_LABEL: Record<Level, string> = { high: '高', mid: '中', low: '低', none: '不詳' };
export const LEVEL_HELP: Record<Level, string> = {
  high: '候選地點的綜合分數在 700 以上：來源大多同意這個地點。',
  mid: '分數 400–699：有一個比較被接受的候選，但仍有不同說法。',
  low: '分數 100–399：只有候選，彼此不一致，或只知道大概一帶。',
  none: '分數低於 100，或來源只給了一片水域：地圖上依前後站畫在路線上，位置不詳。',
};

const RANK: Record<Level, number> = { none: 0, low: 1, mid: 2, high: 3 };
const band = (score: number): Level => (score >= 700 ? 'high' : score >= 400 ? 'mid' : score >= 100 ? 'low' : 'none');
const cap = (l: Level, max: Level): Level => (RANK[l] > RANK[max] ? max : l);

export function levelOf(c: Candidate): Level {
  const b = band(c.score);
  if (c.kind === 'center') return cap(b, 'low');
  if (c.kind === 'representative point') return cap(b, 'mid');
  return b;
}

/**
 * 分數最高的候選就是預設位置，少數例外在這裡寫明理由（畫面與資訊卡都會顯示）。
 * 值是 candidates.json 裡該地名的候選序號（已依分數由高到低排）。
 */
export const PICK: Record<string, { i: number; why: string }> = {
  etham: {
    i: 3,
    why: '採 GT《舊約聖經背景註釋》的說法：以倘就是邊境堡壘西勒（Sile，古埃及名 Tjaru），而且要先到邊境堡壘、再「轉回」（出14:2）路線才說得通。GT 寫的是當時認為的位置阿布塞法遺址（Tell Abu Sefa）；埃及考古隊 1985–2015 年發掘後，2007 年確認西勒其實在附近的希布阿遺址（Tell Hebua），所以圖上畫在希布阿（OpenBible 列為「Tjaru 的別名」）。兩地相距不到 10 公里，其他候選都列在下面。',
  },
  eziongeber: {
    i: 1,
    why: '採克萊費遺址（Tell el-Kheleifeh）：維基百科整理的學界說法以它為準，知識庫 GT《舊約聖經背景註釋》也把它列在兩個候選的第一位，FHL〈民圖五〉並說以旬迦別的位置經考古學證實。OpenBible 分數較高的法老島（Jezirat Faraun）仍列在下面，爭議見最後的補充說明。',
  },
};

/**
 * 補充說明：有爭議的站，各家說法放在資訊卡最後。地圖上標的是較有公信力的說法（見 PICK 與預設規則），
 * 這裡交代還有哪些說法、為什麼有爭議。每一句都有出處：OpenBible 候選、知識庫條目、FHL〈民圖五〉、
 * 維基百科〈Stations of the Exodus〉的學界整理；逐站的考證見 位置考證.md。
 */
export const DISPUTES: Record<number, string> = {
  3: '以倘在哪裡沒有定論。維基百科整理的學界說法只說「可能靠近伊斯梅利亞」（Ismailia，也在候選中）；OpenBible 分數最高的說法是比東（Pithom）。本站依 GT 把以倘當作西勒，畫在考古確認的西勒所在地。',
  4: '密奪與過海地點各家說法不一（見「清單沒說的事」）。本站採 OpenBible 分數最高的 Tell el Herr，在北邊靠地中海一帶；下一站瑪拉的主流說法在蘇伊士灣東岸往南，所以兩站在圖上相距約 185 公里（中間是過海，民33:8 又走了三天的路程）。',
  8: 'OpenBible 前兩名分數接近：內陸的 Debbet er Ramleh（311）與蘇伊士灣東岸海岸平原的 El Marka（271），兩個都在下面的候選表。',
  9: '維基百科整理的學界說法作 Wadi Maghara；它和本站採用的 Serabit el Khadim 都在西乃西南部的古埃及綠松石礦區。Wadi Maghara 不在 OpenBible 的候選裡，所以沒有放上地圖。',
  12: '西乃山的位置，知識庫 GT 說學者提出的地點超過十二個。本站採傳統的摩西山（Jebel Musa），OpenBible 的其他候選都列在下面。',
  16: '候選之一「Rimmon 2」在別是巴附近，OpenBible 把它當成臨門帕烈的另一個名字，但它離前後站都很遠；依分數規則仍計入中間值，所以這一站的點偏北。',
  17: '候選之一是 OpenBible 認為同一地的「拉班」（申1:1），位置偏北；維基百科整理的說法另有 Wadi el-Beidha（已在候選中）或 Jebel Libni。',
  26: 'OpenBible 分數最高的說法把哈摩拿當作猶大南地的希實門（書15:27），另有押們（民34:4）、Qoseimeh 等候選；維基百科整理的說法是「可能是 Qeseimeh」。各說相差數十公里，圖上的中間值只是示意。',
  30: '維基百科整理的學界說法有兩個：亞拉巴谷的塔巴（Timna 以北），或埃及與以色列邊境、以拉他以南的塔巴；兩處都在下面的候選表（Et Taba、Taba），附近的 Ein Yotvata 也在。',
  32: '克萊費遺址從 1933 年起被考證為以旬迦別，但它的年代在 1985 年（Pratico）與 2014 年（Finkelstein）被重新評估，不再能對上所羅門時代的海港；另一個主要候選是亞喀巴灣裡的法老島（Jezirat Faraun），OpenBible 的分數較高。兩地相距約 15 公里。',
  34: '傳統（約瑟夫）把何珥山定在佩特拉附近的哈倫山（Jebel Harun），但知識庫 GT 指出那裡在以東境內、不在「以東邊界」上；GT《啟導本》只說「在加低斯巴尼亞東北，近以東邊界」。不少學者偏好的馬德拉山（Jebel Madurah，即本站採用的 Har Zin）符合這個描述，但各家描述它的位置並不一致，知識庫的註釋也有「加低斯西面」與「加低斯東北」兩說。',
  38: '維基百科整理的學界說法另有撒烈溪以北、王道上的「’Ayna」，或撒烈溪以南的某地；本站採 OpenBible 分數最高的 Medeineh。',
};

/**
 * 三十八年那一段，少數候選跟清單的先後接不起來：不計入中間值（仍完整列在資訊卡），理由寫在這裡，資訊卡也會顯示。
 * 閘門另外檢查相鄰兩站的距離，這種離群點以後再出現會被擋下來。
 */
export const ZONE_SKIP: Record<string, { names: string[]; why: string }> = {
  rissah: {
    names: ['Sharma'],
    why: '勒撒在 OpenBible 分數最高的候選是 Sharma（469），位在亞喀巴灣東岸、阿拉伯半島的西北角；前一站立拿與下一站基希拉他的候選都在西乃半島北部到內蓋夫一帶，離 Sharma 各兩百多公里，跟清單的先後接不起來。所以中間值只算第二名 Kuntilet el Jerafi（197）；Sharma 仍列在下面。',
  },
};

export interface Site {
  n: number;
  key: string;
  cands: Candidate[];
  pick: number;
  why?: string;
  mode: PosMode;
  level: Level;
  lon: number;
  lat: number;
  /** span 的另一端 */
  lon2?: number;
  lat2?: number;
  /** zone：中間值與範圍（此時 lon／lat 就是中間值） */
  zone?: Zone;
  /** 圖上這一點的白話說明（現代地名或「一帶」） */
  label: string;
}

const first = (key: string): Candidate => OB_DATA[key].cands[0];

function build(n: number, key: string): Site {
  const cands = OB_DATA[key]?.cands ?? [];
  if (key === 'redsea') {
    // OpenBible 只給整片水域（蘇伊士灣），不是一個地點：依前後站畫在路線上
    return { n, key, cands, pick: -1, mode: 'route', level: 'none', lon: NaN, lat: NaN, label: '沒有座標（來源只給了一片水域）' };
  }
  if (key === 'moab') {
    // 民33:49：從伯耶施末直到亞伯什亭，兩端各有候選
    const a = first('bethjeshimoth');
    const b = first('abelshittim');
    const level = RANK[levelOf(a)] < RANK[levelOf(b)] ? levelOf(a) : levelOf(b);
    return {
      n, key, cands: [a, b], pick: 0, mode: 'span', level,
      lon: a.lon, lat: a.lat, lon2: b.lon, lat2: b.lat,
      label: `${candLabel(a.name)}到${candLabel(b.name)}一帶（民33:49）`,
    };
  }
  if (isWander(n)) {
    // 位置多半不詳、候選又分散：畫在可信候選的中間值，淡圈圈出候選的範圍
    const skip = ZONE_SKIP[key];
    const zone = zoneOf(skip ? cands.filter((c) => !skip.names.includes(c.name)) : cands)!;
    return {
      n, key, cands, pick: -1, mode: 'zone', zone, why: skip?.why,
      // 可信度看實際計入的最高分候選（被排開的不算）
      level: levelOf(zone.used[0]), lon: zone.lon, lat: zone.lat,
      label: zone.used.length > 1 ? `${zone.used.length} 個候選地點的中間值` : candLabel(zone.used[0].name),
    };
  }
  const pick = PICK[key]?.i ?? 0;
  const c = cands[pick];
  return {
    n, key, cands, pick, why: PICK[key]?.why,
    mode: c.kind === 'point' ? 'site' : 'area',
    level: levelOf(c), lon: c.lon, lat: c.lat,
    label: c.kind === 'point' ? candLabel(c.name) : `${candLabel(c.name)}（一帶，不是遺址）`,
  };
}

export const SITES: Site[] = STATIONS.map((s) => build(s.n, s.key));
export const site = (n: number): Site => SITES[n - 1];

/** 比哈希錄、巴力洗分：清單裡的地標，不算站，只在候選圖層顯示 */
export const LANDMARK_KEYS = ['pihahiroth', 'baalzephon'] as const;

/* ------------------------------------------------------------------ 各家怎麼說位置 */

const FHL = 'appendix/fhl_maps/maps/024.md';
const ENTRY = (name: string) => `link_folder/地點/${name}.md`;
const FHL_WHO = 'FHL〈民圖五〉';

/** FHL〈民圖五〉對整份清單位置的總說明 */
export const FHL_STATEMENTS = {
  confirmed: { who: FHL_WHO, says: '加低斯、以旬迦別、普嫩經考古學證實', quote: '其中加低斯、以旬迦別、普嫩等地名和位置，都經考古學證實，也都已獲得學者們認同', file: FHL, plain: true },
  reliable: { who: FHL_WHO, says: '另有幾處相當可靠', quote: '另外也有一些地方是相當可靠的，部分學者也能認同，諸如瑪拉、以琳、利非訂、哈洗錄、約他巴、阿伯、以耶亞巴琳等', file: FHL, plain: true },
  northOfZered: { who: FHL_WHO, says: '撒烈溪以北的各站位置十分明確', quote: '在撒烈溪以北地區的各安營處，其位置都十分明確', file: FHL, plain: true },
  wandering: { who: FHL_WHO, says: '三十八年那十八個安營處，除以旬迦別和加低斯外位置都無法確定', quote: '此十八個安營處之中，除了以甸迦別和加低斯兩地之外，其它的位置都無法確定，僅有約他巴是一可能之處', file: FHL, plain: true },
  whyUnknown1: { who: FHL_WHO, says: '位置不明的原因之一', quote: '因係短暫駐留，故不可能留下千餘年後尚可查考之痕跡', file: FHL, plain: true },
  whyUnknown2: { who: FHL_WHO, says: '位置不明的原因之二', quote: '地名常因政治或宗教因素更改，而且不易考證', file: FHL, plain: true },
  whyUnknown3: { who: FHL_WHO, says: '位置不明的原因之三', quote: '地名因城鎮荒蕪而失傳', file: FHL, plain: true },
  notInExodus: { who: FHL_WHO, says: '民33:5-15 比出埃及記多了三站', quote: '多了「紅海邊」、「脫加」和「亞錄」等三站，但路線相同', file: FHL, plain: true },
} satisfies Record<string, Voice>;

/** 個別站的說法：知識庫地點條目裡的註釋家原話，以及 FHL 的說明 */
export const SITE_VOICES: Record<number, Voice[]> = {
  1: [{ who: 'GT《舊約背景註釋》', says: '蘭塞如今被考證為達巴遺址（Tell el-Dab\'a）', quote: '蘭塞的地點在爭論多年以後，如今確實地被考證為比東以北二十哩左右的達巴遺址', file: ENTRY('蘭塞') }],
  3: [
    { who: 'GT《舊約背景註釋》', says: '以倘最有可能是西勒（Tell Abu Sefa）', quote: '以倘最有可能便是西勒（Sile），即現代的阿布塞法遺址（Tell Abu Sefa）', file: ENTRY('以倘') },
    { who: 'GT《舊約背景註釋》', says: '但這個說法有難處', quote: '問題是西勒離疏割有五十哩之遙，要幾天才能走到。', file: ENTRY('以倘') },
    { who: 'CT', says: '確實地點不詳，從字義看靠近紅海邊', quote: '『以倘(Etham)』第三站(參出十三20)，確實地點不詳，從原文字義(「海邊」)可知以倘靠近紅海邊。', file: 'raw_data/ccbiblestudy_CT_numbers_33.txt', plain: true },
  ],
  4: [
    { who: 'CT', says: '比哈希錄、巴力洗分、密奪的位置', quote: '『比哈希錄』確實地點不詳，可能位於蘆葦草叢生的紅海邊上', file: 'raw_data/ccbiblestudy_CT_numbers_33.txt', plain: true },
    { who: 'GT《舊約背景註釋》', says: '若在巴力洗分安營，最近的湖是巴拉湖', quote: '他們若是在此安營，最按近的湖泊就是巴拉湖。', file: ENTRY('巴力洗分') },
  ],
  5: [
    { who: 'GT《啟導本》', says: '一般認為是安哈瓦拿', quote: '一般認為是蘇彝士灣北端以南約七十公里的安哈瓦拿（Ain Hawarah）', file: ENTRY('瑪拉') },
    { who: 'GT《中文聖經註釋》', says: '實際所在無法確證', quote: '至今我們仍無法確證這地方的實際所在', file: ENTRY('瑪拉') },
  ],
  6: [FHL_STATEMENTS.reliable],
  7: [{ who: 'CT', says: '出埃及記沒有提到這一站', quote: '『紅海邊(by the Red sea)』第七站，《出埃及記》中沒有提到這一站。', file: 'raw_data/ccbiblestudy_CT_numbers_33.txt', plain: true }, FHL_STATEMENTS.notInExodus],
  9: [{ who: 'CT', says: '出埃及記沒有提到這一站', quote: '『脫加(Dophkah)』第九站，《出埃及記》中沒有提到這一站。', file: 'raw_data/ccbiblestudy_CT_numbers_33.txt', plain: true }],
  10: [{ who: 'CT', says: '脫加和亞錄在汛的曠野與利非訂之間', quote: '脫加和亞錄位於汛的曠野和利非訂之間。', file: 'raw_data/ccbiblestudy_CT_numbers_33.txt', plain: true }],
  11: [
    { who: 'GT《啟導本》', says: '通常認為是西乃半島南部的 Wadi Refayid', quote: '通常都認為利非訂就是今天西奈半島南部的拉法伊德城（Wadi Refayid），其地近摩西山（Jebel Musa），傳統的西奈山所在地。', file: ENTRY('利非訂') },
    { who: 'GT《中文聖經註釋》', says: '主張在北部，靠近加低斯', quote: '這又說明利非訂並不在西乃半島的南部，而在北部', file: ENTRY('利非訂') },
  ],
  12: [
    { who: 'GT《舊約背景註釋》', says: '提出的地點超過十二個', quote: '學者提出的不同地點超過了十二個之多', file: ENTRY('西乃山') },
    { who: 'GT《丁道爾聖經註釋》', says: '神學要點不繫於位置準不準', quote: '然而神學要點並沒有一個是和鑑定的準確性有關的。後世以色列人可能也不知道確實地點。', file: ENTRY('西乃山') },
  ],
  13: [{ who: 'GT《啟導本》', says: '基博羅哈他瓦與哈洗錄確址不詳', quote: '基博羅哈他瓦與哈洗錄二地確址不詳', file: ENTRY('哈洗錄') }],
  14: [{ who: 'GT《背景註釋》', says: '部分學者暫時考證為卡德拉泉', quote: '部分學者暫時考證為卡德拉泉', file: ENTRY('哈洗錄') }, FHL_STATEMENTS.reliable],
  15: [
    { who: 'FHL〈民圖五〉', says: '利提瑪可能就是加低斯', quote: '按經文次序，「利提瑪」應該就是「加低斯」，只是學者們都未能達成一致的認同', file: FHL, plain: true },
    { who: 'CT', says: '利提瑪是在巴蘭曠野安營的地方', quote: '『利提瑪(Rithmah)』第十五站，就是巴蘭曠野安營的地方(參十二16)。', file: 'raw_data/ccbiblestudy_CT_numbers_33.txt', plain: true },
  ],
  16: [FHL_STATEMENTS.wandering],
  29: [{ who: 'CT', says: '曷哈及甲又名谷歌大', quote: '『曷哈及甲(Horhagidgad)』第二十九站，又名谷歌大(參申十7)', file: 'raw_data/ccbiblestudy_CT_numbers_33.txt', plain: true }],
  30: [FHL_STATEMENTS.reliable],
  32: [{ who: 'GT《舊約背景註釋》', says: '位於亞喀巴灣頭，兩個候選', quote: '位於亞喀巴灣頭的海港，若非克萊費遺址（Tell el-Kheleifeh）就是在法爾昂島上', file: ENTRY('以旬迦別') }, FHL_STATEMENTS.confirmed],
  33: [FHL_STATEMENTS.confirmed],
  34: [
    { who: 'GT《舊約背景註釋》', says: '傳統地點是內比哈倫山，但不在以東邊界上', quote: '亞倫死地（但按照申十6，他卻死在摩西拉）的傳統地點是彼特拉附近的內比哈倫山（Jebel Nabi Harun），但此地卻不是在', file: ENTRY('何珥山') },
    { who: 'CT', says: '確實地點不詳', quote: '『何珥山(Mount Hor)』第三十四站，是亞倫去世之所(參38節)，其確實地點不詳', file: 'raw_data/ccbiblestudy_CT_numbers_33.txt', plain: true },
  ],
  36: [{ who: 'GT《舊約背景註釋》', says: '普嫩就是費楠廢墟', quote: '普嫩（＝費楠廢墟〔Khirbet Feinan〕），在死海以南三十哩', file: ENTRY('普嫩') }, FHL_STATEMENTS.confirmed],
  37: [FHL_STATEMENTS.reliable],
  38: [FHL_STATEMENTS.reliable, FHL_STATEMENTS.northOfZered],
  39: [{ who: 'CT', says: '亞嫩河北面五公里的古城，現已成廢墟', quote: '是亞嫩河北面五公里的古城，現已成廢墟', file: 'raw_data/ccbiblestudy_CT_numbers_33.txt', plain: true }],
  42: [{ who: 'GT《背景註釋》', says: '亞伯什亭可能是漢曼遺址', quote: '約瑟夫記載這地位於約但河東面七哩，其實際地點雖不可考，卻可能是克夫雷因乾河（Wadi Kefrein）旁的漢曼遺址（Tell el-Hammam）', file: ENTRY('什亭（亞伯什亭）') }],
};

export const SITE_SOURCES = {
  openbible: { name: 'OpenBible.info《Bible Geocoding Data》', url: 'https://www.openbible.info/geo/', repo: 'https://github.com/openbibleinfo/Bible-Geocoding-Data', license: 'CC BY 4.0' },
  naturalEarth: { name: 'Natural Earth', url: 'https://www.naturalearthdata.com/about/terms-of-use/', license: '公有領域' },
} as const;
