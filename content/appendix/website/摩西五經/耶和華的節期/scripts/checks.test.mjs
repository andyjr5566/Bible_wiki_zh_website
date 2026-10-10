// checks.mjs 的測試：引文比對、GT 歸屬（含故意歸屬錯誤的反例）、==高亮== 計數、STEP 抽取、音檔欄位。
// 另有一組拿真實 raw 做的反例（只在 vault 裡跑）。
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  attributionAfter, checkAudioEntry, checkGtAttribution, checkHighlights, checkNoteQuotes, checkQuote, countHighlights,
  extractStepWord, findQuote, gtWorkInRaw, mismatchHint, parseCnCount, parseSevens, quotedParts, stepWordFrom, stripSpaces,
} from './checks.mjs';
import { IN_VAULT, ROOT, chapterVerses, parseStepFile, readRaw } from './lib.mjs';

// 仿 ccbiblestudy 拾穗的格式：歸屬接在段尾，可能換行；一組歸屬可蓋住前面好幾段；正文也有當破折號用的 ──
const GT = [
  '【出十二1】',
  '',
  '“耶和華”——凡關係以色列人政治、社會、宗教的事都是神所指定的。“在埃及地”！這幾個字顯明兩層意思。──',
  '丁良才《出埃及記註釋》',
  '',
  '這逾越節的定例是在埃及地首次頒佈，後來在西乃還會重提。──《串珠聖經註釋》',
  '',
  '在埃及地。以色列其餘的律法在西乃山頒布，但本節強調逾越節是西乃之前在埃及設立的。',
  '',
  '逾越節的祭牲是一歲大的綿羊或山羊──傳統上所譯的『山羊羔』一詞是誤導的。──《丁道爾聖經註釋》',
  '',
  '埃及人由於失去長子而嚎哭的當晚,對以色列人來說是,連狗都不叫一聲的平安之夜。',
  '──《聖經精讀本──出埃及記註解》',
  '',
  '沒有歸屬的最後一段文字。',
].join('\n');

describe('引文逐字比對', () => {
  it('空白與換行不計', () => {
    expect(findQuote(GT, '這逾越節的定例是在埃及地首次頒佈')).toHaveLength(1);
    expect(findQuote(GT, '丁良才 《出埃及記註釋》')).toHaveLength(1);
    expect(findQuote(GT, '以色列人政治、社會、\n宗教的事')).toHaveLength(1);
  });
  it('標點、全半形、引號不做正規化', () => {
    expect(findQuote(GT, '嚎哭的當晚,對以色列人來說是,連狗')).toHaveLength(1);
    expect(findQuote(GT, '嚎哭的當晚，對以色列人來說是，連狗')).toHaveLength(0); // 半形逗號寫成全形
    expect(findQuote(GT, '「耶和華」——凡關係')).toHaveLength(0); // “ ” 寫成 「 」
    expect(findQuote(GT, '“耶和華”——凡關係')).toHaveLength(1);
  });
  it('英文引文：彎引號要原樣', () => {
    const kc = 'Abib means ‘fresh, young ears’, for example from the barley.';
    expect(findQuote(kc, 'Abib means ‘fresh, young ears’')).toHaveLength(1);
    expect(findQuote(kc, "Abib means 'fresh, young ears'")).toHaveLength(0);
  });
  it('對不上時指出從哪裡開始不同', () => {
    const hint = mismatchHint(GT, '這逾越節的定例是在埃及地首次頒布');
    expect(hint).toContain('前 15 個字');
    expect(hint).toContain('引文接著是「布」');
    expect(hint).toContain('raw 接著是「佈，');
  });
});

describe('GT 歸屬', () => {
  const hitsOf = (q) => findQuote(GT, q);

  it('標記後換行接出處：丁良才', () => {
    expect(checkGtAttribution(GT, hitsOf('這幾個字顯明兩層意思'), '丁良才《出埃及記註釋》')).toBeNull();
  });
  it('單行歸屬：串珠', () => {
    expect(checkGtAttribution(GT, hitsOf('後來在西乃還會重提'), '《串珠聖經註釋》')).toBeNull();
  });
  it('歸屬標記的破折號字元：－－ 換行、―― 同行、—— 當正文破折號仍略過', () => {
    const raw = [
      '利二十三章的第一段。',
      '－－',
      '《聖經精讀本──利未記註解》',
      '',
      '“一歲的”——預表基督沒有瑕疵，這是整句話不是出處。――《靈修版聖經註釋》',
      '',
      '“一歲的”——預表基督沒有瑕疵，這是整句話不是出處，後面沒有任何標記。',
    ].join('\n');
    const a1 = attributionAfter(raw, raw.indexOf('第一段') + 3);
    expect(a1?.line).toBe('《聖經精讀本──利未記註解》');
    const a2 = attributionAfter(raw, raw.indexOf('“一歲的”'));
    expect(a2?.line).toBe('《靈修版聖經註釋》');
    const last = raw.lastIndexOf('“一歲的”');
    expect(attributionAfter(raw, last)).toBeNull();
    expect(checkGtAttribution(raw, [{ start: 0, end: raw.indexOf('第一段') + 3 }], '《聖經精讀本──利未記註解》')).toBeNull();
  });
  it('正文裡的 ── 破折號不當歸屬', () => {
    expect(attributionAfter(GT, hitsOf('逾越節的祭牲是一歲大的綿羊')[0].end)?.line).toBe('《丁道爾聖經註釋》');
    expect(checkGtAttribution(GT, hitsOf('逾越節的祭牲是一歲大的綿羊'), '《丁道爾聖經註釋》')).toBeNull();
  });
  it('反例：本段沒有標記，不拿下一段（空行之後）的標記替它掛名', () => {
    expect(attributionAfter(GT, hitsOf('在埃及地。以色列其餘的律法')[0].end)).toBeNull();
    expect(checkGtAttribution(GT, hitsOf('在埃及地。以色列其餘的律法'), '《丁道爾聖經註釋》')).toContain('找不到 ── 歸屬');
  });
  it('出處名稱裡面有 ── 也能比對', () => {
    expect(checkGtAttribution(GT, hitsOf('連狗都不叫一聲的平安之夜'), '《聖經精讀本──出埃及記註解》')).toBeNull();
  });
  it('反例：歸屬寫錯子來源', () => {
    const e = checkGtAttribution(GT, hitsOf('後來在西乃還會重提'), '《丁道爾聖經註釋》');
    expect(e).toContain('歸屬不符');
    expect(e).toContain('《串珠聖經註釋》');
    expect(checkGtAttribution(GT, hitsOf('在埃及地。以色列其餘的律法'), '《串珠聖經註釋》')).toContain('歸屬不符');
    expect(checkGtAttribution(GT, hitsOf('連狗都不叫一聲的平安之夜'), '《舊約聖經背景註釋》')).toContain('歸屬不符');
  });
  it('反例：引文之後沒有任何歸屬', () => {
    expect(checkGtAttribution(GT, hitsOf('沒有歸屬的最後一段文字'), '《丁道爾聖經註釋》')).toContain('找不到 ── 歸屬');
  });
  it('只有轉述的 GT：子來源名稱要出現在 raw', () => {
    expect(gtWorkInRaw(GT, '《丁道爾聖經註釋》')).toBe(true);
    expect(gtWorkInRaw(GT, '丁良才《出埃及記註釋》')).toBe(true);
    expect(gtWorkInRaw(GT, '《舊約聖經背景註釋》')).toBe(false);
  });
  it('checkQuote：非 GT 不檢查歸屬；GT 轉述走子來源檢查', () => {
    expect(checkQuote({ source: 'CT', quote: '後來在西乃還會重提', work: '黃迦勒《出埃及記註解》' }, GT, 'x.txt')).toEqual([]);
    expect(checkQuote({ source: 'GT', quote: '後來在西乃還會重提', work: '《丁道爾聖經註釋》' }, GT, 'x.txt')).toHaveLength(1);
    expect(checkQuote({ source: 'GT', quote: '根本沒有這句話', work: '《串珠聖經註釋》' }, GT, 'x.txt')[0]).toContain('找不到逐字原文');
    expect(checkQuote({ source: 'GT', paraphrase: '轉述', work: '《舊約聖經背景註釋》' }, GT, 'x.txt')[0]).toContain('沒有出現在');
    expect(checkQuote({ source: 'GT', paraphrase: '轉述', work: '《串珠聖經註釋》' }, GT, 'x.txt')).toEqual([]);
  });
});

describe('==高亮== 計數', () => {
  it('每段最多一處、要成對', () => {
    expect(countHighlights('沒有高亮')).toEqual({ count: 0, stray: false });
    expect(countHighlights('這一句有==一處==高亮')).toEqual({ count: 1, stray: false });
    expect(countHighlights('==甲==和==乙==').count).toBe(2);
    expect(countHighlights('落單的==沒有收尾').stray).toBe(true);
    expect(checkHighlights('這一句有==一處==高亮')).toEqual([]);
    expect(checkHighlights('==甲==和==乙==')[0]).toContain('最多一處');
    expect(checkHighlights('落單的==沒有收尾')[0]).toContain('沒有成對');
    expect(checkHighlights(undefined)).toEqual([]);
  });
});

describe('STEP 抽取與驗證', () => {
  const map = parseStepFile([
    '## Exodus 13:4',
    '',
    '**Original:** הַיּ֖וֹם אַתֶּ֣ם יֹצְאִ֑ים בְּחֹ֖דֶשׁ הָאָבִֽיב׃',
    '',
    '| # | 原文 | Transliteration | Context gloss | Strong | Morphology | Brief lexicon |',
    '|---:|---|---|---|---|---|---|',
    '| 4 | בְּ/חֹ֖דֶשׁ | be./Cho.desh | in/ [the] month of | H2320G | HR/Ncmsc — Preposition + Noun (Singular Masculine, Construct) | חֹ֫דֶשׁ (cho.desh): month |',
    '| 5 | הָ/אָבִֽיב\\׃ | ha./\'a.Viv | <the>/ Abib | H24 | HTd/Ntbsa — Definite article (Hebrew) + Noun (Title, Singular Either gender, Absolute) | אָבִיב (a.viv): Abib |',
  ].join('\n'));
  const where = { chapter: 13, verse: 4, en: 'Exodus' };

  it('去掉分隔符，欄位照 STEP', () => {
    const { word, errors } = extractStepWord({ position: 5, expect_strong: 'H24' }, map, where);
    expect(errors).toEqual([]);
    expect(word).toEqual({
      hebrew: 'הָאָבִֽיב׃',
      translit: "ha.'a.Viv",
      gloss: '<the> Abib',
      strong: 'H24',
      morph: 'HTd/Ntbsa',
      morphText: 'Definite article (Hebrew) + Noun (Title, Singular Either gender, Absolute)',
      lexicon: 'אָבִיב (a.viv): Abib',
    });
  });
  it('stepWordFrom：gloss 的詞素分隔 / 去掉', () => {
    expect(stepWordFrom({ hebrewRaw: 'x', translitRaw: 'a./b', glossRaw: 'in/ [the] month of', strong: 'H1', morphRaw: 'A — B — C', lexicon: 'l' })).toMatchObject({
      gloss: 'in [the] month of',
      translit: 'a.b',
      morph: 'A',
      morphText: 'B — C',
    });
  });
  it('反例：Strong 與 expect_strong 不一致（position 寫錯）', () => {
    const { errors } = extractStepWord({ position: 4, expect_strong: 'H24' }, map, where);
    expect(errors[0]).toContain('H2320G');
    expect(errors[0]).toContain('expect_strong');
  });
  it('反例：位置不存在、節不存在、書名不對', () => {
    expect(extractStepWord({ position: 9, expect_strong: 'H24' }, map, where).errors[0]).toContain('第 9 個字不存在');
    expect(extractStepWord({ position: 1, expect_strong: 'H24' }, map, { ...where, verse: 9 }).errors[0]).toContain('找不到');
    expect(extractStepWord({ position: 5, expect_strong: 'H24' }, map, { ...where, en: 'Leviticus' }).errors[0]).toContain('書名');
  });
  it('反例：希伯來字不是 Original 行的子字串（手打的）', () => {
    const forged = parseStepFile([
      '## Exodus 13:4',
      '**Original:** הַיּ֖וֹם אַתֶּ֣ם',
      '| 5 | הָ/אָבִֽיב\\׃ | ha./\'a.Viv | <the>/ Abib | H24 | HTd/Ntbsa — x | l |',
    ].join('\n'));
    const { errors } = extractStepWord({ position: 5, expect_strong: 'H24' }, forged, where);
    expect(errors.join()).toContain('子字串');
  });
  it('原文行尾的 \\ \\פ 標記也能比對（去掉跳脫後）', () => {
    const m = parseStepFile([
      '## Exodus 12:8',
      '**Original:** וְאָכְל֨וּ מַצּֽוֹת׃\\ \\פ',
      '| 1 | מַצּֽוֹת׃ פ | mat.Tzot | unleavened bread | H4682 | HNcfpa — Noun | l |',
    ].join('\n'));
    expect(extractStepWord({ position: 1, expect_strong: 'H4682' }, m, { chapter: 12, verse: 8, en: 'Exodus' }).errors).toEqual([]);
  });
});

describe('音檔欄位', () => {
  const ok = {
    id: 'a', file: 'a.mp3', title: 't', author: 'x', license: 'CC0',
    page: 'https://freesound.org/people/x/sounds/1/', downloaded: '2026-10-09',
  };
  it('合格', () => {
    expect(checkAudioEntry(ok)).toEqual([]);
    expect(checkAudioEntry({ ...ok, loop: true, edit: '取 20–60 秒' })).toEqual([]);
    expect(checkAudioEntry({ ...ok, pages: [ok.page, 'https://freesound.org/people/y/sounds/2/'] })).toEqual([]);
  });
  it('反例', () => {
    expect(checkAudioEntry({ ...ok, license: 'CC-BY' })[0]).toContain('CC0');
    expect(checkAudioEntry({ ...ok, page: 'ftp://x' })[0]).toContain('http(s)');
    expect(checkAudioEntry({ ...ok, page: undefined })[0]).toContain('page');
    expect(checkAudioEntry({ ...ok, downloaded: '2026-13-40' })[0]).toContain('YYYY-MM-DD');
    expect(checkAudioEntry({ ...ok, downloaded: '2026/10/09' })[0]).toContain('YYYY-MM-DD');
    expect(checkAudioEntry({ ...ok, pages: ['https://freesound.org/people/y/sounds/2/'] })[0]).toContain('包含 page');
    expect(checkAudioEntry({ ...ok, pages: [ok.page, 'not a url'] })[0]).toContain('pages[1]');
    expect(checkAudioEntry({ ...ok, pages: [] })[0]).toContain('pages');
    expect(checkAudioEntry({ ...ok, edit: '' })[0]).toContain('edit');
    expect(checkAudioEntry({ ...ok, loop: 'yes' })[0]).toContain('loop');
    expect(checkAudioEntry({ ...ok, title: '' })[0]).toContain('title');
  });
});

// 拿真實 raw 做反例：把歸屬改錯一定要被擋下來（只在 vault 裡跑）
describe.skipIf(!IN_VAULT)('真實 raw 的反例', () => {
  const gt = IN_VAULT ? readRaw(resolve(ROOT, 'raw_data/ccbiblestudy_GT_exodus_12.txt')) : '';
  const quote = '亞筆月在每年春分（spring equinox）之後第一個新月開始，通常是從公曆三月中延伸到四月中。';
  it('正確歸屬通過、錯誤歸屬被擋', () => {
    expect(checkQuote({ source: 'GT', quote, work: '《舊約聖經背景註釋》' }, gt, 'GT12')).toEqual([]);
    expect(checkQuote({ source: 'GT', quote, work: '《丁道爾聖經註釋》' }, gt, 'GT12')[0]).toContain('歸屬不符');
    expect(checkQuote({ source: 'GT', quote: `${quote}多一句`, work: '《舊約聖經背景註釋》' }, gt, 'GT12')[0]).toContain('找不到逐字原文');
  });
});

describe('七的倍數（檢查 #6）', () => {
  const L23 = '你們要從安息日的次日，獻禾捆為搖祭的那日算起，要滿了七個安息日。到第七個安息日的次日，共計五十天，又要將新素祭獻給耶和華。';
  const L258 = '你要計算七個安息年，就是七七年。這便為你成了七個安息年，共是四十九年。';
  const L2510 = '第五十年，你們要當作聖年，在遍地給一切的居民宣告自由。這年必為你們的禧年，各人要歸自己的產業，各歸本家。';
  const ok = { lev23_15_16: L23, lev25_8: L258, lev25_10: L2510 };
  it('中文數字：七、十、十二、二十、四十九、五十', () => {
    expect(['七', '十', '十二', '二十', '四十九', '五十'].map(parseCnCount)).toEqual([7, 10, 12, 20, 49, 50]);
    expect(parseCnCount('百')).toBeNaN();
  });
  it('固定字串：解析出 7、49、50', () => {
    expect(parseSevens(ok)).toEqual({ days: 7, weeks49: 49, fifty: 50, errors: [] });
  });
  it('反例：改壞文字要報錯', () => {
    const bad = (patch) => parseSevens({ ...ok, ...patch }).errors;
    expect(bad({ lev23_15_16: L23.replace('七個安息日', '八個安息日') }).join()).toContain('應為');
    expect(bad({ lev23_15_16: L23.replace('五十天', '四十九天') }).join()).toContain('利23:16');
    expect(bad({ lev25_8: L258.replace('四十九年', '五十年') }).join()).toContain('七七應為 49');
    expect(bad({ lev25_8: L258.replace('就是七七年', '就是七年') }).join()).toContain('七七年');
    expect(bad({ lev25_10: L2510.replace('第五十年', '第四十九年') }).join()).toContain('應為 50');
    expect(bad({ lev25_10: '這年必為你們的禧年。' }).join()).toContain('利25:10');
    expect(bad({ lev23_15_16: '' }).length).toBeGreaterThan(0);
  });
  it.skipIf(!IN_VAULT)('真實 raw_scripture：7、49、50', () => {
    const lev = (ch, a, b) => chapterVerses('利未記', ch).slice(a - 1, b).join('');
    const r = parseSevens({ lev23_15_16: lev(23, 15, 16), lev25_8: lev(25, 8, 8), lev25_10: lev(25, 10, 10) });
    expect(r).toEqual({ days: 7, weeks49: 49, fifty: 50, errors: [] });
  });
});

describe('頁尾「聖經裡還有的節期」：note 引文', () => {
  const verses = ['猶大人照著末底改寫給他們的書信，按年按時守這兩日。', '所以猶大人照著普珥的名字，稱這兩日為普珥日。'];
  it('逐字出現就過（空白不計）', () => {
    expect(checkNoteQuotes('稱這兩日為「普珥 的名字」。', verses)).toEqual([]);
    expect(checkNoteQuotes('沒有引文的一句話。', verses)).toEqual([]);
  });
  it('引文跨節也算（把各節接起來比對）', () => {
    expect(checkNoteQuotes('「按年按時守這兩日。所以猶大人」', verses)).toEqual([]);
  });
  it('對不上就報錯，每個壞引文一筆', () => {
    const e = checkNoteQuotes('「普珥的名稱」與「按年按時守這兩日」與「不存在的句子」', verses);
    expect(e).toHaveLength(2);
    expect(e[0]).toContain('普珥的名稱');
  });
  it('quotedParts 取出所有「…」', () => {
    expect(quotedParts('甲「一」乙「二三」丙')).toEqual(['一', '二三']);
  });
});
