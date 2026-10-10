// build-data.mjs 的測試：輸出決定性；在 vault 裡再跑一次完整建置，確認沒有錯誤、兩次結果一致；
// 另外把 data/*.yaml 複製一份故意弄壞，確認每一種錯誤都會指出是哪一筆、哪個欄位。
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import YAML from 'yaml';
import { afterAll, describe, expect, it } from 'vitest';
import { buildAll, renderOutput, stableStringify } from './build-data.mjs';
import { parseOfferings } from './checks.mjs';
import { IN_VAULT, SITE_DIR } from './lib.mjs';

describe('stableStringify', () => {
  it('key 排序固定，和輸入順序無關', () => {
    expect(stableStringify({ b: 1, a: { d: [{ z: 1, y: 2 }], c: 3 } })).toBe(stableStringify({ a: { c: 3, d: [{ y: 2, z: 1 }] }, b: 1 }));
  });
  it('陣列順序保留、結尾有換行、undefined 不輸出', () => {
    const s = stableStringify({ a: [3, 1, 2], u: undefined });
    expect(JSON.parse(s)).toEqual({ a: [3, 1, 2] });
    expect(s.endsWith('\n')).toBe(true);
    expect(s).not.toContain('"u"');
  });
});

describe.skipIf(!IN_VAULT)('完整建置（需要 vault）', () => {
  it('沒有錯誤，兩次結果完全一致（不含時間戳）', () => {
    const a = buildAll();
    expect(a.errors).toEqual([]);
    const b = buildAll();
    expect(renderOutput(a.data)).toBe(renderOutput(b.data));
  });
});

const flat = (g) => g.items.map((i) => `${i.animal}${i.count}${i.role}`);

describe.skipIf(!IN_VAULT)('獻祭數字（檢查 #5）：parser 算出的結果要等於主筆讀經文得出的期望值', () => {
  const { data } = buildAll();
  const expected = {
    '民28:11-15': ['公牛犢2燔祭', '公綿羊1燔祭', '公羊羔7燔祭', '公山羊1贖罪祭'],
    '民28:19-22': ['公牛犢2燔祭', '公綿羊1燔祭', '公羊羔7燔祭', '公山羊1贖罪祭'],
    '民28:27-30': ['公牛犢2燔祭', '公綿羊1燔祭', '公羊羔7燔祭', '公山羊1贖罪'],
    '利23:18-19': ['羊羔7燔祭', '公牛犢1燔祭', '公綿羊2燔祭', '公山羊1贖罪祭', '公綿羊羔2平安祭'],
    // 民29（吹角節、贖罪日、住棚節七日與第八日）；期望值是主筆讀經文得出的，parser 不一致時先回報、不改這裡
    '民29:2-5': ['公牛犢1燔祭', '公綿羊1燔祭', '公羊羔7燔祭', '公山羊1贖罪祭'],
    '民29:8-11': ['公牛犢1燔祭', '公綿羊1燔祭', '公羊羔7燔祭', '公山羊1贖罪祭'],
    '民29:13-16': ['公牛犢13燔祭', '公綿羊2燔祭', '公羊羔14燔祭', '公山羊1贖罪祭'],
    '民29:17-19': ['公牛犢12', '公綿羊2', '公羊羔14', '公山羊1贖罪祭'],
    '民29:20-22': ['公牛11', '公羊2', '公羊羔14', '公山羊1贖罪祭'],
    '民29:23-25': ['公牛10', '公羊2', '公羊羔14', '公山羊1贖罪祭'],
    '民29:26-28': ['公牛9', '公羊2', '公羊羔14', '公山羊1贖罪祭'],
    '民29:29-31': ['公牛8', '公羊2', '公羊羔14', '公山羊1贖罪祭'],
    '民29:32-34': ['公牛7', '公羊2', '公羊羔14', '公山羊1贖罪祭'],
    '民29:36-38': ['公牛1燔祭', '公羊1燔祭', '公羊羔7燔祭', '公山羊1贖罪祭'],
  };
  for (const [ref, want] of Object.entries(expected)) {
    it(ref, () => {
      expect(data.offerings[ref]?.ref).toBe(ref);
      expect(flat(data.offerings[ref])).toEqual(want);
    });
  }
  it('story.yaml 用到的獻祭出處（offerings、bars）都有解析結果，沒有多餘的', () => {
    const used = new Set(data.chapters.flatMap((c) => c.beats.flatMap((b) => [...(b.offerings ?? []), ...(b.bars ?? []).map((x) => x.ref)])));
    expect([...used].sort()).toEqual(Object.keys(data.offerings).sort());
  });
  it('住棚節七日的公牛合計是 70（13+12+11+10+9+8+7）', () => {
    const days = ['民29:13-16', '民29:17-19', '民29:20-22', '民29:23-25', '民29:26-28', '民29:29-31', '民29:32-34'];
    const bulls = days.map((r) => data.offerings[r].items.filter((i) => i.animal.startsWith('公牛')).reduce((n, i) => n + i.count, 0));
    expect(bulls).toEqual([13, 12, 11, 10, 9, 8, 7]);
    expect(bulls.reduce((a, b) => a + b, 0)).toBe(70);
  });
  it('bulls 拍的長條圖：七條，ref 照第一到第七日', () => {
    const bulls = data.chapters.flatMap((c) => c.beats).find((b) => b.id === 'bulls');
    expect(bulls?.bars?.map((x) => x.label)).toEqual(['第一日', '第二日', '第三日', '第四日', '第五日', '第六日', '第七日']);
  });
  it('整行「併於上節。」的節不收進 lines，其他節號不變（代下30:19）', () => {
    const v = data.verses['代下30:18-20'];
    expect(v.lines.map((l) => l.v)).toEqual([18, 20]);
    expect(v.lines.some((l) => l.text.includes('併於上節'))).toBe(false);
    expect(v.from).toBe(18);
    expect(v.to).toBe(20);
  });
  it('每段經文都有 bookNum；kb 是布林；約書亞記 5 章有知識庫章頁', () => {
    for (const v of Object.values(data.verses)) {
      expect(Number.isInteger(v.bookNum), v.ref).toBe(true);
      expect(typeof v.kb, v.ref).toBe('boolean');
    }
    expect(data.verses['書5:10-12'].bookNum).toBe(6);
    expect(data.verses['書5:10-12'].kb).toBe(true);
    expect(data.verses['利23:2'].bookNum).toBe(3);
  });
});

describe('獻祭 parser 反例：有一個「隻」沒被解析就要失敗', () => {
  it('多一隻鴿子（不在動物詞表）', () => {
    const r = parseOfferings(['又要將一隻公山羊為贖罪祭，三隻斑鳩為燔祭。']);
    expect(r.errors.length).toBe(1);
    expect(r.errors[0]).toContain('三隻斑鳩為燔祭');
  });
  it('數字超出十到十九（公牛二十隻）：報錯，不誤解析', () => {
    const r = parseOfferings(['第一日要獻公牛二十隻，公羊兩隻。']);
    expect(r.errors.length).toBe(1);
    expect(r.errors[0]).toContain('公牛二十隻');
    expect(flat(r)).not.toContain('公牛20');
    expect(flat(r)).not.toContain('公牛2');
    expect(parseOfferings(['要獻二十隻公牛犢為燔祭。']).errors.length).toBe(1);
    expect(parseOfferings(['要獻公牛三十一隻為燔祭。']).errors.length).toBe(1);
  });
  it('十、十一到十九：公牛犢十三隻是 13，十二隻、十九隻、十隻照數', () => {
    expect(flat(parseOfferings(['要獻公牛犢十三隻為燔祭。']))).toEqual(['公牛犢13燔祭']);
    expect(flat(parseOfferings(['要獻十二隻公牛犢為燔祭。']))).toEqual(['公牛犢12燔祭']);
    expect(flat(parseOfferings(['要獻公牛十九隻，公羊十隻為燔祭。']))).toEqual(['公牛19燔祭', '公羊10燔祭']);
    expect(flat(parseOfferings(['要獻公牛十一隻為燔祭。']))).toEqual(['公牛11燔祭']);
  });
  it('公羊兩隻是公羊、不是公羊羔；公羊羔十四隻是公羊羔；公牛犢不被公牛吃掉', () => {
    expect(flat(parseOfferings(['要獻公羊兩隻，公羊羔十四隻，公牛犢一隻為燔祭。']))).toEqual(['公羊2燔祭', '公羊羔14燔祭', '公牛犢1燔祭']);
  });
  it('份量句裡的「隻」不算祭牲，也不報錯', () => {
    const r = parseOfferings(['要獻兩隻公牛犢為燔祭。', '為那七隻羊羔，每隻要獻伊法十分之一。']);
    expect(r.errors).toEqual([]);
    expect(flat(r)).toEqual(['公牛犢2燔祭']);
  });
  it('沒有任何祭牲也算失敗', () => {
    expect(parseOfferings(['要獻調油的細麵。']).errors.length).toBe(1);
  });
});

describe.skipIf(!IN_VAULT)('故意弄壞資料：錯誤要指出哪一筆、哪個欄位', () => {
  const tmp = mkdtempSync(join(tmpdir(), 'jf-data-'));
  afterAll(() => rmSync(tmp, { recursive: true, force: true }));

  /** 複製 data/ 到暫存資料夾，讓 mutate 改 yaml 物件，再建置 */
  function broken(mutate, { audio } = {}) {
    const dir = mkdtempSync(join(tmp, 'case-'));
    const dataDir = join(dir, 'data');
    mkdirSync(dataDir);
    const docs = {};
    for (const name of ['feasts', 'story', 'commentary', 'step', 'audio-sources']) {
      docs[name] = YAML.parse(readFileSync(resolve(SITE_DIR, 'data', `${name}.yaml`), 'utf8'));
    }
    mutate(docs);
    for (const [name, doc] of Object.entries(docs)) writeFileSync(join(dataDir, `${name}.yaml`), YAML.stringify(doc), 'utf8');
    const audioDir = join(dir, 'audio');
    mkdirSync(audioDir);
    for (const f of audio ?? []) writeFileSync(join(audioDir, f), 'x');
    return buildAll({ dataDir, audioDir }).errors;
  }
  const note = (docs, id) => docs.commentary.passover.find((n) => n.id === id);
  const hit = (errors, ...parts) => errors.some((e) => parts.every((p) => e.includes(p)));
  const allAudio = () => YAML.parse(readFileSync(resolve(SITE_DIR, 'data/audio-sources.yaml'), 'utf8')).map((a) => a.file);

  it('引文對不上 raw', () => {
    const errors = broken((d) => { note(d, 'ct-abib').quote += '（多出來的字）'; }, { audio: allAudio() });
    expect(hit(errors, 'commentary.yaml passover[ct-abib].quote', '找不到逐字原文')).toBe(true);
  });
  it('GT 歸屬寫錯', () => {
    const errors = broken((d) => { note(d, 'gt-bg-abib').work = '《丁道爾聖經註釋》'; }, { audio: allAudio() });
    expect(hit(errors, 'passover[gt-bg-abib].quote', '歸屬不符')).toBe(true);
  });
  it('KC 有 quote 沒有 quoteZh', () => {
    const errors = broken((d) => { delete note(d, 'kc-abib').quoteZh; }, { audio: allAudio() });
    expect(hit(errors, 'passover[kc-abib].quoteZh')).toBe(true);
  });
  it('quote 與 paraphrase 都沒有', () => {
    const errors = broken((d) => { delete note(d, 'ct-abib').quote; delete note(d, 'ct-abib').paraphrase; }, { audio: allAudio() });
    expect(hit(errors, 'passover[ct-abib]', '至少要有 quote 或 paraphrase')).toBe(true);
  });
  it('STEP 的 Strong 不一致', () => {
    const errors = broken((d) => { d.step.find((s) => s.id === 'abib').expect_strong = 'H25'; }, { audio: allAudio() });
    expect(hit(errors, 'step.yaml [abib]', 'H24', 'expect_strong')).toBe(true);
  });
  it('經文參照對不到 raw_scripture', () => {
    const errors = broken((d) => { d.feasts.chapters[1].passages.push('出12:99'); d.story.passover[0].verse = '出99:1'; }, { audio: allAudio() });
    expect(hit(errors, 'passages[', '出12:99', '超出')).toBe(true);
    expect(hit(errors, 'story.yaml passover[blood].verse', '出99')).toBe(true);
  });
  it('條目不存在', () => {
    const errors = broken((d) => { d.feasts.chapters[1].entries.push('不存在的條目'); }, { audio: allAudio() });
    expect(hit(errors, 'feasts.yaml chapters[passover].entries[', '不存在的條目')).toBe(true);
  });
  it('story 引用不存在的註釋與原文字、==高亮== 兩處', () => {
    const errors = broken((d) => {
      d.story.passover[0].notes = ['no-such-note'];
      d.story.passover[0].words = ['no-such-word'];
      d.story.passover[0].text = '==甲==和==乙==';
    }, { audio: allAudio() });
    expect(hit(errors, 'story.yaml passover[blood].notes', 'no-such-note')).toBe(true);
    expect(hit(errors, 'story.yaml passover[blood].words', 'no-such-word')).toBe(true);
    expect(hit(errors, 'story.yaml passover[blood].text', '最多一處')).toBe(true);
  });
  it('beat 欄位：interaction、day、dayTo、badge、offerings', () => {
    const errors = broken((d) => {
      const [a, b, c, e] = d.story.unleavened;
      a.interaction = 'jump';
      b.day = 31;
      c.day = 15; c.dayTo = 15;
      e.badge = '';
      d.story.passover[0].dayTo = 20;
      d.story.passover[1].offerings = ['出12:99'];
      d.story.passover[2].offerings = ['出12:21-28'];
    }, { audio: allAudio() });
    expect(hit(errors, 'unleavened[bake].interaction', 'hyssop/bake/wave/count')).toBe(true);
    expect(hit(errors, 'unleavened[seven-days].day', '1–30')).toBe(true);
    expect(hit(errors, 'unleavened[no-leaven].dayTo', '大於 day')).toBe(true);
    expect(hit(errors, 'unleavened[remember].badge')).toBe(true);
    expect(hit(errors, 'passover[blood].dayTo', '一定要有 day')).toBe(true);
    expect(hit(errors, 'passover[hyssop].offerings[0]', '超出')).toBe(true);
    expect(hit(errors, 'passover[door].offerings[0]', '沒有解析出任何祭牲')).toBe(true);
  });
  it('offeringsLabel：沒有 offerings、太長、空字串', () => {
    const errors = broken((d) => {
      d.story.passover[0].offeringsLabel = '每日';
      d.story.passover[1].offerings = ['民28:19-22'];
      d.story.passover[1].offeringsLabel = '這個標籤實在是太長太長太長了';
      d.story.passover[2].offerings = ['民28:19-22'];
      d.story.passover[2].offeringsLabel = '';
    }, { audio: allAudio() });
    expect(hit(errors, 'passover[blood].offeringsLabel', '一定要有 offerings')).toBe(true);
    expect(hit(errors, 'passover[hyssop].offeringsLabel', '超過 12 字')).toBe(true);
    expect(hit(errors, 'passover[door].offeringsLabel', '非空字串')).toBe(true);
  });
  const chapterOf = (docs, id) => docs.feasts.chapters.find((c) => c.id === id);
  it('回聲 echoes：指到不存在的拍、指自己、空陣列', () => {
    const errors = broken((d) => {
      d.story.firstfruits.find((b) => b.id === 'gilgal').echoes = ['no-such-beat'];
      d.story.weeks.find((b) => b.id === 'ruth').echoes = ['ruth'];
      d.story.trumpets.find((b) => b.id === 'ezra-reads').echoes = [];
    }, { audio: allAudio() });
    expect(hit(errors, 'firstfruits[gilgal].echoes[0]', 'no-such-beat')).toBe(true);
    expect(hit(errors, 'weeks[ruth].echoes[0]', '自己')).toBe(true);
    expect(hit(errors, 'trumpets[ezra-reads].echoes')).toBe(true);
  });
  it('長條圖 bars：ref 沒有公牛、ref 解析不出、缺 label、多餘欄位', () => {
    const errors = broken((d) => {
      const bars = d.story.booths.find((b) => b.id === 'bulls').bars;
      bars[0].ref = '出29:38';
      bars[1].ref = '民29:99';
      delete bars[2].label;
      bars[3].extra = 1;
    }, { audio: allAudio() });
    expect(hit(errors, 'booths[bulls].bars[0].ref', '公牛')).toBe(true);
    expect(hit(errors, 'booths[bulls].bars[1].ref', '民29:99')).toBe(true);
    expect(hit(errors, 'booths[bulls].bars[2].label')).toBe(true);
    expect(hit(errors, 'booths[bulls].bars[3]', 'extra')).toBe(true);
  });
  it('passage 章：缺 month／monthTo、monthTo 不大於 month、拍不可有文字與註釋', () => {
    const errors = broken((d) => {
      delete chapterOf(d, 'summer').monthTo;
      d.story.summer[0].text = '有字';
      d.story.summer[0].notes = ['ct-abib'];
      chapterOf(d, 'trumpets').monthTo = 8;
    }, { audio: allAudio() });
    expect(hit(errors, 'chapters[summer].monthTo', '一定要有')).toBe(true);
    expect(hit(errors, 'summer[summer].text', '空字串')).toBe(true);
    expect(hit(errors, 'summer[summer].notes', 'passage')).toBe(true);
    expect(hit(errors, 'chapters[trumpets].monthTo', '只有 passage')).toBe(true);
    const e2 = broken((d) => { delete chapterOf(d, 'summer').month; }, { audio: allAudio() });
    expect(hit(e2, 'chapters[summer].month', '一定要有')).toBe(true);
    const e3 = broken((d) => { chapterOf(d, 'summer').monthTo = 3; }, { audio: allAudio() });
    expect(hit(e3, 'chapters[summer].monthTo', '大於 month')).toBe(true);
  });
  it('passage 章可以沒有 month／monthTo（coda）；只有 monthTo 或只有 month 才報錯', () => {
    const ok = broken((d) => { delete chapterOf(d, 'summer').month; delete chapterOf(d, 'summer').monthTo; }, { audio: allAudio() });
    expect(ok.filter((e) => e.includes('chapters[summer]'))).toEqual([]);
    const e1 = broken((d) => { delete chapterOf(d, 'summer').monthTo; }, { audio: allAudio() });
    expect(hit(e1, 'chapters[summer].monthTo', '有 month 就一定要有 monthTo')).toBe(true);
    const e2 = broken((d) => { delete chapterOf(d, 'summer').month; }, { audio: allAudio() });
    expect(hit(e2, 'chapters[summer].month', '有 monthTo 就一定要有 month')).toBe(true);
  });
  it('回看 recall：指到不存在的拍、指自己、重複、空陣列、passage 不可有', () => {
    const errors = broken((d) => {
      d.story.sevens.find((b) => b.id === 'seven-weeks').recall = ['no-such-beat'];
      d.story.sevens.find((b) => b.id === 'month-seven').recall = ['month-seven'];
      d.story.sevens.find((b) => b.id === 'read-law').recall = ['booth', 'booth'];
      d.story.sevens.find((b) => b.id === 'jubilee-horn').recall = [];
      d.story.coda[0].recall = ['count'];
    }, { audio: allAudio() });
    expect(hit(errors, 'sevens[seven-weeks].recall[0]', 'no-such-beat')).toBe(true);
    expect(hit(errors, 'sevens[month-seven].recall[0]', '自己')).toBe(true);
    expect(hit(errors, 'sevens[read-law].recall[1]', '重複')).toBe(true);
    expect(hit(errors, 'sevens[jubilee-horn].recall')).toBe(true);
    expect(hit(errors, 'coda[', 'recall', 'passage')).toBe(true);
  });
  it('law_links：章 id 不存在、律法地圖沒有這個條文、重複、空陣列；正常時標題寫進 StoryChapter.laws', () => {
    const errors = broken((d) => {
      d.feasts.law_links['no-such-chapter'] = ['lev23-03'];
      d.feasts.law_links.trumpets = ['no-such-law', 'lev23-24', 'lev23-24'];
      d.feasts.law_links.atonement = [];
    }, { audio: allAudio() });
    expect(hit(errors, 'law_links [no-such-chapter]', '章 id')).toBe(true);
    expect(hit(errors, 'law_links [trumpets]', 'no-such-law')).toBe(true);
    expect(hit(errors, 'law_links [trumpets]', 'lev23-24', '重複')).toBe(true);
    expect(hit(errors, 'law_links [atonement]')).toBe(true);
    const sevens = buildAll().data.chapters.find((c) => c.id === 'sevens');
    expect(sevens.laws?.every((l) => l.id && l.title)).toBe(true);
    expect(sevens.laws?.find((l) => l.id === 'lev23-03')?.title).toContain('安息日');
  });
  it('七的倍數（#6）：SiteData.sevens 是 7、49、50', () => {
    expect(buildAll().data.sevens).toEqual({ days: 7, weeks49: 49, fifty: 50 });
  });
  it('書卷簡稱「耶」「結」：commentary 的 chapter 欄與經文參照都認得', () => {
    const { data } = buildAll();
    expect(data.verses['耶34:8-11']?.book).toBe('耶利米書');
    expect(data.verses['結46:16-17']?.book).toBe('以西結書');
    expect(Object.values(data.commentary).some((n) => n.book === '耶利米書' && n.chapter === 34)).toBe(true);
  });
  it('moreVerses：和 verse 重複、重複的出處、對不到經文、空陣列、passage 不可有', () => {
    const errors = broken((d) => {
      const bs = d.story.weeks.find((b) => b.id === 'ruth');
      bs.moreVerses = [bs.verse, '得2:99', '得2:23', '得2:23'];
      d.story.trumpets.find((b) => b.id === 'ezra-reads').moreVerses = [];
      d.story.summer[0].moreVerses = ['得2:23'];
    }, { audio: allAudio() });
    expect(hit(errors, 'weeks[ruth].moreVerses[0]', '重複')).toBe(true);
    expect(hit(errors, 'weeks[ruth].moreVerses[1]', '得2:99', '超出')).toBe(true);
    expect(hit(errors, 'weeks[ruth].moreVerses[3]', '重複')).toBe(true);
    expect(hit(errors, 'trumpets[ezra-reads].moreVerses')).toBe(true);
    expect(hit(errors, 'summer[summer].moreVerses', 'passage')).toBe(true);
  });
  it('非 passage 的拍 text 不可以是空字串', () => {
    const errors = broken((d) => { d.story.trumpets[0].text = ''; }, { audio: allAudio() });
    expect(hit(errors, 'trumpets[seventh-month].text', '非空字串')).toBe(true);
  });
  it('ot：kind 不對、ref 對不到經文、note 空或超過 120 字', () => {
    const errors = broken((d) => {
      const ot = chapterOf(d, 'trumpets').ot;
      ot[0].kind = 'later';
      ot[1].ref = '詩81:99';
      ot[2].note = '';
      ot[3].note = '字'.repeat(121);
    }, { audio: allAudio() });
    expect(hit(errors, 'chapters[trumpets].ot[0].kind', 'kept')).toBe(true);
    expect(hit(errors, 'chapters[trumpets].ot[1].ref', '超出')).toBe(true);
    expect(hit(errors, 'chapters[trumpets].ot[2].note', '非空字串')).toBe(true);
    expect(hit(errors, 'chapters[trumpets].ot[3].note', '120 字')).toBe(true);
  });
  it('later_palette：缺色、色碼不對', () => {
    const errors = broken((d) => { delete d.feasts.later_palette.glow; d.feasts.later_palette.paper = 'beige'; }, { audio: allAudio() });
    expect(hit(errors, 'later_palette.glow')).toBe(true);
    expect(hit(errors, 'later_palette.paper')).toBe(true);
  });
  it('others：ref 解析失敗、經節不存在、未知欄位', () => {
    const errors = broken((d) => {
      d.feasts.others.items[0].refs = ['斯9:20-22', '斯99:1'];
      d.feasts.others.items[1].refs = ['約10:99'];
      d.feasts.others.items[2].refs = ['亞七3'];
      d.feasts.others.items[3].extra = 'x';
      d.feasts.others.sub = 'x';
    }, { audio: allAudio() });
    expect(hit(errors, 'others.items[普珥日].refs[1]', '斯99')).toBe(true);
    expect(hit(errors, 'others.items[修殿節].refs[0]', '超出')).toBe(true);
    expect(hit(errors, 'others.items[', '經文參照格式不對')).toBe(true);
    expect(hit(errors, 'others.items[耶羅波安定的八月節期]', '不認得的欄位「extra」')).toBe(true);
    expect(hit(errors, 'feasts.yaml others', '不認得的欄位「sub」')).toBe(true);
  });
  it('others：note 的「…」引文不在該項經文裡（含只在別項經文裡）', () => {
    const errors = broken((d) => {
      d.feasts.others.items[0].note = '猶大人稱這兩日為「普珥的名稱」。';
      d.feasts.others.items[1].note = '耶穌在殿裡行走，又說「每年按時必守這兩日」。';
    }, { audio: allAudio() });
    expect(hit(errors, 'others.items[普珥日].note', '普珥的名稱')).toBe(true);
    expect(hit(errors, 'others.items[修殿節].note', '每年按時必守這兩日')).toBe(true);
  });
  it('others：sources 的檔名格式不對、檔案不存在；合法的檔名不報錯', () => {
    const errors = broken((d) => {
      d.feasts.others.items[0].sources = ['隨便寫', 'biblehub_study_daniel_99', 'ccbiblestudy_CT_esther_3'];  // 第三個是合法的
    }, { audio: allAudio() });
    expect(hit(errors, 'others.items[普珥日].sources[0]', '檔名格式不對')).toBe(true);
    expect(hit(errors, 'others.items[普珥日].sources[1]', 'daniel_99.txt 不存在')).toBe(true);
    expect(hit(errors, 'others.items[普珥日].sources[2]')).toBe(false);
  });
  it('others：sources 併進 SiteData.sources（但以理書 8 章 BibleHub、撒迦利亞書 8 章 CT），網址取自 manifest', () => {
    const { data } = buildAll();
    const find = (book, ch, src) => data.sources.find((x) => x.book === book && x.chapter === ch && x.source === src);
    expect(find('但以理書', 8, 'BH')?.url).toMatch(/^https:\/\/biblehub\.com\/study\/daniel\/8\.htm/);
    expect(find('撒迦利亞書', 8, 'CT')?.url).toMatch(/^https:\/\/www\.ccbiblestudy\.org\//);
    const withSrc = data.others.items.filter((it) => it.sources?.length);
    expect(withSrc.length).toBeGreaterThan(0);
  });
  it('others：正例——產出 verses，每個 ref 一筆', () => {
    const { data, errors } = buildAll();
    expect(errors).toEqual([]);
    const o = data.others;
    expect(o.items.length).toBeGreaterThan(0);
    for (const it of o.items) {
      expect(it.verses.map((v) => v.ref)).toEqual(it.refs);
      for (const v of it.verses) expect(v.text.length).toBeGreaterThan(0);
    }
  });
  it('音檔：沒有授權紀錄、檔案不存在、授權不是 CC0、pages 不含 page', () => {
    const errors = broken((d) => {
      d['audio-sources'][0].license = 'CC-BY';
      d['audio-sources'][1].pages = ['https://example.org/x'];
    }, { audio: ['night-wind.mp3', 'lamb.mp3', 'stray.mp3'] });
    expect(hit(errors, 'public/audio/stray.mp3', '沒有授權紀錄')).toBe(true);
    expect(hit(errors, 'audio-sources.yaml [dip].file', 'dip.mp3')).toBe(true);
    expect(hit(errors, 'audio-sources.yaml [night-wind]', 'CC0')).toBe(true);
    expect(hit(errors, 'audio-sources.yaml [lamb]', '包含 page')).toBe(true);
  });
});
