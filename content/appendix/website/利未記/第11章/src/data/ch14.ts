import type { Beat, Fact, Reel, Voice } from './types';

/**
 * 利未記 14 章：長大痲瘋的人得潔淨、回到營裡；房屋的災病。
 * 原文欄位取自本庫 raw_data/stepbible_leviticus_14.txt（STEP Bible／STEPBible-Data，CC BY 4.0），
 * 經由第 14 章主檔「本章整理」的整理。
 */

export const VOICES_14: Record<string, Voice> = {
  birdKind: { who: 'GT 丁良才', says: '什麼鳥都可以，只要是潔淨的活鳥', quote: '不論是兩隻班鳩、雛鴿，或麻雀等，只要是潔淨的活鳥就可以', ch: 14 },
  living: { who: 'GT《串珠聖經註釋》', says: '「活水」是什麼水', quote: '泉水，不是採自水池的', ch: 14 },
  twoBirds: { who: 'GT《串珠聖經註釋》', says: '兩隻鳥，像贖罪日的兩隻羊', quote: '類似第16章贖罪日處理兩隻羊的儀式，其中一隻鳥的血可能顯明了不潔淨者所應得的死罪，另一隻活鳥便背負了這些不潔及罪惡，使之遠離以色列民', ch: 14 },
  notRite: { who: 'KC', says: '這其實還不是一個祭：沒有東西帶到壇上，也沒有血獻給神；祭要到第八天才出現', ch: 14 },
  shaveNo: { who: 'GT《舊約聖經背景註釋》', says: '剃毛沒有象徵意義，是為了讓人看見皮膚已經復原', quote: '毛髮有時代表人的生命或身分，但在本節卻無象徵意義。剃除淨盡的作用是使人人都能看見皮膚已經復原，以及避免有任何殘餘的不潔留在毛髮上。', ch: 14 },
  shaveYes: { who: 'CT', says: '剃毛有象徵意義', quote: '『頭髮』表徵驕傲和炫耀；『鬍鬚』表徵自尊；『眉毛』表徵天然的美麗；『全身的毛』表徵天然的能力。', ch: 14 },
  waveWhole: { who: 'GT《舊約聖經背景註釋》', says: '這是唯一把整隻祭牲拿來搖的搖祭', ch: 14 },
  ear: { who: 'CT', says: '耳、手、腳', quote: '從今以後，耳朵聽從神的話，手作神的工，腳行神的路', ch: 14 },
  grace: { who: 'CT', says: '和承接聖職並列', quote: '作祭司完全是神的恩典，同樣大痲瘋得痊癒也是出於神的恩典。', ch: 14 },
  ordainDiff: { who: 'GT 丁良才', says: '分派祭司時抹血，是把全身獻給主；潔淨長大痲瘋的人時抹血，是顯明全身都潔淨了', ch: 14 },
  notMagic: { who: 'GT《舊約聖經背景註釋》', says: '人是先痊癒，才行這個禮', quote: '對以色列人來說，這儀式是象徵性的，不是法術（因為人已經痊癒）', ch: 14 },
  hurrian: { who: 'GT《舊約聖經背景註釋》', says: '鄰邦也有相似的儀式', quote: '胡利人的儀式使用雀鳥（兩隻獻祭，一隻放生），又焚燒香柏木，和以色列人一樣。', ch: 14 },
  poorDing: { who: 'GT 丁良才', says: '貧窮人的條例', quote: '顯明神是體恤貧窮人的', ch: 14 },
  poorJD: { who: 'GT《聖經精讀本》', says: '看的是心', quote: '神看獻祭之人的心,而不是看祭物大小、量與質', ch: 14 },
  log: { who: 'GT《舊約聖經背景註釋》', says: '一羅革到底多少', quote: '羅革的分量不大，連一品脫也不足，但卻難以精確估計。聖經只在本章使用這字。', ch: 14 },
  houseNotJudge: { who: 'GT《聖經精讀本》', says: '房屋發霉不是審判', quote: '並不是神對罪審判,使房屋發生麻風病', ch: 14 },
  houseNoOffer: { who: 'GT《串珠聖經註釋》', says: '房屋不必獻祭', quote: '這裡不須要向神獻祭，因為房子不會與神相交', ch: 14 },
  practical: { who: 'GT《啟導本》', says: '這兩章的條例', quote: '十分切合以色列民的生活環境，具體且實際，不帶任何異教邪魔的神秘顏色', ch: 14 },
  bloodWater: { who: 'BH', says: '血代表生命、是贖罪所必需；水表示潔淨與更新。這幅圖畫在耶穌被釘時有血和水從肋旁流出，得到回應', ch: 14 },
};

const B = (time: string, story: string, rule: Fact, cues: Beat['cues'], voice?: Voice): Beat => ({ time, story, rule, cues, voice });
/** 從第 13 章接過來的樣子：父親住在營外，還穿著撕裂的衣服 */
const START: Beat['cues'] = [
  { t: 'sky', sky: 'dawn' }, { t: 'prop', id: 'shelter', state: 'on' }, { t: 'at', who: 'father', to: 'outside' },
  { t: 'act', who: 'father', act: 'rip' }, { t: 'act', who: 'father', act: 'loosen' }, { t: 'act', who: 'father', act: 'cover' },
  { t: 'mark', who: 'father', mark: 'outside' }, { t: 'at', who: 'mother', to: 'yard' }, { t: 'at', who: 'daughter', to: 'pot' }, { t: 'at', who: 'priest', to: 'gate' },
];

export const REEL_14: Reel = {
  id: 'c14',
  title: '回到營裡',
  color: 'var(--c14)',
  next: '父親的回答，接在下面',
  beats: [
    B('營外的某個早上', '父親在營外住了很久。有一天早上，他捲起袖子：手臂上的斑不見了。',
      { text: '長大痲瘋的人得潔淨，有一套條例', status: 'explicit', refs: ['利14:2'], q: '長大痲瘋得潔淨的日子，其例乃是這樣' },
      [...START, { t: 'prop', id: 'spot', state: 'on' }, { t: 'cam', view: 'outClose' }, { t: 'wait', ms: 400 },
        { t: 'act', who: 'father', act: 'sleeve' }, { t: 'prop', id: 'spot', state: 'off' }, { t: 'wait', ms: 500 }]),
    B('營外', '祭司出到營外來看他。',
      { text: '祭司出到營外察看', status: 'explicit', refs: ['利14:3'], q: '祭司要出到營外察看，若見他的大痲瘋痊癒了' },
      [{ t: 'sky', sky: 'day' }, { t: 'follow', who: 'priest' }, { t: 'walk', who: 'priest', to: 'outP', via: ['aisle', 'exit'] },
        { t: 'cam', view: 'rite' }, { t: 'act', who: 'priest', act: 'lean', to: 'father' }, { t: 'say', who: 'priest', text: '好了，病好了。', to: 'father' }]),
    B('營外', '祭司吩咐人拿來兩隻潔淨的活鳥、香柏木、朱紅色線和牛膝草，又用瓦器盛了活水。',
      { text: '兩隻潔淨的活鳥、香柏木、朱紅色線、牛膝草；瓦器盛活水', status: 'explicit', refs: ['利14:4-5'], q: '拿兩隻潔淨的活鳥和香柏木、朱紅色線，並牛膝草來', note: '經文只說「吩咐人」拿來，沒說是誰' },
      [{ t: 'prop', id: 'vessel', state: 'at:outP' }, { t: 'wait', ms: 300 }, { t: 'prop', id: 'dove', state: 'at:outP' }, { t: 'prop', id: 'dove2', state: 'at:outP' },
        { t: 'wait', ms: 300 }, { t: 'prop', id: 'bundle', state: 'at:outP' }],
      VOICES_14.birdKind),
    B('營外', '一隻鳥宰在瓦器的活水上面。',
      { text: '把一隻鳥宰在活水上面', status: 'explicit', refs: ['利14:5'], q: '把一隻鳥宰在上面', note: '畫面只用符號表示' },
      [{ t: 'prop', id: 'dove2', state: 'slain' }, { t: 'wait', ms: 600 }],
      VOICES_14.living),
    B('營外', '祭司把活鳥、香柏木、朱紅色線、牛膝草一起蘸在血水裡，向他灑了七次，定他為潔淨。',
      { text: '灑七次，定他為潔淨', status: 'explicit', refs: ['利14:6-7'], q: '用以在那長大痲瘋求潔淨的人身上灑七次，就定他為潔淨' },
      [{ t: 'prop', id: 'dove', state: 'carry:priest' }, { t: 'prop', id: 'bundle', state: 'carry:priest' }, { t: 'act', who: 'priest', act: 'sprinkle', to: 'father' },
        { t: 'say', who: 'priest', text: '你潔淨了。', to: 'father' }]),
    B('營外', '那隻活鳥放到田野裡，飛走了。',
      { text: '活鳥放在田野裡', status: 'explicit', refs: ['利14:7'], q: '又把活鳥放在田野裡' },
      [{ t: 'cam', view: 'outsideWide' }, { t: 'prop', id: 'bundle', state: 'hide' }, { t: 'wait', ms: 400 }, { t: 'prop', id: 'dove', state: 'fly' }, { t: 'act', who: 'father', act: 'look', to: 'priest' }],
      VOICES_14.twoBirds),
    B('進營', '他洗了衣服、剃去毛髮、洗了澡，走回營裡。可是他還不能進家門：要在自己的帳棚外住七天。',
      { text: '洗衣、剃毛、洗澡，可以進營；但要在自己的帳棚外住七天', status: 'explicit', refs: ['利14:8'], q: '當洗衣服，剃去毛髮，用水洗澡，就潔淨了；然後可以進營，只是要在自己的帳棚外居住七天' },
      [{ t: 'cam', view: 'rite' }, { t: 'act', who: 'father', act: 'wash' }, { t: 'act', who: 'father', act: 'shave' }, { t: 'mark', who: 'father', mark: 'wait' },
        { t: 'prop', id: 'vessel', state: 'hide' }, { t: 'prop', id: 'dove2', state: 'hide' },
        { t: 'follow', who: 'father' }, { t: 'walk', who: 'father', to: 'tentOut', via: ['exit', 'aisle'] },
        { t: 'cam', view: 'tentWait' }, { t: 'walk', who: 'daughter', to: 'seatBy' }, { t: 'say', who: 'daughter', text: '爸爸！', to: 'father' }, { t: 'act', who: 'father', act: 'look', to: 'daughter' }],
      VOICES_14.shaveNo),
    B('帳棚外的七天', '他住在帳棚外，等了七天。第七天，他把頭髮、鬍鬚、眉毛、全身的毛再剃一次，又洗衣服、洗身。',
      { text: '第七天再剃一次全身的毛，洗衣洗身', status: 'explicit', refs: ['利14:9'], q: '第七天，再把頭上所有的頭髮與鬍鬚、眉毛，並全身的毛，都剃了' },
      [{ t: 'cam', view: 'tentWait' }, { t: 'wait', ms: 700 }, { t: 'count', from: 1, to: 7, label: '帳棚外：第 {n} 天' }, { t: 'act', who: 'father', act: 'shave' }, { t: 'act', who: 'father', act: 'wash' }],
      VOICES_14.shaveYes),
    B('第 8 天', '第八天一早，他牽著兩隻公羊羔、一隻母羊羔，帶著細麵和一羅革油，往會幕去。',
      { text: '第八天：兩隻公羊羔、一隻一歲的母羊羔、調油的細麵、一羅革油', status: 'explicit', refs: ['利14:10-11'], q: '第八天，他要取兩隻沒有殘疾的公羊羔和一隻沒有殘疾、一歲的母羊羔' },
      [{ t: 'day', text: '第 8 天' }, { t: 'mark', who: 'father', mark: 'day8' }, { t: 'prop', id: 'lamb', state: 'lead:father' }, { t: 'prop', id: 'lamb2', state: 'lead:father' }, { t: 'prop', id: 'lamb3', state: 'lead:father' },
        { t: 'prop', id: 'flour', state: 'carry:father' }, { t: 'prop', id: 'oil', state: 'carry:father' }, { t: 'at', who: 'priest', to: 'doorP' },
        { t: 'follow', who: 'father' }, { t: 'walk', who: 'father', to: 'door', via: ['path', 'gate'] }, { t: 'cam', view: 'door' }]),
    B('第 8 天', '在會幕門口，祭司拿一隻公羊羔作贖愆祭，連同那一羅革油，在耶和華面前搖一搖。',
      { text: '贖愆祭和一羅革油，作搖祭', status: 'explicit', refs: ['利14:12'], q: '祭司要取一隻公羊羔獻為贖愆祭，和那一羅革油一同作搖祭，在耶和華面前搖一搖' },
      [{ t: 'prop', id: 'lamb', state: 'carry:priest' }, { t: 'prop', id: 'oil', state: 'carry:priest' }, { t: 'act', who: 'priest', act: 'wave', to: 'father' }],
      VOICES_14.waveWhole),
    B('第 8 天', '祭司把贖愆祭的血，抹在他的右耳垂、右手大拇指、右腳大拇指上。',
      { text: '血抹在右耳垂、右手大拇指、右腳大拇指', status: 'explicit', refs: ['利14:14'], q: '抹在求潔淨人的右耳垂上和右手的大拇指上，並右腳的大拇指上' },
      [{ t: 'prop', id: 'lamb', state: 'hide' }, { t: 'cam', view: 'doorClose' }, { t: 'act', who: 'priest', act: 'daub', to: 'father' }],
      VOICES_14.ear),
    B('第 8 天', '祭司把油倒在左手掌，用指頭在耶和華面前彈七次；剩下的油抹在同樣三處、抹在血上，最後抹在他頭上。',
      { text: '彈油七次；油抹在血上，再抹在頭上', status: 'explicit', refs: ['利14:15-18'], q: '將手裡所剩的油抹在那求潔淨人的右耳垂上和右手的大拇指上，並右腳的大拇指上，就是抹在贖愆祭牲的血上' },
      [{ t: 'act', who: 'priest', act: 'flick' }, { t: 'act', who: 'priest', act: 'oil', to: 'father' }, { t: 'prop', id: 'oil', state: 'hide' }]),
    B('第 8 天', '最後，祭司獻上贖罪祭、燔祭和素祭，為他贖罪。他潔淨了。',
      { text: '獻贖罪祭、燔祭、素祭，他就潔淨了', status: 'explicit', refs: ['利14:19-20'], q: '把燔祭和素祭獻在壇上，為他贖罪，他就潔淨了' },
      [{ t: 'prop', id: 'lamb2', state: 'lead:priest' }, { t: 'prop', id: 'lamb3', state: 'lead:priest' }, { t: 'prop', id: 'flour', state: 'carry:priest' }, { t: 'cam', view: 'altar' },
        { t: 'act', who: 'priest', act: 'offer' }, { t: 'prop', id: 'lamb2', state: 'hide' }, { t: 'prop', id: 'lamb3', state: 'hide' }, { t: 'prop', id: 'flour', state: 'hide' },
        { t: 'flash', color: '#e2b23a' }, { t: 'mark', who: 'father', mark: 'clean' }, { t: 'cam', view: 'door' }, { t: 'act', who: 'father', act: 'bow' }]),
    B('回家', '他走回家。母親和女兒在帳棚前等他。晚上，女兒問：「那些鳥和羊，到底是做什麼的？」',
      { text: '全章三次說到「潔淨」：營外灑完之後、第八天獻完祭之後、房子重新墁過之後', status: 'synthesis', refs: ['利14:7', '利14:20', '利14:48'] },
      [{ t: 'day', text: '' }, { t: 'follow', who: 'father' }, { t: 'walk', who: 'father', to: 'yard', via: ['gate', 'path'] }, { t: 'cam', view: 'reunion' },
        { t: 'together', cues: [{ t: 'walk', who: 'mother', to: 'beside' }, { t: 'walk', who: 'daughter', to: 'pot' }] },
        { t: 'say', who: 'daughter', text: '爸爸回來了！', to: 'father' }, { t: 'act', who: 'mother', act: 'bow', to: 'father' },
        { t: 'sky', sky: 'dusk' }, { t: 'wait', ms: 600 }, { t: 'say', who: 'daughter', text: '那些鳥和羊，到底是做什麼的？', to: 'father' }]),
  ],
};

/* ------------------------------------------------------------ 三個地方、八天 */

export const ROUTE: { place: string; when: string; acts: Fact[] }[] = [
  { place: '營外', when: '第一天', acts: [
    { text: '祭司出營察看', status: 'explicit', refs: ['利14:3'], q: '祭司要出到營外察看' },
    { text: '兩隻鳥：一隻宰在活水上，一隻放走', status: 'explicit', refs: ['利14:5-7'], q: '又把活鳥放在田野裡' },
    { text: '灑七次，定為潔淨', status: 'explicit', refs: ['利14:7'], q: '灑七次，就定他為潔淨' },
  ] },
  { place: '自己的帳棚外', when: '七天', acts: [
    { text: '洗衣、剃毛、洗澡，進營', status: 'explicit', refs: ['利14:8'], q: '然後可以進營' },
    { text: '住在帳棚外七天', status: 'explicit', refs: ['利14:8'], q: '只是要在自己的帳棚外居住七天' },
    { text: '第七天再剃一次，洗衣洗身', status: 'explicit', refs: ['利14:9'], q: '又要洗衣服，用水洗身，就潔淨了' },
  ] },
  { place: '會幕門口', when: '第八天', acts: [
    { text: '贖愆祭和油，作搖祭', status: 'explicit', refs: ['利14:12'], q: '在耶和華面前搖一搖' },
    { text: '抹血、彈油、抹油', status: 'explicit', refs: ['利14:14-18'], q: '在耶和華面前用指頭彈七次' },
    { text: '贖罪祭、燔祭、素祭；潔淨了', status: 'explicit', refs: ['利14:19-20'], q: '他就潔淨了' },
  ] },
];

/* ------------------------------------------------------------ 和承接聖職比一比 */

export const MARK_CLEANSE: Fact = { text: '求潔淨的人：贖愆祭的血抹在右耳垂、右手大拇指、右腳大拇指', status: 'explicit', refs: ['利14:14'], q: '抹在求潔淨人的右耳垂上和右手的大拇指上，並右腳的大拇指上' };
export const MARK_ORDAIN: Fact = { text: '亞倫和他的兒子承接聖職：血抹在同樣的三處', status: 'explicit', refs: ['利8:23-24'], q: '把些血抹在亞倫的右耳垂上和右手的大拇指上，並右腳的大拇指上' };
export const MARK_EXODUS: Fact = { text: '出埃及記先吩咐了這件事', status: 'explicit', refs: ['出29:20'], q: '取點血抹在亞倫的右耳垂上和他兒子的右耳垂上' };
export const MARK_OIL: Fact = { text: '求潔淨的人還多一道：油抹在血上，剩下的抹在頭上', status: 'explicit', refs: ['利14:17-18'], q: '祭司手裡所剩的油要抹在那求潔淨人的頭上' };

/* ------------------------------------------------------------ 窮人的條例 */

export const RICH_POOR: { item: string; rich: Fact; poor: Fact; same?: boolean }[] = [
  { item: '贖愆祭', same: true,
    rich: { text: '公羊羔一隻', status: 'explicit', refs: ['利14:12'], q: '祭司要取一隻公羊羔獻為贖愆祭' },
    poor: { text: '公羊羔一隻（不能減）', status: 'explicit', refs: ['利14:21'], q: '就要取一隻公羊羔作贖愆祭' } },
  { item: '贖罪祭',
    rich: { text: '一歲的母羊羔', status: 'synthesis', refs: ['利14:10', '利14:19'] },
    poor: { text: '斑鳩或雛鴿一隻', status: 'explicit', refs: ['利14:22'], q: '一隻作贖罪祭' } },
  { item: '燔祭',
    rich: { text: '公羊羔一隻', status: 'synthesis', refs: ['利14:10', '利14:19-20'] },
    poor: { text: '斑鳩或雛鴿一隻', status: 'explicit', refs: ['利14:22'], q: '一隻作燔祭' } },
  { item: '素祭',
    rich: { text: '調油的細麵伊法十分之三', status: 'explicit', refs: ['利14:10'], q: '調油的細麵伊法十分之三為素祭' },
    poor: { text: '調油的細麵伊法十分之一', status: 'explicit', refs: ['利14:21'], q: '調油的細麵伊法十分之一為素祭' } },
  { item: '油', same: true,
    rich: { text: '一羅革', status: 'explicit', refs: ['利14:10'], q: '並油一羅革' },
    poor: { text: '一羅革（一樣）', status: 'explicit', refs: ['利14:21'], q: '和油一羅革一同取來' } },
];
export const RICH_POOR_NOTE: Fact = { text: '常例的三隻羊羔，經文沒有一一點名哪一隻作哪一種祭；對照 v12、v19 可以看出來', status: 'synthesis', refs: ['利14:10', '利14:12', '利14:19'] };

/* ------------------------------------------------------------ 房屋 */

export const HOUSE: Record<string, Fact> = {
  canaan: { text: '這是到了迦南、住進房子以後才用得上的條例', status: 'explicit', refs: ['利14:34'], q: '你們到了我賜給你們為業的迦南地' },
  report: { text: '房主去告訴祭司', status: 'explicit', refs: ['利14:35'], q: '據我看，房屋中似乎有災病' },
  empty: { text: '祭司進去以前，先叫人把房子騰空', status: 'explicit', refs: ['利14:36'], q: '就要吩咐人把房子騰空，免得房子裡所有的都成了不潔淨' },
  look: { text: '牆上有發綠發紅、窪於牆的斑紋：封鎖七天', status: 'explicit', refs: ['利14:37-38'], q: '把房子封鎖七天' },
  spread: { text: '第七天發散了：挖出病石、刮掉灰泥，換新石重新墁', status: 'explicit', refs: ['利14:39-42'], q: '要用別的石頭代替那挖出來的石頭，要另用灰泥墁房子' },
  again: { text: '墁過以後又發散：拆毀整棟，搬到城外不潔淨之處', status: 'explicit', refs: ['利14:43-45'], q: '他就要拆毀房子，把石頭、木頭、灰泥都搬到城外不潔淨之處' },
  clean: { text: '墁過以後沒有發散：定房子為潔淨', status: 'explicit', refs: ['利14:48'], q: '就要定房子為潔淨，因為災病已經消除' },
  birds: { text: '用兩隻鳥潔淨房子，活鳥放在城外田野', status: 'explicit', refs: ['利14:49-53'], q: '但要把活鳥放在城外田野裡' },
  inside: { text: '房子封鎖的時候進去的人，不潔淨到晚上；在裡面躺著、吃飯的，要洗衣服', status: 'explicit', refs: ['利14:46-47'], q: '在房子封鎖的時候，進去的人必不潔淨到晚上' },
  atone: { text: '和合本在 v53 加了小註：原文是「為房子贖罪」', status: 'explicit', refs: ['利14:53'], q: '原文是為房子贖罪' },
};

/* ------------------------------------------------------------ 新約、原文 */

export const NT_14: Fact = { text: '耶穌被釘以後，有血和水從肋旁流出來', status: 'explicit', refs: ['約19:34'], q: '隨即有血和水流出來' };

export const HEBREW_14: Fact[] = [
  { text: 'v4 的「鳥」是 צִפּוֹר（H6833），一個通稱，不是 12 章用的「鴿」或「斑鳩」', status: 'explicit', refs: ['利14:4'] },
  { text: '「活水」在原文就是「水」加上「活的」（מַיִם חַיִּים）', status: 'explicit', refs: ['利14:5'] },
  { text: '「一羅革」這個量詞，聖經只在本章出現', status: 'interpretation', refs: ['利14:10'], note: 'GT《舊約聖經背景註釋》的說法' },
];

export function ch14Facts(): Fact[] {
  return [
    ...REEL_14.beats.map((b) => b.rule), ...ROUTE.flatMap((r) => r.acts), MARK_CLEANSE, MARK_ORDAIN, MARK_EXODUS, MARK_OIL,
    ...RICH_POOR.flatMap((r) => [r.rich, r.poor]), RICH_POOR_NOTE, ...Object.values(HOUSE), NT_14, ...HEBREW_14,
  ];
}

export function ch14Voices(): Voice[] {
  return Object.values(VOICES_14);
}
