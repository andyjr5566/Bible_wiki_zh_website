import type { Ref, Status } from './types';

/**
 * 每一站在其他經文裡發生的事。只收經文有寫、而且能和民33 的站名對上的；
 * 對不上的（例如民16、17 各站）不硬配，留給註釋家的讀法（CT 的靈意）。
 */
export type EventKind = 'water' | 'food' | 'battle' | 'judgment' | 'death' | 'law' | 'guidance' | 'other';

export const KIND_LABEL: Record<EventKind, string> = {
  water: '水', food: '食物', battle: '爭戰', judgment: '審判', death: '死亡', law: '律法與帳幕', guidance: '引路', other: '其他',
};

export interface StationEvent {
  /** 站序 */
  st: number;
  kind: EventKind;
  text: string;
  status: Status;
  refs: Ref[];
  q: string;
  note?: string;
}

export const EVENTS: StationEvent[] = [
  { st: 1, kind: 'other', text: '步行的男人約有六十萬，從蘭塞起行往疏割去', status: 'explicit', refs: ['出12:37'], q: '步行的男人約有六十萬' },
  { st: 1, kind: 'judgment', text: '出發時，埃及人正葬埋他們的長子', status: 'explicit', refs: ['民33:4'], q: '埃及人正葬埋他們的長子' },
  { st: 3, kind: 'guidance', text: '日間雲柱領路，夜間火柱光照', status: 'explicit', refs: ['出13:21'], q: '日間，耶和華在雲柱中領他們的路；夜間，在火柱中光照他們' },
  { st: 4, kind: 'other', text: '神吩咐轉回，安營在比哈希錄前，密奪和海的中間，對著巴力洗分', status: 'explicit', refs: ['出14:2'], q: '安營在比哈希錄前，密奪和海的中間，對著巴力洗分' },
  { st: 4, kind: 'other', text: '過海：海水分開，成了乾地。民33:8 說是「經過海中」，發生在密奪與瑪拉之間', status: 'explicit', refs: ['出14:21', '民33:8'], q: '海就成了乾地' },
  { st: 5, kind: 'water', text: '在曠野走了三天找不著水，到了瑪拉，水苦不能喝', status: 'explicit', refs: ['出15:22', '出15:23'], q: '不能喝那裡的水；因為水苦' },
  { st: 5, kind: 'water', text: '摩西把一棵樹丟在水裡，水就變甜', status: 'explicit', refs: ['出15:25'], q: '他把樹丟在水裡，水就變甜了' },
  { st: 6, kind: 'water', text: '以琳有十二股水泉，七十棵棕樹', status: 'explicit', refs: ['民33:9'], q: '以琳有十二股水泉，七十棵棕樹' },
  { st: 8, kind: 'food', text: '神說要把糧食從天降給他們', status: 'explicit', refs: ['出16:4'], q: '我要將糧食從天降給你們' },
  { st: 8, kind: 'food', text: '晚上有鵪鶉飛來，遮滿了營', status: 'explicit', refs: ['出16:13'], q: '有鵪鶉飛來，遮滿了營' },
  { st: 11, kind: 'water', text: '百姓沒有水喝；神吩咐擊打磐石，就有水流出來', status: 'explicit', refs: ['民33:14', '出17:6'], q: '你要擊打磐石，從磐石裡必有水流出來' },
  { st: 11, kind: 'battle', text: '亞瑪力人來在利非訂，和以色列人爭戰', status: 'explicit', refs: ['出17:8'], q: '亞瑪力人來在利非訂，和以色列人爭戰' },
  { st: 12, kind: 'law', text: '耶和華降臨在西乃山頂上，召摩西上山', status: 'explicit', refs: ['出19:20'], q: '耶和華降臨在西乃山頂上' },
  { st: 12, kind: 'law', text: '神吩咐「這一切的話」，接下來是出20 章起的誡命', status: 'explicit', refs: ['出20:1'], q: '神吩咐這一切的話說' },
  { st: 12, kind: 'law', text: '第二年正月初一日，帳幕立起來', status: 'explicit', refs: ['出40:17'], q: '第二年正月初一日，帳幕就立起來' },
  { st: 12, kind: 'other', text: '第二年二月二十日，雲彩從法櫃的帳幕收上去，離開西乃', status: 'explicit', refs: ['民10:11', '民10:12'], q: '第二年二月二十日，雲彩從法櫃的帳幕收上去' },
  { st: 13, kind: 'judgment', text: '在這裡葬埋了那起貪慾之心的人', status: 'explicit', refs: ['民11:34'], q: '因為他們在那裡葬埋那起貪慾之心的人' },
  { st: 14, kind: 'judgment', text: '米利暗長了大痲瘋，關鎖在營外七天，百姓等她進來才走', status: 'explicit', refs: ['民12:10', '民12:15'], q: '米利暗關鎖在營外七天' },
  {
    st: 15, kind: 'judgment', text: '窺探迦南地之後，神說百姓要在曠野飄流四十年', status: 'synthesis', refs: ['民14:33'], q: '你們的兒女必在曠野飄流四十年',
    note: '民12:16 說百姓在巴蘭的曠野安營，民13:26 說探子回到「巴蘭曠野的加低斯」。CT 與 FHL 把利提瑪讀作加低斯，所以民13–14 記在這一站；經文自己沒有這樣寫。',
  },
  { st: 32, kind: 'other', text: '後來從亞拉巴的路，經過以拉他、以旬迦別，轉向摩押曠野', status: 'explicit', refs: ['申2:8'], q: '經過以拉他、以旬迦別' },
  { st: 33, kind: 'death', text: '米利暗死在那裡，就葬在那裡', status: 'explicit', refs: ['民20:1'], q: '米利暗死在那裡，就葬在那裡' },
  { st: 33, kind: 'water', text: '摩西用杖擊打磐石兩下，就有許多水流出來', status: 'explicit', refs: ['民20:11'], q: '用杖擊打磐石兩下，就有許多水流出來' },
  { st: 33, kind: 'other', text: '在加低斯住了許多日子', status: 'explicit', refs: ['申1:46'], q: '你們在加低斯住了許多日子' },
  { st: 34, kind: 'death', text: '祭司亞倫遵著耶和華的吩咐上何珥山，就死在那裡，年一百二十三歲', status: 'explicit', refs: ['民33:38', '民33:39'], q: '亞倫死在何珥山的時候年一百二十三歲' },
  { st: 34, kind: 'other', text: '摩西把亞倫的聖衣脫下來，給他的兒子以利亞撒穿上', status: 'explicit', refs: ['民20:28'], q: '摩西把亞倫的聖衣脫下來，給他的兒子以利亞撒穿上' },
  { st: 34, kind: 'battle', text: '迦南人亞拉得王聽說以色列人來了，來與他們爭戰，後來被毀滅', status: 'explicit', refs: ['民33:40', '民21:1', '民21:3'], q: '亞拉得王，聽說以色列人從亞他林路來，就和以色列人爭戰' },
  { st: 39, kind: 'other', text: '迦得子孫建造底本', status: 'synthesis', refs: ['民32:34'], q: '迦得子孫建造底本', note: 'CT 讀作「底本迦得」這個名字的來由；經文沒有這樣連起來。' },
  { st: 41, kind: 'law', text: '神叫摩西上亞巴琳山，觀看所賜給以色列人的地', status: 'explicit', refs: ['民27:12'], q: '你上這亞巴琳山，觀看我所賜給以色列人的地' },
  { st: 41, kind: 'death', text: '摩西從摩押平原登尼波山，上了毘斯迦山頂', status: 'explicit', refs: ['申34:1'], q: '摩西從摩押平原登尼波山，上了那與耶利哥相對的毘斯迦山頂' },
  { st: 42, kind: 'judgment', text: '住在什亭，百姓與摩押女子行起淫亂', status: 'explicit', refs: ['民25:1'], q: '以色列人住在什亭，百姓與摩押女子行起淫亂' },
  { st: 42, kind: 'other', text: '第二次數點，在摩押平原與耶利哥相對的約但河邊', status: 'explicit', refs: ['民26:3'], q: '摩西和祭司以利亞撒在摩押平原與耶利哥相對的約但河邊向以色列人說' },
  { st: 42, kind: 'law', text: '摩西在約但河東的摩押地講律法（申命記）', status: 'explicit', refs: ['申1:5'], q: '摩西在約但河東的摩押地講律法說' },
  { st: 42, kind: 'death', text: '耶和華的僕人摩西死在摩押地', status: 'explicit', refs: ['申34:5'], q: '耶和華的僕人摩西死在摩押地' },
  { st: 42, kind: 'other', text: '約書亞清早離開什亭，來到約但河，等候過河', status: 'explicit', refs: ['書3:1'], q: '約書亞清早起來，和以色列眾人都離開什亭，來到約但河，就住在那裡，等候過河' },
];

export const eventsAt = (n: number) => EVENTS.filter((e) => e.st === n);
