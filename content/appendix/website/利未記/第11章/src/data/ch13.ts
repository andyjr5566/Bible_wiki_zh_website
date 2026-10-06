import type { Beat, Fact, Reel, Voice } from './types';

/**
 * 利未記 13 章：祭司察看皮膚和衣服上的災病。
 * 原文欄位取自本庫 raw_data/stepbible_leviticus_13.txt（STEP Bible／STEPBible-Data，CC BY 4.0），
 * 經由第 13 章主檔「本章整理」的整理；辭典義只是可能義域。
 */

export const VOICES_13: Record<string, Voice> = {
  hairWhite: { who: 'GT《串珠聖經註釋》', says: '「毛變白」為什麼只是可疑', quote: '由於皮膚病是不會使毛的色澤改變，『毛變白』可能是指皮膚因乾燥而皮鱗脫落，黏貼在毛上，毛看來好像變了白色。', ch: 13 },
  twoErrors: { who: 'GT 丁良才', says: '判錯了兩邊都嚴重：該出去的留下，與神的聖潔不合；不該出去的被趕出去，就是下面這句', quote: '就與神的公義和恩典不合', ch: 13 },
  slow: { who: 'KC', says: '察看要在安靜中慢慢做：兩個七天；還不清楚，就每一次都等滿一整段時間', ch: 13 },
  old: { who: 'GT《串珠聖經註釋》', says: '舊病為什麼不用關鎖', quote: '毛變白及有紅肉是慢性嚴重皮膚病的明顯病徵，故不用檢疫期。', ch: 13 },
  allWhiteCT: { who: 'CT', says: '全身都白反而潔淨：讀成完全認罪的人', quote: '如果大痲瘋發透的話反而定為潔淨', ch: 13 },
  allWhiteJD: { who: 'GT《聖經精讀本》', says: '醫學面的解釋', quote: '人內部的病毒完全發散到外邊,反而被判明為潔淨。因為其患處已經結痂,痂脫落時,大麻風就完全痊癒。', ch: 13 },
  bald: { who: 'GT 丁良才', says: '當時的人怎麼看頭禿', quote: '以色列人以頭禿為羞，有時他們也以為頭禿是出於神的刑罰（王下二23，賽三17，耶四十八37）', ch: 13 },
  mourn: { who: 'GT 丁良才', says: '這幾個動作都是弔喪的記號', quote: '乃是弔喪的標號', ch: 13 },
  grave: { who: 'GT 丁良才', says: '猶太人的俗語這樣稱呼長大痲瘋的人', quote: '行走的墳墓', ch: 13 },
  breath: { who: 'GT《舊約聖經背景註釋》', says: '為什麼要喊「不潔淨了」', quote: '因為普遍信念以為他口中的氣也能玷污人', ch: 13 },
  women: { who: 'GT 丁良才', says: '一個常被略過的例外', quote: '按猶太人的風俗，長大麻風的婦女，不必撕裂衣服。', ch: 13 },
  cloth: { who: 'GT《串珠聖經註釋》', says: '衣服為什麼一段一段處理', quote: '這樣做顯然是為了保全百姓所擁有的財產，如果整件衣服都要毀滅，對窮苦百姓來說，就會產生經濟上嚴重的困難。', ch: 13 },
  noRite: { who: 'GT 丁良才', says: '人和房屋有潔淨禮，衣服沒有', quote: '神沒有定什麼禮節使染大痲瘋的衣服或物件得以潔淨', ch: 13 },
  hansen: { who: 'GT《舊約聖經背景註釋》', says: '這不是今天說的痲瘋病（漢森氏病）', quote: '漢森氏病最主要的病癥一個也沒有在經文中出現，反之所列的症狀卻顯示與漢森氏病無關。經文不把它形容為傳染性的病症。', ch: 13 },
  hansenCT: { who: 'CT', says: '狹義上接近今天的漢森氏病', quote: '狹義指皮膚像鱗片那樣剝落或無知覺，類似現代所謂的『漢森氏病(Hansen)』', ch: 13 },
  notSin: { who: 'GT《聖經精讀本》', says: '染病不等於犯罪', quote: '聖經並沒有說大麻風是犯罪的結果。只是有時作為人犯罪的代價(民12:10-15)。', ch: 13 },
  heal: { who: 'KC', says: '祭司不能醫治，只能宣告潔淨；醫治的是神', ch: 13 },
  outsideBH: { who: 'BH', says: '把營外接到希伯來書：耶穌在城門外受苦，正對應痲瘋病人被隔在營外', ch: 13 },
};

const B = (time: string, story: string, rule: Fact, cues: Beat['cues'], voice?: Voice): Beat => ({ time, story, rule, cues, voice });

export const REEL_13: Reel = {
  id: 'c13',
  title: '父親手臂上的一塊斑',
  color: 'var(--c13)',
  next: '母親的回答，接在下面',
  beats: [
    B('一個平常的早上', '一個平常的早上。父親捲起袖子，看見手臂上有一塊發亮的白斑。',
      { text: '這一章講皮膚上起的斑', status: 'explicit', refs: ['利13:2'], q: '人的肉皮上若長了癤子，或長了癬，或長了火斑' },
      [{ t: 'sky', sky: 'day' }, { t: 'at', who: 'father', to: 'home' }, { t: 'at', who: 'mother', to: 'yard' }, { t: 'at', who: 'daughter', to: 'basin' }, { t: 'at', who: 'priest', to: 'gate' },
        { t: 'cam', view: 'yardWide' }, { t: 'wait', ms: 450 }, { t: 'cam', view: 'arm' }, { t: 'act', who: 'father', act: 'sleeve' }, { t: 'prop', id: 'spot', state: 'on' }, { t: 'wait', ms: 450 }]),
    B('一個平常的早上', '母親走過來看。兩個人都知道，這種事要給祭司看。',
      { text: '皮膚上起了斑，就要帶到祭司面前', status: 'explicit', refs: ['利13:2'], q: '就要將他帶到祭司亞倫或亞倫作祭司的一個子孫面前' },
      [{ t: 'walk', who: 'mother', to: 'beside' }, { t: 'say', who: 'mother', text: '這是什麼？', to: 'father' }, { t: 'say', who: 'father', text: '得給祭司看看。', to: 'mother' }]),
    B('第 1 天', '他走到會幕。祭司湊近，看了很久。',
      { text: '祭司要察看皮膚上的斑', status: 'explicit', refs: ['利13:3'], q: '祭司要察看肉皮上的災病', note: '在哪裡察看，經文沒說；畫面放在院子門口' },
      [{ t: 'follow', who: 'father' }, { t: 'walk', who: 'father', to: 'gateF', via: ['path'] }, { t: 'cam', view: 'inspect' }, { t: 'act', who: 'priest', act: 'lean', to: 'father' }],
      VOICES_13.hairWhite),
    B('第 1 天', '「毛沒有變白，也沒有深於皮。先關七天，再看。」',
      { text: '毛沒變白、不深於皮：關鎖七天', status: 'explicit', refs: ['利13:4'], q: '現象不深於皮，其上的毛也沒有變白，祭司就要將有災病的人關鎖七天', note: '關在哪裡，經文沒說' },
      [{ t: 'say', who: 'priest', text: '先關七天，再看。', to: 'father' }, { t: 'cam', view: 'booth' }, { t: 'prop', id: 'booth', state: 'at:gateF' }, { t: 'mark', who: 'father', mark: 'shut' }]),
    B('第 1 到 7 天', '接下來的七天，他被關鎖在那裡。母親和女兒在帳棚前，一天一天地等。',
      { text: '第七天，祭司再看', status: 'explicit', refs: ['利13:5'], q: '第七天，祭司要察看他' },
      [{ t: 'cam', view: 'skyline', cut: true }, { t: 'act', who: 'daughter', act: 'look', to: 'mother' }, { t: 'wait', ms: 350 }, { t: 'count', from: 1, to: 7, label: '第 {n} 天' }],
      VOICES_13.slow),
    B('第 7 天', '第七天，祭司又湊近看。斑停住了，沒有擴散。「還看不準，再等七天。」',
      { text: '沒有發散，再關鎖七天', status: 'explicit', refs: ['利13:5'], q: '若看災病止住了，沒有在皮上發散，祭司還要將他關鎖七天' },
      [{ t: 'cam', view: 'inspect', cut: true }, { t: 'act', who: 'priest', act: 'lean', to: 'father' }, { t: 'say', who: 'priest', text: '還看不準，再等七天。', to: 'father' }]),
    B('第 8 到 14 天', '又是七天。',
      { text: '再過七天，祭司第三次察看', status: 'explicit', refs: ['利13:6'], q: '第七天，祭司要再察看他' },
      [{ t: 'cam', view: 'skyline', cut: true }, { t: 'wait', ms: 350 }, { t: 'count', from: 8, to: 14, label: '第 {n} 天' }]),
    B('第 14 天', '第十四天，第三次察看。祭司看得比前兩次都久……斑在皮上擴散開了。',
      { text: '在皮上發散，定為不潔淨', status: 'explicit', refs: ['利13:7-8'], q: '癬若在皮上發散，就要定他為不潔淨，是大痲瘋' },
      [{ t: 'cam', view: 'inspectClose', cut: true }, { t: 'prop', id: 'spot', state: 'big' }, { t: 'act', who: 'priest', act: 'lean', to: 'father' }, { t: 'wait', ms: 350 },
        { t: 'flash', color: '#b3263a' }, { t: 'mark', who: 'father', mark: 'unclean' }, { t: 'say', who: 'priest', text: '不潔淨。', to: 'father' }],
      VOICES_13.twoErrors),
    B('第 14 天', '他照經文的吩咐：撕裂衣服，散開頭髮，蒙住上唇，然後喊：「不潔淨了！不潔淨了！」',
      { text: '撕衣、蓬頭、蒙上唇，喊叫「不潔淨了」', status: 'explicit', refs: ['利13:45'], q: '他的衣服要撕裂，也要蓬頭散髮，蒙著上唇，喊叫說：不潔淨了！不潔淨了！' },
      [{ t: 'prop', id: 'booth', state: 'hide' }, { t: 'cam', view: 'mournFront' }, { t: 'act', who: 'father', act: 'look', to: 'priest' }, { t: 'act', who: 'father', act: 'rip' }, { t: 'act', who: 'father', act: 'loosen' }, { t: 'act', who: 'father', act: 'cover' },
        { t: 'say', who: 'father', text: '不潔淨了！不潔淨了！' }],
      VOICES_13.mourn),
    B('第 14 天', '往營外去的路上，經過自己的帳棚。他停下來，遠遠看了家人一眼。',
      { text: '不潔淨的，要獨居營外', status: 'explicit', refs: ['利13:46'], q: '他既是不潔淨，就要獨居營外' },
      [{ t: 'at', who: 'mother', to: 'seeM' }, { t: 'at', who: 'daughter', to: 'seeD' },
        { t: 'act', who: 'mother', act: 'look', toward: 'passBy' }, { t: 'act', who: 'daughter', act: 'look', toward: 'passBy' },
        { t: 'cam', view: 'lookBackB', cut: true },
        { t: 'walk', who: 'father', to: 'passBy', via: ['path'] },
        { t: 'act', who: 'father', act: 'look', to: 'mother' }, { t: 'wait', ms: 600 },
        { t: 'cam', view: 'lookBackA', cut: true },
        { t: 'together', cues: [{ t: 'act', who: 'mother', act: 'look', to: 'father' }, { t: 'act', who: 'daughter', act: 'look', to: 'father' }] }, { t: 'wait', ms: 900 }],
      VOICES_13.breath),
    B('黃昏', '他一個人走出營外。',
      { text: '病在身上的日子，他就是不潔淨', status: 'explicit', refs: ['利13:46'], q: '災病在他身上的日子，他便是不潔淨' },
      [{ t: 'sky', sky: 'dusk' }, { t: 'prop', id: 'shelter', state: 'on' }, { t: 'follow', who: 'father' }, { t: 'walk', who: 'father', to: 'outside', via: ['aisle', 'exit'] },
        { t: 'mark', who: 'father', mark: 'outside' }, { t: 'cam', view: 'outside' }],
      VOICES_13.grave),
    B('那天夜裡', '那天夜裡，營外只有一個小棚子，家裡的帳棚亮著燈。女兒問母親：「爸爸什麼時候可以回來？」',
      { text: '民數記說明為什麼要出營：營是神所住的地方', status: 'explicit', refs: ['民5:2-3'], q: '這營是我所住的' },
      [{ t: 'sky', sky: 'night' }, { t: 'show', who: 'priest', on: false }, { t: 'cam', view: 'outsideNight', cut: true }, { t: 'act', who: 'father', act: 'sit' }, { t: 'wait', ms: 1400 },
        { t: 'at', who: 'mother', to: 'fireM' }, { t: 'at', who: 'daughter', to: 'fireD' }, { t: 'act', who: 'mother', act: 'look', to: 'daughter' },
        { t: 'cam', view: 'askD', cut: true }, { t: 'wait', ms: 500 },
        { t: 'say', who: 'daughter', text: '爸爸什麼時候可以回來？', to: 'mother' }]),
  ],
};

/* ------------------------------------------------------------ 察看流程 */

export const INSPECT: Record<string, Fact> = {
  bring: { text: '起了癤子、癬或火斑，就帶到祭司面前', status: 'explicit', refs: ['利13:2'], q: '人的肉皮上若長了癤子，或長了癬，或長了火斑' },
  both: { text: '毛變白，又深於皮：當場定為不潔淨', status: 'explicit', refs: ['利13:3'], q: '若災病處的毛已經變白，災病的現象深於肉上的皮，這便是大痲瘋的災病' },
  shut1: { text: '看不準：關鎖七天', status: 'explicit', refs: ['利13:4'], q: '祭司就要將有災病的人關鎖七天' },
  shut2: { text: '第七天，沒有發散：再關鎖七天', status: 'explicit', refs: ['利13:5'], q: '若看災病止住了，沒有在皮上發散，祭司還要將他關鎖七天' },
  clean: { text: '再過七天，發暗、沒有發散：定為潔淨，洗衣服', status: 'explicit', refs: ['利13:6'], q: '若災病發暗，而且沒有在皮上發散，祭司要定他為潔淨，原來是癬；那人就要洗衣服，得為潔淨' },
  spread: { text: '發散了：定為不潔淨', status: 'explicit', refs: ['利13:7-8'], q: '癬若在皮上發散，就要定他為不潔淨，是大痲瘋' },
  later: { text: '定為潔淨以後又發散，要再給祭司看', status: 'explicit', refs: ['利13:7'], q: '癬若在皮上發散開了，他要再將身體給祭司察看' },
};

/** 幾種特別的情況 */
export const SPECIAL: { title: string; verdict: 'clean' | 'unclean'; fact: Fact; voice?: Voice }[] = [
  { title: '舊病：白癤、毛變白、紅瘀肉', verdict: 'unclean', fact: { text: '不用關鎖，直接定為不潔淨', status: 'explicit', refs: ['利13:10-11'], q: '這是肉皮上的舊大痲瘋，祭司要定他為不潔淨，不用將他關鎖' }, voice: VOICES_13.old },
  { title: '從頭到腳全身都白了', verdict: 'clean', fact: { text: '反而定為潔淨', status: 'explicit', refs: ['利13:12-13'], q: '全身都變為白，他乃潔淨了' }, voice: VOICES_13.allWhiteJD },
  { title: '可是一出現紅肉', verdict: 'unclean', fact: { text: '紅肉什麼時候出現，就什麼時候不潔淨', status: 'explicit', refs: ['利13:14'], q: '但紅肉幾時顯在他的身上就幾時不潔淨' } },
  { title: '頭髮掉了', verdict: 'clean', fact: { text: '頭禿、頂門禿，都還是潔淨', status: 'explicit', refs: ['利13:40-41'], q: '他不過是頭禿，還是潔淨' }, voice: VOICES_13.bald },
  { title: '白中帶黑的火斑', verdict: 'clean', fact: { text: '是皮上發出的白癬，潔淨', status: 'explicit', refs: ['利13:39'], q: '這是皮上發出的白癬，那人是潔淨了' } },
];

/** 患者的四個動作，和祭司被禁止的動作 */
export const MOURN_SICK: Fact = { text: '長大痲瘋的人：衣服要撕裂，要蓬頭散髮', status: 'explicit', refs: ['利13:45'], q: '他的衣服要撕裂，也要蓬頭散髮' };
export const MOURN_PRIEST: Fact = { text: '亞倫和他的兒子：不可蓬頭散髮，不可撕裂衣裳', status: 'explicit', refs: ['利10:6'], q: '不可蓬頭散髮，也不可撕裂衣裳' };
export const MOURN_SAME: Fact = { text: '兩處用的是同樣兩個希伯來字：「撕裂」פָּרַם（H6533）、「蓬頭散髮」פָּרַע（H6544B）', status: 'explicit', refs: ['利13:45', '利10:6'] };
export const FOUR_ACTS = [
  { label: '撕裂衣服', fact: { text: '撕裂衣服', status: 'explicit' as const, refs: ['利13:45'], q: '他的衣服要撕裂' } },
  { label: '蓬頭散髮', fact: { text: '蓬頭散髮', status: 'explicit' as const, refs: ['利13:45'], q: '也要蓬頭散髮' } },
  { label: '蒙著上唇', fact: { text: '蒙著上唇', status: 'explicit' as const, refs: ['利13:45'], q: '蒙著上唇' } },
  { label: '喊叫「不潔淨了」', fact: { text: '喊叫「不潔淨了！不潔淨了！」', status: 'explicit' as const, refs: ['利13:45'], q: '喊叫說：不潔淨了！不潔淨了！' } },
];

/* ------------------------------------------------------------ 衣服 */

export const CLOTH: { id: string; label: string; fact: Fact; end?: 'burn' | 'clean' | 'tear' }[] = [
  { id: 'see', label: '發綠或發紅：給祭司看，關鎖七天', fact: { text: '衣服、皮子上發綠發紅，要給祭司看，關鎖七天', status: 'explicit', refs: ['利13:49-50'], q: '把染了災病的物件關鎖七天' } },
  { id: 'spread', label: '第七天發散了：燒掉', end: 'burn', fact: { text: '發散了，是蠶食的大痲瘋，要焚燒', status: 'explicit', refs: ['利13:51-52'], q: '因為這是蠶食的大痲瘋，必在火中焚燒' } },
  { id: 'wash', label: '沒有發散：洗了，再關鎖七天', fact: { text: '沒有發散，洗了再關七天', status: 'explicit', refs: ['利13:53-54'], q: '把染了災病的物件洗了，再關鎖七天' } },
  { id: 'same', label: '洗過還是一樣：燒掉', end: 'burn', fact: { text: '洗過沒有變色，要焚燒', status: 'explicit', refs: ['利13:55'], q: '那物件若沒有變色，災病也沒有消散，那物件就不潔淨' } },
  { id: 'dim', label: '洗過發暗：把那一塊撕去', end: 'tear', fact: { text: '發暗了，就把那一塊撕去', status: 'explicit', refs: ['利13:56'], q: '若見那災病發暗，他就要把那災病從衣服上、皮子上、經上、緯上，都撕去' } },
  { id: 'back', label: '撕去後又出現：燒掉', end: 'burn', fact: { text: '又出現，就要焚燒', status: 'explicit', refs: ['利13:57'], q: '這就是災病又發了、必用火焚燒那染災病的物件' } },
  { id: 'gone', label: '災病離開了：再洗一次，就潔淨', end: 'clean', fact: { text: '災病離開了，再洗就潔淨', status: 'explicit', refs: ['利13:58'], q: '若災病離開了，要再洗，就潔淨了' } },
];

/* ------------------------------------------------------------ 新約 */

export const NT_13: Fact = { text: '希伯來書說耶穌在城門外受苦，又勸人出到營外就近他', status: 'explicit', refs: ['來13:12-13'], q: '我們也當出到營外，就了他去' };

/* ------------------------------------------------------------ 原文 */

export const HEBREW_13: Fact[] = [
  { text: '三個起始症狀：「癤子」שְׂאֵת（H7613，a swelling）、「癬」סַפַּחַת（H5597，flaking skin）、「火斑」בַהֶרֶת（H934，a bright spot）', status: 'explicit', refs: ['利13:2'] },
  { text: '「大痲瘋」是 צָרָעַת（H6883，a serious skin disease）；「災病」是另一個字 נֶגַע（H5061）', status: 'explicit', refs: ['利13:2'] },
  { text: '「關鎖」是 סָגַר（H5462）的使役形，逐字解作 he will shut up', status: 'explicit', refs: ['利13:4'] },
  { text: '「上唇」是 שָׂפָם（H8222），逐字解作 a moustache', status: 'explicit', refs: ['利13:45'] },
  { text: '頭禿有兩個字：v40 קֵרֵחַ（H7142，bald），v41 גִּבֵּחַ（H1371）', status: 'explicit', refs: ['利13:40-41'] },
  { text: '「蠶食的」是 מַמְאֶרֶת（H3992，malignant）；「透重的」是 פְּחֶתֶת（H6356，eating）', status: 'explicit', refs: ['利13:51', '利13:55'] },
];

export function ch13Facts(): Fact[] {
  return [
    ...REEL_13.beats.map((b) => b.rule), ...Object.values(INSPECT), ...SPECIAL.map((s) => s.fact),
    MOURN_SICK, MOURN_PRIEST, MOURN_SAME, ...FOUR_ACTS.map((a) => a.fact), ...CLOTH.map((c) => c.fact), NT_13, ...HEBREW_13,
  ];
}

export function ch13Voices(): Voice[] {
  return Object.values(VOICES_13);
}
