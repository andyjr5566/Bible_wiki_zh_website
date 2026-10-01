import type { Fact, Move, Offering, Outcome, PlaceId, Actor, Ref, Status, Step, Variant } from './types';

/* ------------------------------------------------------------------ helpers */

function step(
  actor: Actor,
  text: string,
  at: PlaceId,
  refs: Ref[],
  q: string | undefined,
  status: Status = 'explicit',
  extra: Partial<Step> = {},
): Step {
  return { actor, text, at, refs, q, status, ...extra };
}

const f = (text: string, status: Status, refs: Ref[] = [], q?: string, note?: string): Fact => ({
  text,
  status,
  refs,
  q,
  note,
});

const mv = (item: Move['item'], to: PlaceId, how: Move['how'], from?: PlaceId, count?: number): Move => ({
  item,
  to,
  how,
  from,
  count,
});
/** 只燒其中一把（其餘留下歸祭司） */
const part = (m: Move): Move => ({ ...m, part: true });

/* ------------------------------------------------- shared step fragments */

const ashesNextMorning: Step[] = [
  step('priest', '每天早晨，祭司穿上細麻布衣服和褲子，把壇上燒剩的灰收起來，倒在壇的旁邊。', 'side', ['利6:10'],
    '把壇上所燒的燔祭灰收起來，倒在壇的旁邊', 'explicit', { later: true, moves: [mv('ash', 'side', 'carry', 'altar')] }),
  step('priest', '然後換下這身衣服、穿上別的衣服，把灰拿到營外潔淨的地方。', 'outside', ['利6:11'],
    '隨後要脫去這衣服，穿上別的衣服，把灰拿到營外潔淨之處', 'explicit',
    { later: true, act: 'change', moves: [mv('ash', 'outside', 'carry', 'side')] }),
];

const fatList = '蓋臟的脂油、臟上所有的脂油、兩個腰子和腰子上的脂油、肝上的網子';

/* =================================================================== 燔祭 */

const burntSkin = step('priest', '事後，燔祭牲的皮歸給主持獻祭的那位祭司。', 'court', ['利7:8'],
  '要親自得他所獻那燔祭牲的皮', 'explicit', { later: true, moves: [mv('skin', 'court', 'carry', 'front')] });

const burntBull: Variant = {
  id: 'burnt-bull',
  label: '公牛',
  axis: { animal: 'bull' },
  refs: ['利1:3-9'],
  steps: [
    step('offerer', '獻祭的人從自己的牛群中挑一隻沒有殘疾的公牛，牽到會幕門口。', 'front', ['利1:3'],
      '在會幕門口獻一隻沒有殘疾的公牛', 'explicit', { moves: [mv('bull', 'front', 'carry', 'gate')] }),
    step('offerer', '他把手按在牛的頭上。', 'front', ['利1:4'], '他要按手在燔祭牲的頭上', 'explicit',
      { moves: [mv('hand', 'front', 'place')] }),
    step('offerer', '他在耶和華面前親自宰牛。宰殺是獻祭者的工作，不是祭司的。', 'front', ['利1:5'], '他要在耶和華面前宰公牛', 'explicit', { act: 'slay' }),
    step('priest', '祭司接過血，把血灑在壇的周圍。', 'around', ['利1:5'], '把血灑在會幕門口、壇的周圍', 'explicit',
      { moves: [mv('blood', 'around', 'splash', 'front')] }),
    step('offerer', '獻祭的人剝下皮，把牛切成塊子。', 'front', ['利1:6'], '那人要剝去燔祭牲的皮，把燔祭牲切成塊子', 'explicit', { act: 'cut' }),
    step('priest', '祭司在壇上放火、擺柴。', 'altar', ['利1:7'], '把火放在壇上，把柴擺在火上', 'explicit',
      { moves: [mv('fire', 'altar', 'place')] }),
    step('priest', '祭司把肉塊、頭和脂油擺在壇上的柴上。', 'altar', ['利1:8'], '要把肉塊和頭並脂油擺在壇上火的柴上', 'explicit',
      { moves: [mv('meat', 'altar', 'carry', 'front'), mv('fat', 'altar', 'carry', 'front')] }),
    step('unstated', '臟腑和腿要先用水洗。', 'front', ['利1:9'], '但燔祭的臟腑與腿要用水洗', 'explicit', {
      act: 'wash',
      note: '經文沒說由誰洗，也沒說在哪裡洗。洗濯盆是給祭司洗手洗腳的（出30:19），地圖上不把這一步畫在洗濯盆。',
    }),
    step('priest', '祭司把一切全燒在壇上，成為獻給耶和華馨香的火祭。', 'altar', ['利1:9'], '祭司就要把一切全燒在壇上',
      'explicit', { moves: [mv('meat', 'altar', 'burn'), mv('smoke', 'altar', 'burn')] }),
    burntSkin,
    ...ashesNextMorning,
  ],
  outcome: {
    animal: f('沒有殘疾的公牛', 'explicit', ['利1:3'], '沒有殘疾的公牛'),
    blood: f('灑在壇的周圍', 'explicit', ['利1:5'], '把血灑在會幕門口、壇的周圍'),
    altar: f('全部燒在壇上（皮除外）', 'synthesis', ['利1:9', '利7:8'], '把一切全燒在壇上'),
    priest: f('只拿到皮', 'explicit', ['利7:8'], '要親自得他所獻那燔祭牲的皮'),
    offerer: f('什麼都不留', 'synthesis', ['利1:9']),
    outside: f('隔天早晨，灰運到營外潔淨之處', 'explicit', ['利6:11'], '把灰拿到營外潔淨之處'),
    when: f('不吃，沒有吃的期限', 'synthesis', ['利1:9']),
    where: f('不吃', 'synthesis', ['利1:9']),
  },
};

const burntFlock: Variant = {
  id: 'burnt-flock',
  label: '綿羊或山羊',
  axis: { animal: 'flock' },
  refs: ['利1:10-13'],
  steps: [
    step('offerer', '獻祭的人從羊群中獻一隻沒有殘疾的公羊，綿羊或山羊都可以。', 'front', ['利1:10'], '就要獻上沒有殘疾的公羊',
      'explicit', { moves: [mv('ram', 'front', 'carry', 'gate')] }),
    step('offerer', '按手在羊頭上。', 'front', ['利1:10-13'], undefined, 'not_stated', {
      note: '羊的這一段沒有重寫按手。一般照牛的段落（利1:4）理解，但經文在這裡沒有明寫。',
    }),
    step('offerer', '在壇的北邊宰羊。燔祭裡，只有羊的這一段指定了宰的地方。', 'north', ['利1:11'], '要把羊宰於壇的北邊',
      'explicit', { act: 'slay', moves: [mv('ram', 'north', 'carry', 'front')], note: '這句沒有寫出主詞；照牛的段落，宰殺由獻祭者做。' }),
    step('priest', '祭司把羊血灑在壇的周圍。', 'around', ['利1:11'], '要把羊血灑在壇的周圍', 'explicit',
      { moves: [mv('blood', 'around', 'splash', 'north')] }),
    step('offerer', '把羊切成塊子。', 'north', ['利1:12'], '要把燔祭牲切成塊子', 'explicit', { act: 'cut' }),
    step('priest', '祭司把肉塊連頭和脂油擺在壇上的柴上。', 'altar', ['利1:12'], '連頭和脂油，祭司就要擺在壇上火的柴上',
      'explicit', { moves: [mv('meat', 'altar', 'carry', 'north'), mv('fat', 'altar', 'carry', 'north')] }),
    step('unstated', '臟腑與腿用水洗。', 'north', ['利1:13'], '但臟腑與腿要用水洗', 'explicit', { act: 'wash' }),
    step('priest', '祭司全然奉獻，燒在壇上。', 'altar', ['利1:13'], '祭司就要全然奉獻，燒在壇上', 'explicit',
      { moves: [mv('meat', 'altar', 'burn'), mv('smoke', 'altar', 'burn')] }),
    burntSkin,
    ...ashesNextMorning,
  ],
  outcome: {
    animal: f('沒有殘疾的公羊（綿羊或山羊）', 'explicit', ['利1:10'], '沒有殘疾的公羊'),
    blood: f('灑在壇的周圍', 'explicit', ['利1:11'], '要把羊血灑在壇的周圍'),
    altar: f('全部燒在壇上（皮除外）', 'synthesis', ['利1:13', '利7:8']),
    priest: f('只拿到皮', 'explicit', ['利7:8']),
    offerer: f('什麼都不留', 'synthesis', ['利1:13']),
    outside: f('隔天早晨，灰運到營外潔淨之處', 'explicit', ['利6:11']),
    when: f('不吃', 'synthesis', ['利1:13']),
    where: f('不吃', 'synthesis', ['利1:13']),
  },
};

const burntBird: Variant = {
  id: 'burnt-bird',
  label: '斑鳩或雛鴿',
  axis: { animal: 'bird' },
  refs: ['利1:14-17'],
  note: '鳥的段落沒有要求「公的」，也沒有要求「沒有殘疾」；牛（利1:3）和羊（利1:10）都有。',
  steps: [
    step('offerer', '獻斑鳩或雛鴿為供物。', 'front', ['利1:14'], '就要獻斑鳩或是雛鴿為供物', 'explicit',
      { moves: [mv('bird', 'front', 'carry', 'gate')] }),
    step('offerer', '按手？這一段完全沒提。', 'front', ['利1:14-17'], undefined, 'not_stated'),
    step('priest', '從這一步起幾乎都是祭司在做：祭司把鳥拿到壇前，揪下頭來。', 'side', ['利1:15'], '祭司要把鳥拿到壇前，揪下頭來',
      'explicit', { act: 'slay', moves: [mv('bird', 'side', 'carry', 'front')] }),
    step('priest', '鳥的血流在壇的旁邊。鳥的血不多，沒有「灑在四圍」。', 'side', ['利1:15'], '鳥的血要流在壇的旁邊', 'explicit',
      { moves: [mv('blood', 'side', 'drain')] }),
    step('priest', '嗉子和髒物（或作翎毛）除掉，丟在壇東邊倒灰的地方。', 'east', ['利1:16'], '丟在壇的東邊倒灰的地方', 'explicit',
      { moves: [mv('ash', 'east', 'carry', 'side')] }),
    step('priest', '拿著兩個翅膀把鳥撕開，只是不可撕斷。', 'altar', ['利1:17'], '把鳥撕開，只是不可撕斷', 'explicit', { act: 'tear' }),
    step('priest', '在壇上、火的柴上焚燒，是馨香的火祭。', 'altar', ['利1:17'], '祭司要在壇上、在火的柴上焚燒', 'explicit',
      { moves: [mv('bird', 'altar', 'burn'), mv('smoke', 'altar', 'burn')] }),
    ...ashesNextMorning,
  ],
  outcome: {
    animal: f('斑鳩或雛鴿（沒有要求公的、沒有殘疾）', 'synthesis', ['利1:14', '利1:3', '利1:10'], '就要獻斑鳩或是雛鴿為供物'),
    blood: f('流在壇的旁邊', 'explicit', ['利1:15'], '鳥的血要流在壇的旁邊'),
    altar: f('全部燒在壇上（嗉子與髒物丟在壇東邊）', 'synthesis', ['利1:16-17']),
    priest: f('經文沒提祭司得什麼', 'not_stated', ['利1:14-17']),
    offerer: f('什麼都不留', 'synthesis', ['利1:17']),
    outside: f('隔天早晨，灰運到營外潔淨之處', 'explicit', ['利6:11']),
    when: f('不吃', 'synthesis', ['利1:17']),
    where: f('不吃', 'synthesis', ['利1:17']),
  },
};

const burnt: Offering = {
  id: 'burnt',
  name: '燔祭',
  tagline: '整隻燒在壇上，除了皮，什麼都不留下。',
  chapters: '利1；6:8-13；7:8',
  why: f('經文沒有指定要為哪件事獻，是「若有人獻」的自願祭。獻上後「燔祭便蒙悅納，為他贖罪」。', 'explicit', ['利1:2', '利1:4'],
    '燔祭便蒙悅納，為他贖罪'),
  axes: [{ id: 'animal', label: '帶什麼來', options: [
    { id: 'bull', label: '公牛' }, { id: 'flock', label: '綿羊或山羊' }, { id: 'bird', label: '斑鳩或雛鴿' }] }],
  variants: [burntBull, burntFlock, burntBird],
  rules: [
    f('壇上的火要常常燒著，不可熄滅。', 'explicit', ['利6:13'], '在壇上必有常常燒著的火，不可熄滅'),
    f('燔祭從晚上放在壇上，燒到天亮。', 'explicit', ['利6:9'], '燔祭要放在壇的柴上，從晚上到天亮'),
  ],
};

/* =================================================================== 素祭 */

const grainCommonEnd = (refRest: Ref, qRest: string): Step[] => [
  step('priest', '祭司從中取出「作為紀念」的一份，燒在壇上，是馨香的火祭。', 'altar', ['利2:9'],
    '祭司要從素祭中取出作為紀念的，燒在壇上', 'explicit',
    { moves: [mv('flour', 'altar', 'burn', 'front'), mv('smoke', 'altar', 'burn')] }),
  step('priest', '剩下的歸給祭司，是火祭中「至聖」的。', 'court', [refRest], qRest, 'explicit',
    { moves: [mv('cake', 'court', 'carry', 'front')] }),
  step('priest', '祭司中的男丁在會幕的院子裡吃，不帶酵。', 'court', ['利6:16', '利6:18'], '要在會幕的院子裡吃', 'explicit',
    { moves: [mv('cake', 'court', 'eat')] }),
];

const grainBaked = (id: string, label: string, ref: Ref, q: string, text: string): Variant => ({
  id,
  label,
  axis: { form: id.replace('grain-', '') },
  refs: [ref, '利2:8-10', '利7:9'],
  steps: [
    step('offerer', text, 'front', [ref], q, 'explicit', { moves: [mv('cake', 'front', 'carry', 'gate')] }),
    step('unstated', '要不要加乳香？爐、鐵鏊、煎盤這三段都沒有提。', 'front', ['利2:4-7'], undefined, 'not_stated', {
      note: '註釋家在這裡意見相反，見「經文沒說的」那一區。',
    }),
    step('offerer', '把做好的素祭奉給祭司，帶到壇前。', 'front', ['利2:8'], '並奉給祭司，帶到壇前'),
    ...grainCommonEnd('利2:10', '素祭所剩的要歸給亞倫和他的子孫'),
  ],
  outcome: {
    animal: f(label + '做的無酵餅', 'explicit', [ref], q),
    blood: f('不流血', 'synthesis', ['利2:1-16']),
    altar: f('取「作為紀念」的一份燒在壇上', 'explicit', ['利2:9'], '取出作為紀念的，燒在壇上'),
    priest: f('其餘歸主持獻祭的那位祭司', 'explicit', ['利7:9'], '都要歸那獻祭的祭司'),
    offerer: f('什麼都不留', 'synthesis', ['利2:10']),
    outside: f('沒有營外的部分', 'synthesis', ['利2:1-16']),
    when: f('經文沒有規定吃的期限', 'not_stated', ['利6:14-18']),
    where: f('會幕的院子，不帶酵', 'explicit', ['利6:16'], '要在會幕的院子裡吃'),
  },
});

const grainFlour: Variant = {
  id: 'grain-flour',
  label: '生細麵',
  axis: { form: 'flour' },
  refs: ['利2:1-3', '利6:14-18', '利7:10'],
  steps: [
    step('offerer', '用細麵澆上油，再加上乳香。', 'front', ['利2:1'], '要用細麵澆上油，加上乳香', 'explicit',
      { moves: [mv('flour', 'front', 'carry', 'gate')] }),
    step('offerer', '帶到祭司那裡。', 'front', ['利2:2'], '帶到亞倫子孫作祭司的那裡'),
    step('priest', '祭司抓一把細麵、取些油，加上「所有的」乳香，作為紀念燒在壇上。', 'altar', ['利2:2'],
      '取出一把來，並取些油和所有的乳香', 'explicit',
      { moves: [part(mv('flour', 'altar', 'burn', 'front')), mv('smoke', 'altar', 'burn')] }),
    step('priest', '剩下的歸亞倫和他的子孫，是火祭中「至聖」的。', 'court', ['利2:3'], '素祭所剩的要歸給亞倫和他的子孫',
      'explicit', { moves: [mv('flour', 'court', 'carry', 'front')] }),
    step('priest', '祭司中的男丁在會幕的院子裡吃，不帶酵。', 'court', ['利6:16', '利6:18'], '要在會幕的院子裡吃', 'explicit',
      { moves: [mv('cake', 'court', 'eat')] }),
  ],
  outcome: {
    animal: f('細麵、油、乳香', 'explicit', ['利2:1'], '要用細麵澆上油，加上乳香'),
    blood: f('不流血', 'synthesis', ['利2:1-16']),
    altar: f('一把細麵、些油和所有的乳香', 'explicit', ['利2:2'], '取出一把來，並取些油和所有的乳香'),
    priest: f('其餘由亞倫的子孫大家均分', 'explicit', ['利7:10'], '都要歸亞倫的子孫，大家均分'),
    offerer: f('什麼都不留', 'synthesis', ['利2:3']),
    outside: f('沒有營外的部分', 'synthesis', ['利2:1-16']),
    when: f('經文沒有規定吃的期限', 'not_stated', ['利6:14-18']),
    where: f('會幕的院子，不帶酵', 'explicit', ['利6:16'], '要在會幕的院子裡吃'),
  },
};

const grainFirst: Variant = {
  id: 'grain-first',
  label: '初熟的禾穗',
  axis: { form: 'first' },
  refs: ['利2:14-16'],
  steps: [
    step('offerer', '獻上烘過、軋過的新穗子，當作初熟之物的素祭。', 'front', ['利2:14'], '要獻上烘了的禾穗子，就是軋了的新穗子',
      'explicit', { moves: [mv('grain', 'front', 'carry', 'gate')] }),
    step('offerer', '抹上油，加上乳香。', 'front', ['利2:15'], '並要抹上油，加上乳香'),
    step('priest', '祭司把作為紀念的一些穗子、一些油和所有的乳香都燒掉。', 'altar', ['利2:16'], '並所有的乳香，都焚燒', 'explicit',
      { moves: [part(mv('grain', 'altar', 'burn', 'front')), mv('smoke', 'altar', 'burn')] }),
    step('unstated', '剩下的歸誰？這一段沒有寫。', 'court', ['利2:14-16'], undefined, 'not_stated', {
      note: '利2:3、2:10 對一般素祭說「所剩的歸亞倫和他的子孫」，但初熟禾穗這一段沒有重寫。',
    }),
  ],
  outcome: {
    animal: f('烘過、軋過的新穗子，加油和乳香', 'explicit', ['利2:14-15'], '要獻上烘了的禾穗子，就是軋了的新穗子'),
    blood: f('不流血', 'synthesis', ['利2:1-16']),
    altar: f('一些穗子、一些油和所有的乳香', 'explicit', ['利2:16'], '並所有的乳香，都焚燒'),
    priest: f('這一段沒有寫剩下的歸誰', 'not_stated', ['利2:14-16']),
    offerer: f('經文沒有提', 'not_stated', ['利2:14-16']),
    outside: f('沒有營外的部分', 'synthesis', ['利2:1-16']),
    when: f('經文沒有規定', 'not_stated', ['利2:14-16']),
    where: f('經文沒有規定', 'not_stated', ['利2:14-16']),
  },
};

const grainPriest: Variant = {
  id: 'grain-priest',
  label: '祭司自己獻的',
  axis: { form: 'priest' },
  refs: ['利6:19-23'],
  note: '同一種祭，換成祭司為自己獻，結局就從「祭司吃」翻成「一點不吃」。',
  steps: [
    step('anointed', '受膏的祭司自己獻細麵伊法十分之一：早晨一半，晚上一半。', 'front', ['利6:20'], '早晨一半，晚上一半',
      'explicit', { moves: [mv('flour', 'front', 'carry', 'gate')] }),
    step('anointed', '在鐵鏊上用油調勻做成，烤好分成塊子。', 'front', ['利6:21'], '要在鐵鏊上用油調和做成', 'explicit', { act: 'bake' }),
    step('anointed', '全部燒給耶和華。', 'altar', ['利6:22'], '要全燒給耶和華', 'explicit',
      { moves: [mv('cake', 'altar', 'burn', 'front'), mv('smoke', 'altar', 'burn')] }),
    step('anointed', '祭司的素祭都要燒了，不可以吃。', 'altar', ['利6:23'], '祭司的素祭都要燒了，卻不可吃'),
  ],
  outcome: {
    animal: f('細麵伊法十分之一，早晚各半', 'explicit', ['利6:20'], '細麵伊法十分之一'),
    blood: f('不流血', 'synthesis', ['利6:19-23']),
    altar: f('全部燒掉', 'explicit', ['利6:22'], '要全燒給耶和華'),
    priest: f('不可吃', 'explicit', ['利6:23'], '祭司的素祭都要燒了，卻不可吃'),
    offerer: f('獻的就是祭司自己，一點不留', 'synthesis', ['利6:23']),
    outside: f('沒有營外的部分', 'synthesis', ['利6:19-23']),
    when: f('不吃', 'explicit', ['利6:23']),
    where: f('不吃', 'explicit', ['利6:23']),
  },
};

const grain: Offering = {
  id: 'grain',
  name: '素祭',
  tagline: '五祭裡唯一不流血的祭：麵、油、乳香，一把上壇，其餘歸祭司。',
  chapters: '利2；6:14-23；7:9-10',
  why: f('經文沒有指定場合，是「若有人獻」的自願祭。', 'explicit', ['利2:1'], '若有人獻素祭為供物給耶和華'),
  axes: [{ id: 'form', label: '怎麼做的', options: [
    { id: 'flour', label: '生細麵' }, { id: 'oven', label: '爐中烤的' }, { id: 'griddle', label: '鐵鏊上做的' },
    { id: 'pan', label: '煎盤做的' }, { id: 'first', label: '初熟的禾穗' }, { id: 'priest', label: '祭司自己獻的' }] }],
  variants: [
    grainFlour,
    grainBaked('grain-oven', '爐中烤的', '利2:4', '就要用調油的無酵細麵餅，或是抹油的無酵薄餅',
      '在爐中烤：調油的無酵細麵餅，或是抹油的無酵薄餅。'),
    grainBaked('grain-griddle', '鐵鏊上做的', '利2:5', '就要用調油的無酵細麵',
      '在鐵鏊上做：用調油的無酵細麵，分成塊子，澆上油。'),
    grainBaked('grain-pan', '煎盤做的', '利2:7', '就要用油與細麵做成', '用煎盤做：用油與細麵做成。'),
    grainFirst,
    grainPriest,
  ],
  rules: [
    f('不可有酵，也不可有蜜，燒在壇上。', 'explicit', ['利2:11'], '你們不可燒一點酵、一點蜜當作火祭獻給耶和華'),
    f('一定要加鹽：「不可缺了你神立約的鹽」。', 'explicit', ['利2:13'], '在素祭上不可缺了你神立約的鹽'),
  ],
};

/* ================================================================= 平安祭 */

type PeaceKind = 'thanks' | 'vow' | 'free';
type PeaceAnimal = 'herd' | 'sheep' | 'goat';

interface PeaceAnimalInfo {
  label: string;
  refs: Ref[];
  bring: Step;
  tail: boolean;
  hand: { ref: Ref; q: string };
  slaughter: { ref: Ref; q: string };
  burn: { refs: Ref[]; q: string };
}

const peaceAnimalInfo: Record<PeaceAnimal, PeaceAnimalInfo> = {
  herd: {
    label: '牛（公母皆可）',
    refs: ['利3:1-5'],
    bring: step('offerer', '從牛群中牽來，公的母的都可以，但必須沒有殘疾。', 'front', ['利3:1'],
      '無論是公的是母的，必用沒有殘疾的獻在耶和華面前', 'explicit', { moves: [mv('bull', 'front', 'carry', 'gate')] }),
    tail: false,
    hand: { ref: '利3:2', q: '他要按手在供物的頭上' },
    slaughter: { ref: '利3:2', q: '宰於會幕門口' },
    burn: { refs: ['利3:3-5'], q: '要把這些燒在壇的燔祭上' },
  },
  sheep: {
    label: '綿羊（公母皆可）',
    refs: ['利3:6-11'],
    bring: step('offerer', '從羊群中獻綿羊，公的母的都可以，但必須沒有殘疾。', 'front', ['利3:6'],
      '無論是公的是母的，必用沒有殘疾的', 'explicit', { moves: [mv('lamb', 'front', 'carry', 'gate')] }),
    tail: true,
    hand: { ref: '利3:8', q: '並要按手在供物的頭上' },
    slaughter: { ref: '利3:8', q: '宰於會幕前' },
    burn: { refs: ['利3:9-11'], q: '其中的脂油和整肥尾巴都要在靠近脊骨處取下' },
  },
  goat: {
    label: '山羊（公母皆可）',
    refs: ['利3:12-16'],
    bring: step('offerer', '獻山羊為供物，也必須在耶和華面前獻上。', 'front', ['利3:12'], '人的供物若是山羊', 'explicit',
      { moves: [mv('goat', 'front', 'carry', 'gate')] }),
    tail: false,
    hand: { ref: '利3:13', q: '要按手在山羊頭上' },
    slaughter: { ref: '利3:13', q: '宰於會幕前' },
    burn: { refs: ['利3:14-16'], q: '祭司要在壇上焚燒' },
  },
};

const peaceKindInfo: Record<PeaceKind, { label: string; when: Fact; eatStep: Step; bread: Step[]; breadGive?: Step }> = {
  thanks: {
    label: '為感謝',
    when: f('當天吃完，不可留到早晨', 'explicit', ['利7:15'], '要在獻的日子吃，一點不可留到早晨'),
    eatStep: step('offerer', '祭肉要在獻祭的當天吃完，一點不可留到早晨。', 'camp', ['利7:15'],
      '要在獻的日子吃，一點不可留到早晨', 'explicit', { moves: [mv('meat', 'camp', 'eat', 'front')] }),
    bread: [
      step('offerer', '感謝祭要同獻三種無酵的餅：調油的無酵餅、抹油的無酵薄餅、油調細麵做的餅。', 'front', ['利7:12'],
        '就要用調油的無酵餅和抹油的無酵薄餅', 'explicit', { moves: [mv('bread', 'front', 'carry', 'gate')] }),
      step('offerer', '還要加上有酵的餅。全利未記只有這裡要求酵。', 'front', ['利7:13'], '要用有酵的餅和為感謝獻的平安祭', 'synthesis', {
        note: '「全利未記只有這裡」是本庫第 7 章主檔的整理；經文本身只說要用有酵的餅。',
      }),
    ],
    breadGive: step('priest', '各樣供物中取一個餅作舉祭，歸給灑血的那位祭司。', 'court', ['利7:14'], '是要歸給灑平安祭牲血的祭司',
      'explicit', { moves: [mv('bread', 'court', 'carry', 'front')] }),
  },
  vow: {
    label: '為還願',
    when: f('當天和第二天；第三天剩下的要燒掉', 'explicit', ['利7:16-17'], '所剩下的第二天也可以吃'),
    eatStep: step('offerer', '祭肉在獻祭當天吃，剩下的第二天也可以吃。', 'camp', ['利7:16'], '所剩下的第二天也可以吃', 'explicit',
      { moves: [mv('meat', 'camp', 'eat', 'front')] }),
    bread: [],
  },
  free: {
    label: '甘心獻的',
    when: f('當天和第二天；第三天剩下的要燒掉', 'explicit', ['利7:16-17'], '所剩下的第二天也可以吃'),
    eatStep: step('offerer', '祭肉在獻祭當天吃，剩下的第二天也可以吃。', 'camp', ['利7:16'], '所剩下的第二天也可以吃', 'explicit',
      { moves: [mv('meat', 'camp', 'eat', 'front')] }),
    bread: [],
  },
};

function peaceVariant(animal: PeaceAnimal, kind: PeaceKind): Variant {
  const a = peaceAnimalInfo[animal];
  const k = peaceKindInfo[kind];
  const altarText = a.tail ? `${fatList}，另加整條肥尾巴` : fatList;
  const steps: Step[] = [
    a.bring,
    ...k.bread,
    step('offerer', '按手在供物的頭上。', 'front', [a.hand.ref], a.hand.q, 'explicit', { moves: [mv('hand', 'front', 'place')] }),
    step('offerer', `${a.slaughter.q}。平安祭沒有指定在壇的哪一邊宰。`, 'front', [a.slaughter.ref], a.slaughter.q, 'explicit', { act: 'slay' }),
    step('priest', '祭司把血灑在壇的周圍。', 'around', [a.slaughter.ref], '要把血灑在壇的周圍', 'explicit',
      { moves: [mv('blood', 'around', 'splash', 'front')] }),
    step('offerer', '獻祭的人「親手」把要獻的脂油和胸帶來。', 'front', ['利7:30'], '他親手獻給耶和華的火祭，就是脂油和胸，要帶來',
      'explicit', { act: 'cut', moves: [mv('fat', 'front', 'carry'), mv('breast', 'front', 'carry')] }),
    step('unstated', '把胸在耶和華面前搖一搖，作搖祭。', 'front', ['利7:30'], '好把胸在耶和華面前作搖祭，搖一搖', 'explicit', {
      moves: [mv('breast', 'front', 'wave')],
      note: '經文沒說誰搖、怎麼搖；「搖」到底是不是真的前後擺動，註釋家看法不一。',
    }),
    step('priest', `祭司把${altarText}燒在壇上。`, 'altar', a.burn.refs, a.burn.q, 'explicit',
      { moves: [mv('fat', 'altar', 'burn', 'front'), mv('smoke', 'altar', 'burn')] }),
    step('priest', '胸歸亞倫和他的子孫（眾祭司）。', 'court', ['利7:31'], '但胸要歸亞倫和他的子孫', 'explicit',
      { moves: [mv('breast', 'court', 'carry', 'front')] }),
    step('priest', '右腿作舉祭，歸那位灑血、燒脂油的祭司。', 'court', ['利7:32-33'], '要得這右腿為分', 'explicit',
      { moves: [mv('thigh', 'court', 'carry', 'front')] }),
    ...(k.breadGive ? [k.breadGive] : []),
    k.eatStep,
    step('offerer', '只有潔淨的人可以吃；不潔淨的人吃了，要從民中剪除。', 'camp', ['利7:19-20'], '凡潔淨的人都要吃'),
    step('offerer', '到第三天還剩下的祭肉，要用火燒掉。', 'outside', ['利7:17'], '到第三天要用火焚燒', 'explicit', {
      later: true,
      moves: [mv('meat', 'outside', 'burn', 'camp')],
      note: '經文只說「用火焚燒」，沒說在哪裡燒；地圖上的位置是示意。',
    }),
  ];

  return {
    id: `peace-${animal}-${kind}`,
    label: `${a.label}・${k.label}`,
    axis: { animal, kind },
    refs: [...a.refs, '利7:11-21', '利7:28-34'],
    steps,
    outcome: {
      animal: f(a.label, 'explicit', [a.bring.refs[0]], a.bring.q),
      blood: f('灑在壇的周圍', 'explicit', [a.slaughter.ref], '要把血灑在壇的周圍'),
      altar: f(altarText, 'explicit', a.burn.refs),
      priest: f(kind === 'thanks' ? '胸（眾祭司）、右腿（灑血的祭司）、每樣餅取一個' : '胸（眾祭司）、右腿（灑血的祭司）',
        'explicit', kind === 'thanks' ? ['利7:14', '利7:31-33'] : ['利7:31-33']),
      offerer: f('其餘的肉，由獻祭者與潔淨的人同吃', 'synthesis', ['利7:15-20'], '凡潔淨的人都要吃'),
      outside: f('第三天還剩的肉要用火燒掉', 'explicit', ['利7:17'], '到第三天要用火焚燒'),
      when: k.when,
      where: f('利1-9 章沒有規定在哪裡吃', 'not_stated', ['利7:15-21']),
    },
  };
}

const peaceVariants: Variant[] = [];
for (const animal of ['herd', 'sheep', 'goat'] as PeaceAnimal[]) {
  for (const kind of ['thanks', 'vow', 'free'] as PeaceKind[]) peaceVariants.push(peaceVariant(animal, kind));
}

const peace: Offering = {
  id: 'peace',
  name: '平安祭',
  tagline: '唯一會變成一頓飯的祭：脂油歸神，胸和右腿歸祭司，其餘獻祭的人吃。',
  chapters: '利3；7:11-21, 28-34',
  why: f('為感謝、為還願，或甘心樂意獻上。', 'explicit', ['利7:12', '利7:16'], '若所獻的是為還願，或是甘心獻的'),
  axes: [
    { id: 'animal', label: '帶什麼來', options: [
      { id: 'herd', label: '牛' }, { id: 'sheep', label: '綿羊' }, { id: 'goat', label: '山羊' }] },
    { id: 'kind', label: '為什麼獻', options: [
      { id: 'thanks', label: '為感謝' }, { id: 'vow', label: '為還願' }, { id: 'free', label: '甘心獻的' }] },
  ],
  variants: peaceVariants,
  rules: [
    f('脂油都是耶和華的；脂油和血都不可吃。', 'explicit', ['利3:16-17'], '脂油都是耶和華的'),
    f('第三天還吃，這祭就不蒙悅納，也不算為祭。', 'explicit', ['利7:18'], '這祭必不蒙悅納'),
    f('平安祭沒有列出斑鳩或雛鴿。', 'not_stated', ['利3:1-16'], undefined,
      '第 3 章只列牛、綿羊、山羊。為什麼沒有鳥，經文沒有說明。'),
  ],
};

/* ================================================================= 贖罪祭 */

const sinInside = (who: 'anointed' | 'elders', v: { bring: Ref; hand: Ref; take: Ref; veil: Ref; horns: Ref; fat: Ref; out: Ref }): Step[] => [
  step(who === 'anointed' ? 'anointed' : 'elders',
    who === 'anointed' ? '受膏的祭司牽一隻沒有殘疾的公牛犢到會幕門口。' : '會眾一知道所犯的罪，就牽一隻公牛犢到會幕前。',
    'front', [v.bring], who === 'anointed' ? '他要牽公牛到會幕門口' : '會眾一知道所犯的罪就要獻一隻公牛犢為贖罪祭', 'explicit',
    { moves: [mv('bull', 'front', 'carry', 'gate')] }),
  step(who === 'anointed' ? 'anointed' : 'elders',
    who === 'anointed' ? '按手在牛頭上，在耶和華面前宰牛。' : '由會中的長老代表全會眾按手，然後宰牛。',
    'front', [v.hand], who === 'anointed' ? '在耶和華面前按手在牛的頭上' : '會中的長老就要在耶和華面前按手在牛的頭上', 'explicit',
    { act: 'slay', moves: [mv('hand', 'front', 'place')] }),
  step('anointed', '受膏的祭司取些血，帶進會幕裡面。', 'door', [v.take], '要取些公牛的血帶到會幕', 'explicit',
    { moves: [mv('blood', 'door', 'carry', 'front')] }),
  step('anointed', '用指頭蘸血，對著幔子彈七次。', 'veil', [v.veil],
    who === 'anointed' ? '對著聖所的幔子彈血七次' : '對著幔子彈血七次', 'explicit',
    { moves: [mv('blood', 'veil', 'sprinkle', 'door', 7)] }),
  step('anointed', '把些血抹在會幕內香壇的四個角上。', 'incense', [v.horns],
    who === 'anointed' ? '香壇的四角上' : '耶和華面前壇的四角上', who === 'anointed' ? 'explicit' : 'synthesis', {
      moves: [mv('blood', 'incense', 'daub', 'veil')],
      note: who === 'anointed' ? undefined : '這一節只說「會幕內、耶和華面前壇的四角」，沒有寫「香壇」兩字；照利4:7 理解為香壇。',
    }),
  step('anointed', '其餘的血全部倒在會幕門口燔祭壇的腳那裡。', 'base', [v.horns], '燔祭壇的腳那裡', 'explicit',
    { moves: [mv('blood', 'base', 'pour', 'incense')] }),
  step('anointed', `把所有的脂油取下（${fatList}），燒在燔祭壇上。`, 'altar', [v.fat],
    who === 'anointed' ? '祭司要把這些燒在燔祭的壇上' : '把牛所有的脂油都取下，燒在壇上', 'explicit',
    { moves: [mv('fat', 'altar', 'burn', 'front'), mv('smoke', 'altar', 'burn')] }),
  step('anointed', '皮、肉、頭、腿、臟腑、糞，就是整隻公牛，搬到營外潔淨之地、倒灰之所，用火燒在柴上。', 'outside', [v.out],
    who === 'anointed' ? '要搬到營外潔淨之地、倒灰之所，用火燒在柴上' : '他要把牛搬到營外燒了', 'explicit',
    { moves: [mv('meat', 'outside', 'burn', 'front'), mv('skin', 'outside', 'burn', 'front')] }),
  step('priest', '血既然帶進了會幕，這肉誰都不可吃。', 'outside', ['利6:30'], '那肉都不可吃，必用火焚燒', 'explicit', { later: true }),
];

const insideOutcome = (animalRef: Ref, veilRef: Ref, outRef: Ref): Outcome => ({
  animal: f('沒有殘疾的公牛犢', 'explicit', [animalRef]),
  blood: f('帶進會幕：對著幔子彈七次、抹香壇四角，其餘倒在燔祭壇腳', 'explicit', [veilRef]),
  altar: f('所有的脂油，和平安祭一樣', 'explicit', ['利4:8-10'], '與平安祭公牛上所取的一樣'),
  priest: f('祭司不可吃', 'explicit', ['利6:30'], '那肉都不可吃，必用火焚燒'),
  offerer: f('不可吃', 'explicit', ['利6:30']),
  outside: f('整隻公牛（皮、肉、頭、腿、臟腑、糞）燒在營外', 'explicit', [outRef]),
  when: f('不吃', 'explicit', ['利6:30']),
  where: f('不吃', 'explicit', ['利6:30']),
});

const sinOuter = (
  who: '官長' | '百姓',
  animal: { label: string; ref: Ref; q: string; item: Move['item'] },
  hand: { ref: Ref; q: string },
  horns: { ref: Ref; q: string },
  fat: { ref: Ref; q: string },
): Step[] => [
  step('offerer', `${who}牽來${animal.label}。`, 'front', [animal.ref], animal.q, 'explicit',
    { moves: [mv(animal.item, 'front', 'carry', 'gate')] }),
  step('offerer', '按手在祭牲頭上，在宰燔祭牲的地方宰。', 'north', [hand.ref], hand.q, 'explicit', {
    act: 'slay',
    moves: [mv(animal.item, 'north', 'carry', 'front'), mv('hand', 'north', 'place')],
    note: '「宰燔祭牲的地方」照利1:11 是壇的北邊。',
  }),
  step('priest', '祭司用指頭蘸血，抹在燔祭壇的四個角上。血不進會幕。', 'horns', [horns.ref], horns.q, 'explicit',
    { moves: [mv('blood', 'horns', 'daub', 'north')] }),
  step('priest', '其餘的血倒在燔祭壇的腳那裡。', 'base', [horns.ref], '壇的腳那裡', 'explicit',
    { moves: [mv('blood', 'base', 'pour', 'horns')] }),
  step('priest', '所有的脂油照平安祭的樣子取下，燒在壇上。', 'altar', [fat.ref], fat.q, 'explicit',
    { moves: [mv('fat', 'altar', 'burn', 'north'), mv('smoke', 'altar', 'burn')] }),
  step('priest', '祭司為他贖罪，他必蒙赦免。', 'altar', [fat.ref], '他必蒙赦免'),
  step('priest', '祭肉歸辦這祭的祭司，在會幕的院子裡吃；祭司中的男丁都可以吃。', 'court', ['利6:26', '利6:29'],
    '要在聖處，就是在會幕的院子裡吃', 'explicit', { later: true, moves: [mv('meat', 'court', 'eat', 'north')] }),
  step('priest', '血濺到衣服上，要在聖處洗淨；煮祭肉的瓦器要打碎，銅器要擦磨、用水涮淨。', 'court', ['利6:27-28'],
    '惟有煮祭物的瓦器要打碎', 'explicit', { later: true }),
];

const outerOutcome = (animal: Fact, horns: Ref): Outcome => ({
  animal,
  blood: f('抹燔祭壇的四角，其餘倒在壇腳', 'explicit', [horns], '抹在燔祭壇的四角上'),
  altar: f('所有的脂油，和平安祭一樣', 'explicit', ['利4:26', '利4:31', '利4:35']),
  priest: f('祭肉歸辦這祭的祭司，男丁都可以吃', 'explicit', ['利6:26', '利6:29'], '為贖罪獻這祭的祭司要吃'),
  offerer: f('獻祭者自己不吃', 'synthesis', ['利6:26-29']),
  outside: f('沒有營外焚燒的部分', 'synthesis', ['利6:26-30']),
  when: f('經文沒有規定吃的期限', 'not_stated', ['利6:24-30']),
  where: f('聖處，就是會幕的院子', 'explicit', ['利6:26'], '要在聖處，就是在會幕的院子裡吃'),
});

const confession = step('offerer', '先承認所犯的罪。', 'front', ['利5:5'], '就要承認所犯的罪', 'explicit', {
  note: '利5:1-4 列出三件事：該作見證卻不說、摸了不潔的物、冒失發誓。這一段的祭名，註釋家看法不一。',
});

const sin: Offering = {
  id: 'sin',
  name: '贖罪祭',
  tagline: '誰犯了罪，決定了血要走多遠：大祭司和全會眾，血要帶進會幕。',
  chapters: '利4；5:1-13；6:24-30',
  why: f('誤犯了耶和華吩咐不可行的事，一知道了就必須獻。', 'explicit', ['利4:2', '利4:14'],
    '若有人在耶和華所吩咐不可行的什麼事上誤犯了一件'),
  axes: [
    { id: 'who', label: '誰犯了罪', options: [
      { id: 'anointed', label: '受膏的祭司' }, { id: 'assembly', label: '全會眾' }, { id: 'ruler', label: '官長' },
      { id: 'people', label: '百姓' }] },
    { id: 'bring', label: '百姓帶什麼來', options: [
      { id: 'goat', label: '母山羊' }, { id: 'lamb', label: '母綿羊羔' }, { id: 'birds', label: '兩隻鳥（力量不夠）' },
      { id: 'flour', label: '細麵（連鳥也不夠）' }] },
  ],
  variants: [
    {
      id: 'sin-anointed', label: '受膏的祭司', axis: { who: 'anointed' }, refs: ['利4:3-12'],
      steps: sinInside('anointed', { bring: '利4:4', hand: '利4:4', take: '利4:5', veil: '利4:6', horns: '利4:7', fat: '利4:10', out: '利4:12' }),
      outcome: insideOutcome('利4:3', '利4:5-7', '利4:11-12'),
    },
    {
      id: 'sin-assembly', label: '全會眾', axis: { who: 'assembly' }, refs: ['利4:13-21'],
      steps: sinInside('elders', { bring: '利4:14', hand: '利4:15', take: '利4:16', veil: '利4:17', horns: '利4:18', fat: '利4:19', out: '利4:21' }),
      outcome: insideOutcome('利4:14', '利4:16-18', '利4:21'),
    },
    {
      id: 'sin-ruler', label: '官長', axis: { who: 'ruler' }, refs: ['利4:22-26'],
      steps: sinOuter('官長', { label: '一隻沒有殘疾的公山羊', ref: '利4:23', q: '就要牽一隻沒有殘疾的公山羊為供物', item: 'goat' },
        { ref: '利4:24', q: '宰燔祭牲的地方' }, { ref: '利4:25', q: '抹在燔祭壇的四角上' },
        { ref: '利4:26', q: '所有的脂油，祭司都要燒在壇上' }),
      outcome: outerOutcome(f('沒有殘疾的公山羊', 'explicit', ['利4:23'], '沒有殘疾的公山羊'), '利4:25'),
    },
    {
      id: 'sin-people-goat', label: '百姓・母山羊', axis: { who: 'people', bring: 'goat' }, refs: ['利4:27-31'],
      note: '四個階層裡，只有百姓這一段說「在耶和華面前作為馨香的祭」（利4:31）。',
      steps: sinOuter('百姓', { label: '一隻沒有殘疾的母山羊', ref: '利4:28', q: '牽一隻沒有殘疾的母山羊為供物', item: 'goat' },
        { ref: '利4:29', q: '在那宰燔祭牲的地方宰了' }, { ref: '利4:30', q: '抹在燔祭壇的四角上' },
        { ref: '利4:31', q: '在耶和華面前作為馨香的祭' }),
      outcome: outerOutcome(f('沒有殘疾的母山羊', 'explicit', ['利4:28'], '沒有殘疾的母山羊'), '利4:30'),
    },
    {
      id: 'sin-people-lamb', label: '百姓・母綿羊羔', axis: { who: 'people', bring: 'lamb' }, refs: ['利4:32-35'],
      steps: sinOuter('百姓', { label: '一隻沒有殘疾的母綿羊羔', ref: '利4:32', q: '必要牽一隻沒有殘疾的母羊', item: 'lamb' },
        { ref: '利4:33', q: '在那宰燔祭牲的地方宰了作贖罪祭' }, { ref: '利4:34', q: '抹在燔祭壇的四角上' },
        { ref: '利4:35', q: '正如取平安祭羊羔的脂油一樣' }),
      outcome: outerOutcome(f('沒有殘疾的母綿羊羔', 'explicit', ['利4:32'], '沒有殘疾的母羊'), '利4:34'),
    },
    {
      id: 'sin-people-birds', label: '百姓・兩隻鳥', axis: { who: 'people', bring: 'birds' }, refs: ['利5:7-10'],
      steps: [
        confession,
        step('offerer', '力量不夠獻羊羔，就帶兩隻斑鳩或兩隻雛鴿來：一隻作贖罪祭，一隻作燔祭。', 'front', ['利5:7'],
          '一隻作贖罪祭，一隻作燔祭', 'explicit', { moves: [mv('bird', 'front', 'carry', 'gate')] }),
        step('priest', '祭司「先」獻贖罪祭的那一隻：從頸項上揪下頭來，只是不可撕斷。', 'side', ['利5:8'], '只是不可把鳥撕斷', 'explicit',
          { act: 'slay', moves: [mv('bird', 'side', 'carry', 'front')] }),
        step('priest', '把些血彈在壇的旁邊，剩下的血流在壇腳。', 'side', ['利5:9'], '也把些贖罪祭牲的血彈在壇的旁邊', 'explicit',
          { moves: [mv('blood', 'side', 'sprinkle'), mv('blood', 'base', 'drain', 'side')] }),
        step('priest', '第二隻照燔祭的規矩獻上。', 'altar', ['利5:10'], '他要照例獻第二隻為燔祭', 'explicit',
          { moves: [mv('bird', 'altar', 'burn', 'front'), mv('smoke', 'altar', 'burn')] }),
        step('priest', '祭司為他贖罪，他必蒙赦免。', 'altar', ['利5:10'], '他必蒙赦免'),
      ],
      outcome: {
        animal: f('兩隻斑鳩或兩隻雛鴿', 'explicit', ['利5:7'], '把兩隻斑鳩或是兩隻雛鴿帶到耶和華面前'),
        blood: f('彈在壇的旁邊，剩下的流在壇腳', 'explicit', ['利5:9'], '剩下的血要流在壇的腳那裡'),
        altar: f('第二隻鳥照燔祭全燒', 'explicit', ['利5:10']),
        priest: f('經文沒提祭司得什麼', 'not_stated', ['利5:7-10']),
        offerer: f('不吃', 'synthesis', ['利5:7-10']),
        outside: f('經文沒提', 'not_stated', ['利5:7-10']),
        when: f('經文沒提', 'not_stated', ['利5:7-10']),
        where: f('經文沒提', 'not_stated', ['利5:7-10']),
      },
    },
    {
      id: 'sin-people-flour', label: '百姓・細麵', axis: { who: 'people', bring: 'flour' }, refs: ['利5:11-13'],
      note: '整套條例裡，只有這裡讓不流血的東西作贖罪祭。',
      steps: [
        confession,
        step('offerer', '連兩隻鳥也不夠，就帶細麵伊法十分之一來。不可加油，也不可加乳香，因為是贖罪祭。', 'front', ['利5:11'],
          '不可加上油，也不可加上乳香，因為是贖罪祭', 'explicit', { moves: [mv('flour', 'front', 'carry', 'gate')] }),
        step('priest', '祭司抓一把作為紀念，燒在壇上。', 'altar', ['利5:12'], '祭司要取出自己的一把來作為紀念', 'explicit',
          { moves: [part(mv('flour', 'altar', 'burn', 'front')), mv('smoke', 'altar', 'burn')] }),
        step('priest', '祭司為他贖罪，他必蒙赦免。剩下的麵歸祭司，和素祭一樣。', 'court', ['利5:13'], '剩下的麵都歸與祭司，和素祭一樣',
          'explicit', { moves: [mv('flour', 'court', 'carry', 'front')] }),
      ],
      outcome: {
        animal: f('細麵伊法十分之一，不加油、不加乳香', 'explicit', ['利5:11'], '細麵伊法十分之一為贖罪祭'),
        blood: f('不流血', 'synthesis', ['利5:11-13']),
        altar: f('一把作為紀念', 'explicit', ['利5:12']),
        priest: f('剩下的麵，和素祭一樣', 'explicit', ['利5:13'], '剩下的麵都歸與祭司，和素祭一樣'),
        offerer: f('不吃', 'synthesis', ['利5:13']),
        outside: f('沒有營外的部分', 'synthesis', ['利5:11-13']),
        when: f('經文沒提', 'not_stated', ['利5:11-13']),
        where: f('經文沒提', 'not_stated', ['利5:11-13']),
      },
    },
  ],
  rules: [
    f('血若帶進會幕、在聖所贖罪，那肉都不可吃，必用火燒掉。', 'explicit', ['利6:30'], '若將血帶進會幕在聖所贖罪'),
    f('每一段都以同一句話收尾：祭司為他贖罪，他必蒙赦免。', 'explicit', ['利4:20', '利4:26', '利4:31', '利4:35'], '他們必蒙赦免'),
  ],
};

/* ================================================================= 贖愆祭 */

const guiltCore = (fromStep: PlaceId = 'front'): Step[] => [
  step('offerer', '按手？贖愆祭的條例沒有提。', 'front', ['利7:1-7'], undefined, 'not_stated'),
  step('offerer', '在宰燔祭牲的地方宰贖愆祭牲。', 'north', ['利7:2'], '人在哪裡宰燔祭牲，也要在那裡宰贖愆祭牲', 'explicit',
    { act: 'slay', moves: [mv('ram', 'north', 'carry', fromStep)], note: '經文沒說由誰宰。' }),
  step('priest', '祭司把血灑在壇的周圍，和燔祭、平安祭一樣。', 'around', ['利7:2'], '其血，祭司要灑在壇的周圍', 'explicit',
    { moves: [mv('blood', 'around', 'splash', 'north')] }),
  step('priest', `把肥尾巴、${fatList}取下，燒在壇上。`, 'altar', ['利7:3-5'], '祭司要在壇上焚燒', 'explicit',
    { moves: [mv('fat', 'altar', 'burn', 'north'), mv('smoke', 'altar', 'burn')] }),
  step('priest', '祭肉是至聖的，祭司中的男丁在聖處吃；歸辦這祭的祭司。', 'court', ['利7:6-7'], '要在聖處吃，是至聖的', 'explicit',
    { moves: [mv('meat', 'court', 'eat', 'north')] }),
];

const guiltOutcome = (repay: Fact): Outcome => ({
  animal: f('沒有殘疾的公綿羊，照估定的價', 'explicit', ['利5:15', '利5:18', '利6:6'], '沒有殘疾的公綿羊'),
  blood: f('灑在壇的周圍', 'explicit', ['利7:2'], '其血，祭司要灑在壇的周圍'),
  altar: f(`肥尾巴、${fatList}`, 'explicit', ['利7:3-5']),
  priest: f('祭肉歸辦這祭的祭司，男丁在聖處吃', 'explicit', ['利7:6-7'], '獻贖愆祭贖罪的祭司要得這祭物'),
  offerer: repay,
  outside: f('沒有營外焚燒的部分', 'synthesis', ['利7:1-7']),
  when: f('經文沒有規定吃的期限', 'not_stated', ['利7:1-7']),
  where: f('聖處', 'explicit', ['利7:6'], '要在聖處吃'),
});

const guilt: Offering = {
  id: 'guilt',
  name: '贖愆祭',
  tagline: '先賠償，再獻祭；不分貧富，一律一隻公綿羊。',
  chapters: '利5:14-6:7；7:1-7',
  why: f('在耶和華的聖物上有了差錯，或虧負了鄰舍；經文說這樣虧負鄰舍，就是「干犯耶和華」。', 'explicit',
    ['利5:15', '利6:2'], '干犯耶和華'),
  axes: [{ id: 'case', label: '發生了什麼事', options: [
    { id: 'holy', label: '在聖物上有差錯' }, { id: 'unknown', label: '不知道卻犯了' }, { id: 'neighbor', label: '虧負了鄰舍' }] }],
  variants: [
    {
      id: 'guilt-holy', label: '在聖物上有差錯', axis: { case: 'holy' }, refs: ['利5:14-16', '利7:1-7'],
      steps: [
        step('offerer', '照估定的價，按聖所的舍客勒，牽一隻沒有殘疾的公綿羊來。', 'front', ['利5:15'], '按聖所的舍客勒拿銀子',
          'explicit', { moves: [mv('ram', 'front', 'carry', 'gate')] }),
        step('offerer', '在聖物上虧欠的要償還，另外加五分之一，都交給祭司。', 'court', ['利5:16'], '另外加五分之一，都給祭司',
          'explicit', { moves: [mv('silver', 'court', 'carry', 'front')] }),
        ...guiltCore(),
        step('priest', '祭司用這隻公綿羊為他贖罪，他必蒙赦免。', 'altar', ['利5:16'], '他必蒙赦免'),
      ],
      outcome: guiltOutcome(f('償還所虧欠的，另加五分之一給祭司', 'explicit', ['利5:16'], '另外加五分之一，都給祭司')),
    },
    {
      id: 'guilt-unknown', label: '不知道卻犯了', axis: { case: 'unknown' }, refs: ['利5:17-19', '利7:1-7'],
      steps: [
        step('offerer', '雖然不知道，還是有了罪：照估定的價，從羊群中牽一隻沒有殘疾的公綿羊，交給祭司。', 'front', ['利5:18'],
          '從羊群中牽一隻沒有殘疾的公綿羊來，給祭司作贖愆祭', 'explicit', { moves: [mv('ram', 'front', 'carry', 'gate')] }),
        step('unstated', '要不要賠償加五分之一？這一段沒有提。', 'front', ['利5:17-19'], undefined, 'not_stated'),
        ...guiltCore(),
        step('priest', '祭司為他所誤行的贖罪，他必蒙赦免。', 'altar', ['利5:18'], '他必蒙赦免'),
      ],
      outcome: guiltOutcome(f('這一段沒有提賠償', 'not_stated', ['利5:17-19'])),
    },
    {
      id: 'guilt-neighbor', label: '虧負了鄰舍', axis: { case: 'neighbor' }, refs: ['利6:1-7', '利7:1-7'],
      steps: [
        step('offerer', '侵吞別人寄放的東西、交易上使詐、搶奪、欺壓、撿到東西不還，又為此起假誓。', 'camp', ['利6:2-3'],
          '或是在交易上行了詭詐', 'explicit'),
        step('offerer', '先如數歸還，另加五分之一，在查出他有罪的那天交還本主。', 'camp', ['利6:5'],
          '就要如數歸還，另外加上五分之一，在查出他有罪的日子要交還本主', 'explicit',
          { moves: [mv('silver', 'camp', 'carry', 'front')] }),
        step('offerer', '然後照估定的價，牽一隻沒有殘疾的公綿羊來，給祭司作贖愆祭。', 'front', ['利6:6'],
          '把贖愆祭牲─就是羊群中一隻沒有殘疾的公綿羊─牽到耶和華面前', 'explicit',
          { moves: [mv('ram', 'front', 'carry', 'gate')] }),
        ...guiltCore(),
        step('priest', '祭司在耶和華面前為他贖罪，他必蒙赦免。', 'altar', ['利6:7'], '都必蒙赦免'),
      ],
      outcome: guiltOutcome(f('如數歸還本主，另加五分之一', 'explicit', ['利6:5'], '就要如數歸還，另外加上五分之一')),
    },
  ],
  rules: [
    f('贖罪祭怎樣，贖愆祭也是怎樣，兩個祭是一個條例。', 'explicit', ['利7:7'], '贖罪祭怎樣，贖愆祭也是怎樣，兩個祭是一個條例'),
    f('不分貧富：各段都只列公綿羊，沒有替代的鳥或細麵。', 'synthesis', ['利5:15', '利5:18', '利6:6']),
  ],
};

export const OFFERINGS: Offering[] = [burnt, grain, peace, sin, guilt];

export const OFFERING_BY_ID = Object.fromEntries(OFFERINGS.map((o) => [o.id, o])) as Record<Offering['id'], Offering>;

/** 依目前各軸的選擇找出分支；百姓以外的階層忽略「百姓帶什麼來」這一軸 */
export function findVariant(offering: Offering, pick: Record<string, string>): Variant {
  const scored = offering.variants.map((v) => {
    let score = 0;
    for (const [k, val] of Object.entries(v.axis)) {
      if (pick[k] === val) score += 2;
      else score -= 3;
    }
    return { v, score };
  });
  scored.sort((a, b) => b.score - a.score);
  return scored[0].v;
}

/** 哪些軸在目前選擇下有作用（例如「百姓帶什麼來」只在選了百姓時出現） */
export function activeAxes(offering: Offering, pick: Record<string, string>) {
  const v = findVariant(offering, pick);
  return offering.axes.filter((a) => a.id in v.axis);
}

/** 平安祭、素祭的軸在所有分支都存在；贖罪祭百姓分支才有 bring 軸 */
export function defaultPick(offering: Offering): Record<string, string> {
  return { ...offering.variants[0].axis };
}

export const OUTCOME_LABELS: Record<keyof Outcome, string> = {
  animal: '帶什麼來',
  blood: '血怎麼處理',
  altar: '燒在壇上的',
  priest: '祭司得到的',
  offerer: '獻祭者得到的',
  outside: '營外的部分',
  when: '什麼時候吃完',
  where: '在哪裡吃',
};
