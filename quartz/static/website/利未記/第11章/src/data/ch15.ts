import { VOICES_12 } from './ch12';
import type { Beat, Fact, Reel, Voice } from './types';

/**
 * 利未記 15 章：身體流出東西的不潔淨。
 * 原文欄位取自本庫 raw_data/stepbible_leviticus_15.txt（STEP Bible／STEPBible-Data，CC BY 4.0），
 * 經由第 15 章主檔「本章整理」的整理；辭典義只是可能義域。
 */

export const VOICES_15: Record<string, Voice> = {
  birds: { who: 'GT 丁良才', says: '兩隻鳥，貧富都一樣', quote: '在平常獻祭的時候，只有貧窮人可以獻班鳩或雛鴿（五7，十二8，十四22），但為行這潔淨的禮，不論是貧的是富的都需獻這些鳥。', ch: 15 },
  wait: { who: 'GT 丁良才', says: '為什麼不能馬上行潔淨的禮', quote: '這是要叫他深深覺悟自己的不潔淨', ch: 15 },
  spit: { who: 'GT 丁良才', says: '吐唾沫，不論有意無意', quote: '危險是一樣的', ch: 15 },
  rinse: { who: 'GT 丁良才', says: '涮手，是整部律法只提這一次的細節', quote: '摩西的律法上只在此處提到用水涮手', ch: 15 },
  clay: { who: 'CT', says: '瓦器為什麼要打破：古時的瓦器沒有上釉，污穢會滲進去', ch: 15 },
  clayBH: { who: 'BH', says: '陶器有孔，會吸收；木頭不吸收，洗過就乾淨', ch: 15 },
  stopped: { who: 'CT', says: '「止住的」是什麼意思', quote: '暫時停止，卻未痊癒的', ch: 15 },
  body: { who: 'GT《串珠聖經註釋》', says: '「身」沒有說是哪裡', quote: '但按其餘的經文可合理地推論是指生殖器官', ch: 15 },
  light: { who: 'GT 丁良才', says: '床上、座位上的別的東西，只算到晚上', quote: '因為他所染的不潔淨比21、22節所提的輕些', ch: 15 },
  husband: { who: 'GT 丁良才', says: '同房七天不潔淨的前提', quote: '這必是夫妻無意行的，若是故意行的，二人就必從民中剪除', ch: 15 },
  health: { who: 'GT《啟導本》', says: '月經的規定，換一個角度看', quote: '這是保護女體健康的措施，讓家事辛勞的女子得到合法的休息。', ch: 15 },
  cells: { who: 'GT《啟導本》', says: '性事為什麼不潔淨到晚上', quote: '性事所以『不潔淨到晚上』是分泌物中包含了人體中已死亡的細胞，而死乃不潔的表徵。', ch: 15 },
  noOffer: { who: 'GT《利未記雷氏研讀本》', says: '精液、同房：正常的分泌', quote: '因而不需要為此而獻祭', ch: 15 },
  noGuilt: { who: 'KC', says: '夢遺和同房跟生孩子一樣，不是有罪的行為，沒有罪咎，所以沒有規定獻祭', ch: 15 },
  leprosy: { who: 'KC', says: '把本章和痲瘋對照：在他的讀法裡，痲瘋代表罪，是出於人自己意志的污穢；漏症卻是不由自主、沒有意圖的。本章沒有祭司察看，他說因為這不是公開的惡；也不必遷出營外，表示這些不潔不像痲瘋那樣被重重追究。神在罪的性質上作了分別', ch: 15 },
  ritualBH: { who: 'BH', says: '本章的「不潔」是禮儀性的，不是道德性的；不潔不等於有罪，而是一種需要潔淨的禮儀狀態', ch: 15 },
  notEthic: { who: 'GT《聖經精讀本》', says: '舊約時代的不潔觀念，不是倫理道德方面的可恥行為', ch: 15 },
  outDing: { who: 'GT 丁良才', says: '患漏症的人要出營', quote: '按民五1至4節的條例，患漏症的人都要出到營外', ch: 15 },
  outChain: { who: 'GT《串珠聖經註釋》', says: '患漏症的人不必出營', quote: '然而患者卻可繼續留在家中居住而不須搬往營外受隔離', ch: 15 },
  fall: { who: 'GT 丁良才', says: '本章的排泄為什麼都算不潔：他讀成人墮落的記號', ch: 15 },
  nazirite: { who: 'GT《串珠聖經註釋》', says: '「隔絕」和拿細耳人是同一個字根；以色列人要與污穢隔絕，像拿細耳人遠離清酒濃酒', ch: 15 },
  blood: { who: 'GT《聖經精讀本》', says: '行經不潔，是因為流血；同一卷書的利17:11 卻說血是贖罪的憑藉', ch: 15 },
  ntDing: { who: 'GT 丁良才', says: '律法上的難處，和那個女人的信心', quote: '但這女人信主耶穌有能力，非但不至沾染不潔，更能使自己的漏症痊癒', ch: 15 },
  ntLove: { who: 'GT《啟導本》', says: '主耶穌的回應', quote: '耶穌的大愛，象那女人的信心一樣，超越了一切律法的禁忌與限制。', ch: 15 },
  demon: { who: 'GT《舊約聖經背景註釋》', says: '鄰近的民族怎麼看這種分泌物', quote: '古代近東其他地方相信這種分泌物是患者被鬼附的證據', ch: 15 },
  exorcism: { who: 'GT《舊約聖經背景註釋》', says: '以色列怎麼處理', quote: '在以色列，這人只需要洗身並到聖所行淨化禮，不像在美索不達米亞一般，需要驅邪。', ch: 15 },
};

const B = (time: string, story: string, rule: Fact, cues: Beat['cues'], voice?: Voice): Beat => ({ time, story, rule, cues, voice });

export const REEL_15: Reel = {
  id: 'c15',
  title: '母親的血一直沒有止住',
  color: 'var(--c15)',
  next: '母親的回答，接在下面',
  beats: [
    B('早上', '母親的月事過了，血卻一直沒有止住，已經好幾天。她坐在帳棚前的座位上，臉色不太好。',
      { text: '經期過後血還不止：不潔淨，和月經的日子一樣', status: 'explicit', refs: ['利15:25'], q: '他就因這漏症不潔淨，與他在經期不潔淨一樣' },
      [{ t: 'sky', sky: 'day' }, { t: 'at', who: 'father', to: 'tentOut' }, { t: 'at', who: 'daughter', to: 'basin' }, { t: 'at', who: 'mother', to: 'yard' },
        { t: 'cam', view: 'furniture' }, { t: 'walk', who: 'mother', to: 'onSeat' }, { t: 'act', who: 'mother', act: 'sit' }, { t: 'wait', ms: 400 },
        { t: 'say', who: 'mother', text: '月事過了，血還是沒有止住。' }, { t: 'mark', who: 'mother', mark: 'unclean' }]),
    B('早上', '她站起來，又到墊子上躺了一會兒才起身。從這一刻起，她坐過的座位、躺過的墊子，都成了不潔淨。',
      { text: '她躺過的床、坐過的東西，都要看為不潔淨', status: 'explicit', refs: ['利15:26'], q: '所躺的床、所坐的物都要看為不潔淨' },
      [{ t: 'wait', ms: 700 }, { t: 'act', who: 'mother', act: 'stand' }, { t: 'prop', id: 'seat', state: 'glow' }, { t: 'wait', ms: 800 },
        { t: 'cam', view: 'matClose' }, { t: 'walk', who: 'mother', to: 'onMat' }, { t: 'act', who: 'mother', act: 'lie' }, { t: 'wait', ms: 900 }, { t: 'act', who: 'mother', act: 'stand' },
        { t: 'prop', id: 'mat', state: 'glow' }, { t: 'wait', ms: 900 }, { t: 'cam', view: 'furniture' }, { t: 'walk', who: 'mother', to: 'yard' }],
      VOICES_15.health),
    B('中午', '女兒跑過來，伸手去拉那張座位。母親喊了一聲，已經來不及了。她摸了座位，從這一刻起，不潔淨到晚上。',
      { text: '摸了這些東西的人，不潔淨到晚上', status: 'explicit', refs: ['利15:27'], q: '凡摸這些物件的，就為不潔淨，必不潔淨到晚上' },
      [{ t: 'cam', view: 'furniture' }, { t: 'wait', ms: 900 }, { t: 'together', cues: [{ t: 'walk', who: 'daughter', to: 'seatBy' }, { t: 'say', who: 'mother', text: '等一下——', to: 'daughter' }] },
        { t: 'act', who: 'daughter', act: 'touch' }, { t: 'wait', ms: 500 }, { t: 'mark', who: 'daughter', mark: 'evening' }, { t: 'wait', ms: 600 },
        { t: 'say', who: 'daughter', text: '只是摸一下，也算嗎？', to: 'mother' }, { t: 'say', who: 'mother', text: '算。去洗一洗，到晚上就好了。', to: 'daughter' }]),
    B('中午', '女兒跑到水盆邊，洗了衣服，也洗了澡。洗過了，還是要等到晚上。',
      { text: '摸的人還要洗衣服，用水洗澡', status: 'explicit', refs: ['利15:27'], q: '並要洗衣服，用水洗澡' },
      [{ t: 'cam', view: 'washing' }, { t: 'wait', ms: 800 }, { t: 'walk', who: 'daughter', to: 'basin' }, { t: 'act', who: 'daughter', act: 'wash' },
        { t: 'say', who: 'daughter', text: '洗好了，還要等到晚上。' }]),
    B('下午', '父親知道這個規矩，還是把母親的墊子挪開，讓她歇著。他摸了床，也不潔淨到晚上，也要洗衣服、洗澡。',
      { text: '摸她床的人，不潔淨到晚上，要洗衣服、洗澡', status: 'explicit', refs: ['利15:21'], q: '凡摸他床的，必不潔淨到晚上，並要洗衣服，用水洗澡' },
      [{ t: 'at', who: 'daughter', to: 'home' }, { t: 'cam', view: 'furniture' }, { t: 'wait', ms: 800 }, { t: 'walk', who: 'father', to: 'matBy' },
        { t: 'say', who: 'father', text: '我來挪，妳歇著。', to: 'mother' }, { t: 'act', who: 'father', act: 'touch' }, { t: 'wait', ms: 500 }, { t: 'mark', who: 'father', mark: 'evening' }, { t: 'wait', ms: 700 },
        { t: 'cam', view: 'washing' }, { t: 'wait', ms: 600 }, { t: 'walk', who: 'father', to: 'basin' }, { t: 'act', who: 'father', act: 'wash' }]),
    B('晚上', '太陽下山，到晚上了。父親和女兒都潔淨了。母親還在流血，仍然不潔淨。',
      { text: '碰到的人只不潔淨到晚上；過了晚上，就過去了', status: 'synthesis', refs: ['利15:5', '利15:27'] },
      [{ t: 'cam', view: 'night' }, { t: 'sky', sky: 'dusk' }, { t: 'wait', ms: 700 }, { t: 'sky', sky: 'night' }, { t: 'wait', ms: 700 },
        { t: 'mark', who: 'father', mark: 'clean' }, { t: 'mark', who: 'daughter', mark: 'clean' }, { t: 'wait', ms: 700 },
        { t: 'say', who: 'mother', text: '你們好了。我還沒有。', to: 'father' }]),
    B('幾天以後', '過了幾天，血止住了。母親說：「好了。」可是她還不算潔淨，要從這一天起，再數七天。',
      { text: '漏症好了，要計算七天，然後才為潔淨', status: 'explicit', refs: ['利15:28'], q: '女人的漏症若好了，就要計算七天，然後才為潔淨' },
      [{ t: 'sky', sky: 'day' }, { t: 'at', who: 'father', to: 'beside' }, { t: 'at', who: 'daughter', to: 'pot' }, { t: 'cam', view: 'skyline' },
        { t: 'say', who: 'mother', text: '血止住了。' }, { t: 'mark', who: 'mother', mark: 'seven' }, { t: 'wait', ms: 700 },
        { t: 'count', from: 1, to: 7, label: '血止住以後，第 {n} 天' }],
      VOICES_15.wait),
    B('第 8 天', '第八天，母親取了兩隻斑鳩，帶到會幕門口，交給祭司。父親和女兒陪著她。',
      { text: '第八天，兩隻斑鳩或兩隻雛鴿，帶到會幕門口給祭司', status: 'explicit', refs: ['利15:29'], q: '第八天，要取兩隻斑鳩或是兩隻雛鴿，帶到會幕門口給祭司' },
      [{ t: 'day', text: '第 8 天' }, { t: 'prop', id: 'dove', state: 'carry:mother' }, { t: 'prop', id: 'dove2', state: 'carry:mother' },
        { t: 'at', who: 'priest', to: 'doorP' }, { t: 'follow', who: 'mother' },
        { t: 'together', cues: [
          { t: 'walk', who: 'mother', to: 'path' },
          { t: 'walk', who: 'daughter', to: 'pathD' },
          { t: 'walk', who: 'father', to: 'pathF' },
        ] },
        { t: 'cam', view: 'doorFamily', cut: true },
        { t: 'together', cues: [
          { t: 'walk', who: 'mother', to: 'door', via: ['gate'] },
          { t: 'walk', who: 'daughter', to: 'doorD', via: ['gateF'] },
          { t: 'walk', who: 'father', to: 'doorF', via: ['gateF'] },
        ] },
        { t: 'cam', view: 'daubView' }, { t: 'act', who: 'mother', act: 'give', to: 'priest' }, { t: 'prop', id: 'dove', state: 'carry:priest' }, { t: 'prop', id: 'dove2', state: 'carry:priest' }],
      VOICES_15.birds),
    B('第 8 天', '祭司把一隻獻為贖罪祭，一隻獻為燔祭，為她在耶和華面前贖罪。她潔淨了。',
      { text: '一隻贖罪祭，一隻燔祭，祭司在耶和華面前為她贖罪', status: 'explicit', refs: ['利15:30'], q: '祭司要獻一隻為贖罪祭，一隻為燔祭' },
      [{ t: 'cam', view: 'altar' }, { t: 'act', who: 'priest', act: 'offer' }, { t: 'prop', id: 'dove', state: 'hide' }, { t: 'wait', ms: 250 },
        { t: 'act', who: 'priest', act: 'offer' }, { t: 'prop', id: 'dove2', state: 'hide' },
        { t: 'flash', color: '#e2b23a' }, { t: 'mark', who: 'mother', mark: 'clean' }, { t: 'cam', view: 'doorFamily' }],
      VOICES_12.ritual),
    B('回家的路上', '回家的路上，女兒問：「媽媽又沒有做錯事，為什麼還要獻祭？」',
      { text: '為什麼要這樣隔開：免得玷污神的帳幕', status: 'explicit', refs: ['利15:31'], q: '免得他們玷污我的帳幕，就因自己的污穢死亡' },
      [{ t: 'day', text: '' }, { t: 'sky', sky: 'dusk' }, { t: 'show', who: 'priest', on: false }, { t: 'cam', view: 'askRoad15', cut: true },
        { t: 'together', cues: [
          { t: 'walk', who: 'mother', to: 'roadM', via: ['gate', 'path'] },
          { t: 'walk', who: 'daughter', to: 'roadD', via: ['gateF', 'pathD'] },
          { t: 'walk', who: 'father', to: 'roadF', via: ['gateF', 'pathF'] },
        ] },
        { t: 'cam', view: 'askRoad15' },
        { t: 'say', who: 'daughter', text: '媽媽又沒有做錯事，為什麼還要獻祭？', to: 'mother' }]),
  ],
};

/* ------------------------------------------------------------ 家裡的東西 */

export type Chip = 'evening' | 'wash' | 'bathe' | 'break' | 'rinse';
export const CHIP_TEXT: Record<Chip, string> = { evening: '不潔淨到晚上', wash: '洗衣服', bathe: '用水洗澡', break: '打破', rinse: '用水涮洗' };

export interface Item {
  id: 'bed' | 'seat' | 'body' | 'spit' | 'saddle' | 'hands' | 'clay' | 'wood';
  label: string;
  fact: Fact;
  results: { who: string; chips: Chip[] }[];
  voices?: Voice[];
}

const ALL3: Chip[] = ['evening', 'wash', 'bathe'];

/** 男人漏症時，家裡的東西和人（v4-12） */
export const ITEMS: Item[] = [
  { id: 'bed', label: '他躺的床', results: [{ who: '摸那張床的人', chips: ALL3 }],
    fact: { text: '他躺的床不潔淨；摸那床的人，不潔淨到晚上，要洗衣服、洗澡', status: 'explicit', refs: ['利15:4-5'], q: '凡摸那床的，必不潔淨到晚上，並要洗衣服，用水洗澡' } },
  { id: 'seat', label: '他坐的東西', results: [{ who: '坐那個位子的人', chips: ALL3 }],
    fact: { text: '他坐的東西不潔淨；坐在上面的人，不潔淨到晚上，要洗衣服、洗澡', status: 'explicit', refs: ['利15:4', '利15:6'], q: '那坐患漏症人所坐之物的，必不潔淨到晚上，並要洗衣服，用水洗澡' } },
  { id: 'body', label: '他的身體', results: [{ who: '摸他身體的人', chips: ALL3 }],
    fact: { text: '摸他身體的人，不潔淨到晚上，要洗衣服、洗澡', status: 'explicit', refs: ['利15:7'], q: '那摸患漏症人身體的，必不潔淨到晚上，並要洗衣服，用水洗澡' } },
  { id: 'spit', label: '他的唾沫', results: [{ who: '被吐到的人', chips: ALL3 }],
    fact: { text: '他吐在潔淨的人身上，那人不潔淨到晚上，要洗衣服、洗澡', status: 'explicit', refs: ['利15:8'], q: '若患漏症人吐在潔淨的人身上，那人必不潔淨到晚上，並要洗衣服，用水洗澡' },
    voices: [VOICES_15.spit] },
  { id: 'saddle', label: '他騎的鞍子', results: [{ who: '摸他身下之物的人', chips: ['evening'] }, { who: '拿起那件東西的人', chips: ALL3 }],
    fact: { text: '他騎的鞍子不潔淨；摸他身下之物的人到晚上，拿起那件東西的人，還要洗衣服、洗澡', status: 'explicit', refs: ['利15:9-10'], q: '凡摸了他身下之物的，必不潔淨到晚上' } },
  { id: 'hands', label: '他沒涮手就摸人', results: [{ who: '被他摸到的人', chips: ALL3 }],
    fact: { text: '他沒有用水涮手，摸了誰，誰就不潔淨到晚上，要洗衣服、洗澡', status: 'explicit', refs: ['利15:11'], q: '患漏症的人沒有用水涮手，無論摸了誰，誰必不潔淨到晚上' },
    voices: [VOICES_15.rinse] },
  { id: 'clay', label: '他摸過的瓦器', results: [{ who: '那件瓦器', chips: ['break'] }],
    fact: { text: '他摸過的瓦器要打破', status: 'explicit', refs: ['利15:12'], q: '患漏症人所摸的瓦器就必打破' },
    voices: [VOICES_15.clay, VOICES_15.clayBH] },
  { id: 'wood', label: '他摸過的木器', results: [{ who: '那件木器', chips: ['rinse'] }],
    fact: { text: '他摸過的木器，用水涮洗', status: 'explicit', refs: ['利15:12'], q: '所摸的一切木器也必用水涮洗' } },
];

export const ITEMS_WOMEN: Fact = { text: '女人月經或血漏的時候，她的床、她坐的東西，規矩和這裡一樣', status: 'synthesis', refs: ['利15:20-22', '利15:26-27'] };

/* ------------------------------------------------------------ 四種情況 */

export interface Case {
  id: 'man' | 'semen' | 'mens' | 'flow';
  title: string;
  range: string;
  rows: { label: string; fact: Fact }[];
  voices?: Voice[];
}

export const CASES: Case[] = [
  { id: 'man', title: '男人的漏症', range: '利15:1-15', rows: [
    { label: '不潔淨', fact: { text: '身患漏症，不論還在流或暫時止住，都不潔淨', status: 'explicit', refs: ['利15:2-3'], q: '無論是下流的，是止住的，都是不潔淨' } },
    { label: '碰到的人', fact: { text: '摸他的床、座位、身體，或被他吐到的人：不潔淨到晚上，要洗衣服、洗澡', status: 'explicit', refs: ['利15:5-8'], q: '凡摸那床的，必不潔淨到晚上，並要洗衣服，用水洗澡' } },
    { label: '好了以後', fact: { text: '痊癒了：計算七天，洗衣服，用活水洗身', status: 'explicit', refs: ['利15:13'], q: '就要為潔淨自己計算七天，也必洗衣服，用活水洗身，就潔淨了' } },
    { label: '獻祭', fact: { text: '第八天：一隻贖罪祭，一隻燔祭', status: 'explicit', refs: ['利15:14-15'], q: '祭司要獻上一隻為贖罪祭，一隻為燔祭' } },
  ], voices: [VOICES_15.stopped, VOICES_15.body] },
  { id: 'semen', title: '夢遺、精染衣物、夫妻同房', range: '利15:16-18', rows: [
    { label: '不潔淨', fact: { text: '夢遺，或夫妻同房：不潔淨到晚上', status: 'explicit', refs: ['利15:16', '利15:18'], q: '兩個人必不潔淨到晚上' } },
    { label: '怎麼處理', fact: { text: '用水洗：夢遺洗全身，衣服和皮子用水洗，夫妻兩人洗澡', status: 'explicit', refs: ['利15:16-18'], q: '並要用水洗全身' } },
    { label: '獻祭', fact: { text: '這一段沒有規定要獻祭', status: 'not_stated', refs: ['利15:16-18'] } },
  ], voices: [VOICES_15.noOffer, VOICES_15.noGuilt, VOICES_15.cells] },
  { id: 'mens', title: '月經', range: '利15:19-24', rows: [
    { label: '不潔淨', fact: { text: '月經：污穢七天，摸她的人不潔淨到晚上', status: 'explicit', refs: ['利15:19'], q: '女人行經，必污穢七天' } },
    { label: '碰到的人', fact: { text: '摸她的床、她坐的東西的人：不潔淨到晚上，要洗衣服、洗澡', status: 'explicit', refs: ['利15:20-22'], q: '凡摸他床的，必不潔淨到晚上，並要洗衣服，用水洗澡' } },
    { label: '床上的東西', fact: { text: '床上或座位上若有別的物件，摸了的人只不潔淨到晚上', status: 'explicit', refs: ['利15:23'], q: '人一摸了，必不潔淨到晚上' } },
    { label: '同房', fact: { text: '男人若與她同房：七天不潔淨，所躺的床也不潔淨', status: 'explicit', refs: ['利15:24'], q: '就要七天不潔淨' } },
    { label: '獻祭', fact: { text: '這一段沒有提到獻祭', status: 'not_stated', refs: ['利15:19-24'] } },
  ], voices: [VOICES_15.light, VOICES_15.husband, VOICES_15.health] },
  { id: 'flow', title: '經期以外的血漏', range: '利15:25-30', rows: [
    { label: '不潔淨', fact: { text: '經期以外血流多日，或經期過長：和月經的日子一樣', status: 'explicit', refs: ['利15:25'], q: '他就因這漏症不潔淨，與他在經期不潔淨一樣' } },
    { label: '碰到的人', fact: { text: '她躺的床、坐的東西，摸的人不潔淨到晚上，要洗衣服、洗澡', status: 'explicit', refs: ['利15:26-27'], q: '凡摸這些物件的，就為不潔淨，必不潔淨到晚上，並要洗衣服，用水洗澡' } },
    { label: '好了以後', fact: { text: '漏症好了：計算七天，然後才為潔淨', status: 'explicit', refs: ['利15:28'], q: '就要計算七天，然後才為潔淨' } },
    { label: '獻祭', fact: { text: '第八天：一隻贖罪祭，一隻燔祭', status: 'explicit', refs: ['利15:29-30'], q: '祭司要獻一隻為贖罪祭，一隻為燔祭' } },
  ] },
];

/* ------------------------------------------------------------ 好了以後 */

export const HEAL: { who: string; steps: { label: string; fact: Fact }[] }[] = [
  { who: '男人', steps: [
    { label: '痊癒了', fact: { text: '漏症痊癒了', status: 'explicit', refs: ['利15:13'], q: '患漏症的人痊癒了' } },
    { label: '計算七天', fact: { text: '為潔淨自己計算七天', status: 'explicit', refs: ['利15:13'], q: '就要為潔淨自己計算七天' } },
    { label: '洗衣服，用活水洗身', fact: { text: '洗衣服，用活水洗身，就潔淨了', status: 'explicit', refs: ['利15:13'], q: '也必洗衣服，用活水洗身，就潔淨了' } },
    { label: '第八天，兩隻鳥到會幕門口', fact: { text: '兩隻斑鳩或兩隻雛鴿，交給祭司', status: 'explicit', refs: ['利15:14'], q: '來到會幕門口、耶和華面前，把鳥交給祭司' } },
    { label: '贖罪祭、燔祭', fact: { text: '祭司獻一隻贖罪祭，一隻燔祭', status: 'explicit', refs: ['利15:15'], q: '祭司要獻上一隻為贖罪祭，一隻為燔祭' } },
  ] },
  { who: '女人', steps: [
    { label: '漏症好了', fact: { text: '女人的漏症好了', status: 'explicit', refs: ['利15:28'], q: '女人的漏症若好了' } },
    { label: '計算七天', fact: { text: '計算七天，然後才為潔淨', status: 'explicit', refs: ['利15:28'], q: '就要計算七天，然後才為潔淨' } },
    { label: '洗衣服、洗身：經文沒有寫', fact: { text: '女人這一段沒有提到洗衣服、洗身', status: 'not_stated', refs: ['利15:28'] } },
    { label: '第八天，兩隻鳥到會幕門口', fact: { text: '兩隻斑鳩或兩隻雛鴿，給祭司', status: 'explicit', refs: ['利15:29'], q: '第八天，要取兩隻斑鳩或是兩隻雛鴿，帶到會幕門口給祭司' } },
    { label: '贖罪祭、燔祭', fact: { text: '祭司獻一隻贖罪祭，一隻燔祭', status: 'explicit', refs: ['利15:30'], q: '祭司要獻一隻為贖罪祭，一隻為燔祭' } },
  ] },
];

export const HEAL_BIRDS: Fact = { text: '平常只有窮人獻鳥；為這件事，貧富都要獻鳥', status: 'interpretation', refs: ['利15:14', '利15:29'], note: 'GT 丁良才的說法' };

/* ------------------------------------------------------------ 為什麼要這樣 */

export const REASON_15: Fact = {
  text: '這樣使以色列人與污穢隔絕，免得玷污神的帳幕',
  status: 'explicit',
  refs: ['利15:31'],
  q: '免得他們玷污我的帳幕，就因自己的污穢死亡',
};
export const SUMMARY_15: Fact = { text: '本章總結：患漏症、夢遺、月經、血漏，以及與不潔淨女人同房的條例', status: 'explicit', refs: ['利15:32-33'], q: '並有月經病的和患漏症的，無論男女，並人與不潔淨女人同房的條例' };
export const NOT_CAMP: Fact = { text: '本章沒有一句叫患漏症的人出營', status: 'not_stated', refs: ['利15:1-33'] };

/* ------------------------------------------------------------ 新約 */

export const NT_15: Fact = { text: '有一個女人患了十二年的血漏，從耶穌背後摸他的衣裳繸子', status: 'explicit', refs: ['太9:20'], q: '患了十二年的血漏，來到耶穌背後，摸他的衣裳繸子' };
export const NT_15B: Fact = { text: '耶穌轉過來看見她，說她的信救了她，她就痊癒了', status: 'explicit', refs: ['太9:22'], q: '女兒，放心！你的信救了你' };
export const NT_15C: Fact = { text: '馬可福音和路加福音也記了這件事', status: 'synthesis', refs: ['可5:25', '路8:43'] };

/* ------------------------------------------------------------ 原文 */

export const HEBREW_15: Fact[] = [
  { text: 'v2「身患漏症」是 זָב（H2100H），動詞 זוּב 的分詞，STEP 逐字作 discharging；「他的漏症」是名詞 זוֹב（H2101）', status: 'explicit', refs: ['利15:2'] },
  { text: 'v2 的「身」是 בָּשָׂר（H1320），一般的意思是「肉體」；沒有指明是哪個部位', status: 'explicit', refs: ['利15:2'] },
  { text: 'v13「痊癒」是 טָהֵר（H2891），STEP 逐字作 he will be pure，也就是「成為潔淨」', status: 'explicit', refs: ['利15:13'] },
  { text: 'v13「活水」是 מַיִם חַיִּים，和利14:5 潔淨長大痲瘋的人用的是同一個詞', status: 'explicit', refs: ['利15:13', '利14:5'] },
  { text: '「隔絕」和拿細耳人用的是同一個字根', status: 'interpretation', refs: ['利15:31', '民6:1-4'], note: 'GT《串珠聖經註釋》的說法' },
];

export function ch15Facts(): Fact[] {
  return [
    ...REEL_15.beats.map((b) => b.rule),
    ...ITEMS.map((i) => i.fact), ITEMS_WOMEN,
    ...CASES.flatMap((c) => c.rows.map((r) => r.fact)),
    ...HEAL.flatMap((r) => r.steps.map((s) => s.fact)),
    HEAL_BIRDS, REASON_15, SUMMARY_15, NOT_CAMP, NT_15, NT_15B, NT_15C, ...HEBREW_15,
  ];
}

export function ch15Voices(): Voice[] {
  return [...Object.values(VOICES_15), ...ITEMS.flatMap((i) => i.voices ?? []), ...CASES.flatMap((c) => c.voices ?? [])];
}
