import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { buildParallelDiff } from './diff';
import { chapterUrl, entryUrl, genealogyUrl, wildernessUrl } from './links';
import type { CommentaryItem, SiteData } from './types';

const here = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = resolve(here, '../..');
const VAULT_ROOT = resolve(PROJECT_DIR, '../../../..');

const site: SiteData = JSON.parse(readFileSync(resolve(PROJECT_DIR, 'src/data/site.json'), 'utf8'));
const versesJson: { verses: Record<string, string> } = JSON.parse(
  readFileSync(resolve(PROJECT_DIR, 'src/data/verses.json'), 'utf8'),
);
const stepJson: {
  tokensByKey: Record<
    string,
    {
      hebrew: string;
      lexicon: string;
      headword: string;
    }
  >;
} = JSON.parse(readFileSync(resolve(PROJECT_DIR, 'src/data/step.json'), 'utf8'));

const hasVaultRawData = existsSync(resolve(VAULT_ROOT, 'raw_data/ccbiblestudy_GT_joshua_24.txt'));
const hasVaultScripture = existsSync(resolve(VAULT_ROOT, 'raw_scripture'));
const hasVaultLinks = existsSync(resolve(VAULT_ROOT, 'link_folder'));
const hasGenealogyJson = existsSync(
  resolve(VAULT_ROOT, 'appendix/website/全聖經/亞當到耶穌/src/data/genealogy.json'),
);

/** 收集全站所有 CommentaryItem 以便統一進行閘門 2 檢驗 */
function collectAllCommentaryItems(data: SiteData): { path: string; item: CommentaryItem }[] {
  const list: { path: string; item: CommentaryItem }[] = [];

  for (const seg of data.segments) {
    for (const beat of seg.beats) {
      for (const c of beat.commentaries ?? []) {
        list.push({ path: `beat:${beat.id}.commentaries:${c.id}`, item: c });
      }
      for (const c of beat.daughterQA?.notes ?? []) {
        list.push({ path: `beat:${beat.id}.daughterQA:${c.id}`, item: c });
      }
    }
  }

  for (const card of data.readingCards) {
    for (const c of card.views) {
      list.push({ path: `card:${card.id}.views:${c.id}`, item: c });
    }
  }

  for (const c of data.onlyIBasis) list.push({ path: `onlyIBasis:${c.id}`, item: c });
  for (const c of data.shapeTreatyNotes) list.push({ path: `shapeTreatyNotes:${c.id}`, item: c });
  for (const m of data.oakMoments) {
    if (m.note) list.push({ path: `oakMoments:${m.era}:${m.note.id}`, item: m.note });
  }
  list.push({ path: `oakSameTreeNote:${data.oakSameTreeNote.id}`, item: data.oakSameTreeNote });

  for (const ev of data.shechemEvents) {
    for (const c of ev.linkedBy ?? []) {
      list.push({ path: `shechemEvents:${ev.id}.linkedBy:${c.id}`, item: c });
    }
  }
  list.push({
    path: `shechemArchaeology.sourceNote:${data.shechemArchaeology.sourceNote.id}`,
    item: data.shechemArchaeology.sourceNote,
  });

  for (const c of data.sevenStonesNotes) list.push({ path: `sevenStonesNotes:${c.id}`, item: c });
  for (const os of data.otherStones) {
    list.push({ path: `otherStones:${os.id}.note:${os.note.id}`, item: os.note });
  }

  list.push({ path: `burialsIntro:${data.burialsIntro.id}`, item: data.burialsIntro });
  for (const b of data.threeBurials) {
    for (const c of b.notes) {
      list.push({ path: `threeBurials:${b.id}.notes:${c.id}`, item: c });
    }
  }
  for (const lf of data.lestForget) {
    for (const c of lf.notes) {
      list.push({ path: `lestForget:${lf.id}.notes:${c.id}`, item: c });
    }
  }

  return list;
}

/** GT 已知的合訂子書名清單（對應總監裁示三之硬規則） */
const KNOWN_GT_WORKS = [
  '約書亞記雷氏研讀本',
  '啟導本聖經約書亞記註釋',
  '聖經精讀本──約書亞記註解',
  '約書亞記綜合解讀',
  '約書亞記研經資料(蔡哲民等)',
  '華爾頓《約書亞記背景注釋》',
  '華爾頓《舊約聖經背景注釋》',
  '串珠聖經注釋',
  '丁道爾聖經注釋',
  '丁道爾《約書亞記聖經注釋》',
  '李道生《舊約聖經問題總解(上)》',
];

interface GtParagraph {
  startLine: number;
  endLine: number;
  joined: string;
  allowedWork: string | null;
}

/**
 * 解析 GT 拾穗原檔（以空行為界），套用總監裁示三之硬規則：
 * (a) 段落結尾有 ── / ―― / —— 加已知書名（支援換行折行）；
 * (b) ◎ 或 ● 條目一律屬於《約書亞記研經資料(蔡哲民等)》；
 * (c) 【思想問題(第24章)】（459-469行）緊接 471 行 ──《串珠聖經注釋》；
 * 其餘無標記散文段落（如 7, 13, 15, 73, 75, 258, 314 行）一律回傳 allowedWork = null。
 */
function parseGtParagraphs(gtRawText: string): GtParagraph[] {
  const rawLines = gtRawText.replace(/\r\n/g, '\n').split('\n');
  const blocks: { startLine: number; endLine: number; lines: string[] }[] = [];
  let curStart = 0;
  let curLines: string[] = [];

  for (let i = 0; i < rawLines.length; i++) {
    const ln = rawLines[i];
    if (ln.trim() === '') {
      if (curLines.length > 0) {
        blocks.push({ startLine: curStart, endLine: i, lines: curLines });
        curLines = [];
      }
    } else {
      if (curLines.length === 0) curStart = i + 1;
      curLines.push(ln.trim());
    }
  }
  if (curLines.length > 0) {
    blocks.push({ startLine: curStart, endLine: rawLines.length, lines: curLines });
  }

  return blocks.map((blk, idx) => {
    const joined = blk.lines.join('');
    let allowedWork: string | null = null;

    if (/^[◎●]/.test(joined)) {
      allowedWork = '約書亞記研經資料(蔡哲民等)';
    } else if (joined.startsWith('【思想問題(第24章)】')) {
      const next = blocks[idx + 1];
      if (next && next.lines.join('').includes('串珠聖經注釋')) {
        allowedWork = '串珠聖經注釋';
      }
    } else {
      for (const w of KNOWN_GT_WORKS) {
        const escaped = w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
        const endRe = new RegExp(`(?:──|――|——)\\s*《?${escaped}》?\\s*$`);
        if (endRe.test(joined)) {
          allowedWork = w;
          break;
        }
      }
    }

    return {
      startLine: blk.startLine,
      endLine: blk.endLine,
      joined,
      allowedWork,
    };
  });
}

function expandSimpleVerseKeys(refStr: string): string[] {
  const out: string[] = [];
  for (const part of refStr.split(/[；;]/).map((s) => s.trim()).filter(Boolean)) {
    const m = /^([^\d:：]+)(\d+):([\d,\-\s]+)$/.exec(part);
    if (!m) throw new Error(`無法解析經節參照：${refStr}`);
    const abbr = m[1].trim();
    const ch = Number(m[2]);
    for (const seg of m[3].split(',').map((s) => s.trim()).filter(Boolean)) {
      const rm = /^(\d+)-(\d+)$/.exec(seg);
      if (rm) {
        for (let v = Number(rm[1]); v <= Number(rm[2]); v++) out.push(`${abbr}${ch}:${v}`);
      } else {
        out.push(`${abbr}${ch}:${Number(seg)}`);
      }
    }
  }
  return out;
}

function haversineKm(lon1: number, lat1: number, lon2: number, lat2: number): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
}

function listFilesRecursive(dir: string, exts: string[]): string[] {
  if (!existsSync(dir)) return [];
  const results: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = resolve(dir, entry.name);
    if (entry.isDirectory()) {
      results.push(...listFilesRecursive(full, exts));
    } else if (exts.some((ext) => entry.name.endsWith(ext))) {
      results.push(full);
    }
  }
  return results;
}

describe('《至於我和我家》15 道自動化資料與內容閘門', () => {
  it('閘門 1：經節完整性（第一幕至第六幕聯集 === 書24:1..33，不多一節、不少一節）', () => {
    const actIds = new Set(['act-1', 'act-2', 'act-3', 'act-4', 'act-5', 'act-6']);
    const covered = new Set<string>();

    for (const seg of site.segments) {
      if (seg.id === 'prologue') {
        for (const b of seg.beats) expect(b.verse).toBeUndefined();
      } else if (actIds.has(seg.id)) {
        for (const b of seg.beats) {
          // 家庭穿插拍（family-1..4）無獨立書24章節號，其餘敘事拍皆對應書24章經節
          if (!b.verse) {
            expect(
              Boolean(b.familyLines && b.familyLines.length > 0),
              `拍 ${b.id} 若無 verse 欄位，必須為家庭穿插拍`,
            ).toBe(true);
            continue;
          }
          for (const k of expandSimpleVerseKeys(b.verse)) {
            expect(k.startsWith('書24:'), `拍 ${b.id} 不可越出書24章：${k}`).toBe(true);
            covered.add(k);
          }
        }
      } else if (seg.id === 'epilogue') {
        expect(seg.beats[0]?.compareRefs?.left).toBe('書24:28-31');
        expect(seg.beats[0]?.compareRefs?.right).toBe('士2:6-9');
        expect(seg.beats[0]?.compareRefs?.extraRight).toBe('士2:10');
      }
    }

    const expected = Array.from({ length: 33 }, (_, i) => `書24:${i + 1}`);
    expect(Array.from(covered).sort()).toEqual(expected.sort());
  });

  it('閘門 2：經文逐字比對、註釋 evidence+line、GT 掛名硬規則、引號分工', () => {
    // 2A. 經文逐字比對與和合本女性代名詞「他」
    for (const [k, text] of Object.entries(site.verses)) {
      expect(text.length, `經節 ${k} 不可為空`).toBeGreaterThan(0);
      expect(text).toBe(versesJson.verses[k]);
      expect(text.includes('她'), `經節 ${k} 不可改動和合本代名詞為「她」`).toBe(false);
    }

    if (hasVaultScripture) {
      // 抽檢書 24:1-33 與士 2:6-10 與創 34（底拿事件）與 raw_scripture 原檔逐字一致
      const jos24Raw = readFileSync(
        resolve(VAULT_ROOT, 'raw_scripture/約書亞記/第24章.txt'),
        'utf8',
      );
      for (let v = 1; v <= 33; v++) {
        expect(jos24Raw.includes(site.verses[`書24:${v}`]), `書24:${v} 必須逐字出自 raw_scripture`).toBe(
          true,
        );
      }
      const jdg2Raw = readFileSync(resolve(VAULT_ROOT, 'raw_scripture/士師記/第2章.txt'), 'utf8');
      for (let v = 6; v <= 10; v++) {
        expect(jdg2Raw.includes(site.verses[`士2:${v}`]), `士2:${v} 必須逐字出自 raw_scripture`).toBe(
          true,
        );
      }
    }

    // 驗證翻卡與巴勒三折引句逐字出自 site.verses
    for (const seg of site.segments) {
      for (const b of seg.beats) {
        for (const gc of b.giftCards ?? []) {
          expect(site.verses['書24:13'].includes(gc.jos24Quote)).toBe(true);
          expect(site.verses[gc.deut6Ref].includes(gc.deut6Quote)).toBe(true);
        }
        for (const bs of b.balakStages ?? []) {
          expect(site.verses[bs.ref].includes(bs.quote)).toBe(true);
        }
      }
    }
    for (const st of site.sevenStones) {
      if (st.markerQuote && st.markerRef) {
        const blockText = site.verseBlocks[st.markerRef].lines.map((l) => l.text).join('');
        expect(blockText.includes(st.markerQuote), `石頭 ${st.id} markerQuote 必須逐字出自經文`).toBe(true);
      }
    }

    // 驗證整理區 05 標題逐字出自 申6:12 原句片段
    expect(site.section05Title).toBe('免得你忘記');
    expect(
      site.verses['申6:12'].includes(site.section05Title),
      `整理區 05 標題「${site.section05Title}」必須逐字出自申6:12`,
    ).toBe(true);

    // 2B. 註釋 evidence + line 與引文格式檢查
    const allCommentaries = collectAllCommentaryItems(site);
    expect(allCommentaries.length).toBeGreaterThan(60);

    for (const { path, item } of allCommentaries) {
      expect(item.evidence.trim().length, `${path} evidence 至少 8 個字`).toBeGreaterThanOrEqual(8);
      expect(Number.isInteger(item.line) && item.line >= 1, `${path} line 必須為正整數`).toBe(true);
      expect(item.url).toBe(site.meta.sources[item.source].url);

      if (item.source === 'CT' || item.source === 'GT') {
        expect(item.quoteZh, `${path} 中文註釋不可填 quoteZh`).toBeUndefined();
      } else {
        // KC / BH 英文來源
        if (item.quote) {
          expect(/[A-Za-z]/.test(item.quote), `${path} 英文來源 quote 必須放英文原句`).toBe(true);
          expect(
            Boolean(item.quoteZh && item.quoteZh.trim().length > 0),
            `${path} 英文引句必須附繁體中文翻譯 quoteZh`,
          ).toBe(true);
          expect(
            /[「」]/.test(item.quoteZh!),
            `${path} 英文來源的中譯 quoteZh 不可放進「」`,
          ).toBe(false);
        }
      }
      if (item.paraphrase) {
        expect(
          /[「」]/.test(item.paraphrase),
          `${path} 具名轉述 paraphrase 不可使用逐字引號「」`,
        ).toBe(false);
      }
    }

    // 2C. 若在 vault 內，逐筆核對 raw_data 原檔 line±2 與 GT 掛名硬規則
    if (hasVaultRawData) {
      const rawBySource = {
        CT: readFileSync(resolve(VAULT_ROOT, 'raw_data/ccbiblestudy_CT_joshua_24.txt'), 'utf8')
          .replace(/\r\n/g, '\n')
          .split('\n'),
        GT: readFileSync(resolve(VAULT_ROOT, 'raw_data/ccbiblestudy_GT_joshua_24.txt'), 'utf8')
          .replace(/\r\n/g, '\n')
          .split('\n'),
        KC: readFileSync(resolve(VAULT_ROOT, 'raw_data/kingcomments_joshua_24.txt'), 'utf8')
          .replace(/\r\n/g, '\n')
          .split('\n'),
        BH: readFileSync(resolve(VAULT_ROOT, 'raw_data/biblehub_study_joshua_24.txt'), 'utf8')
          .replace(/\r\n/g, '\n')
          .split('\n'),
      };
      const rawJoinedBySource = {
        CT: rawBySource.CT.map((s) => s.trim()).join('\n'),
        GT: rawBySource.GT.map((s) => s.trim()).join('\n'),
        KC: rawBySource.KC.map((s) => s.trim()).join(' '),
        BH: rawBySource.BH.map((s) => s.trim()).join(' '),
      };

      const gtParagraphs = parseGtParagraphs(rawBySource.GT.join('\n'));

      // 先對 GT 分類器做自我驗證：無標記段落必須回傳 null
      for (const unmarkedLine of [7, 13, 15, 73, 75, 258, 314]) {
        const p = gtParagraphs.find(
          (blk) => unmarkedLine >= blk.startLine && unmarkedLine <= blk.endLine,
        );
        expect(
          p?.allowedWork ?? null,
          `GT 第 ${unmarkedLine} 行屬於無標記段落，分類器必須拒絕掛名`,
        ).toBeNull();
      }

      for (const { path, item } of allCommentaries) {
        const lines = rawBySource[item.source];
        const lo = Math.max(1, item.line - 2);
        const hi = Math.min(lines.length, item.line + 2);
        const sliceLines = lines.slice(lo - 1, hi);
        const windowNewline = sliceLines.join('\n');
        const windowCompact = sliceLines.map((s) => s.trim()).join('');
        const windowSpaced = sliceLines.map((s) => s.trim()).join(' ');

        const foundInWindow =
          windowNewline.includes(item.evidence) ||
          windowCompact.includes(item.evidence) ||
          windowSpaced.includes(item.evidence);

        expect(
          foundInWindow,
          `${path} 的 evidence「${item.evidence}」未出現在 ${item.source} 第 ${item.line}±2 行內`,
        ).toBe(true);

        if (item.quote) {
          const fullText = rawJoinedBySource[item.source];
          const fullCompact = lines.map((s) => s.trim()).join('');
          expect(
            fullText.includes(item.quote) || fullCompact.includes(item.quote),
            `${path} 的直接引句 quote「${item.quote}」必須逐字出自 ${item.source} 原檔`,
          ).toBe(true);
        }

        if (item.source === 'GT') {
          const matchedPara = gtParagraphs.find(
            (blk) => item.line >= blk.startLine && item.line <= blk.endLine,
          );
          expect(matchedPara, `${path} 在 GT 第 ${item.line} 行找不到非空段落`).toBeTruthy();
          expect(
            matchedPara!.allowedWork,
            `${path} 引用了 GT 無標記段落（第 ${matchedPara!.startLine}-${matchedPara!.endLine} 行），違反 GT 掛名硬規則`,
          ).toBeTruthy();

          // 驗證 item.work 與段落標記一致（丁道爾允許《丁道爾聖經注釋》或丁道爾《約書亞記聖經注釋》）
          const allowed = matchedPara!.allowedWork!;
          const workOk =
            item.work.includes(allowed) ||
            (allowed.includes('丁道爾') && item.work.includes('丁道爾'));
          expect(
            workOk,
            `${path} 掛名「${item.work}」與 GT 段落標記「${allowed}」不符`,
          ).toBe(true);
        }
      }

      // 驗證串珠 6 題逐字出自 GT 原檔
      for (const q of site.beadQuestions.items) {
        const lo = Math.max(1, q.line - 2);
        const hi = Math.min(rawBySource.GT.length, q.line + 2);
        const win = rawBySource.GT
          .slice(lo - 1, hi)
          .map((s) => s.trim())
          .join('');
        expect(win.includes(q.evidence), `思想問題 ${q.number} evidence 不在 line±2 內`).toBe(true);
        expect(win.includes(q.text), `思想問題 ${q.number} text 必須逐字出自 GT`).toBe(true);
      }
      const attrLine = site.beadQuestions.attributionLine;
      const attrWin = rawBySource.GT
        .slice(Math.max(0, attrLine - 3), Math.min(rawBySource.GT.length, attrLine + 2))
        .join('\n');
      expect(attrWin.includes(site.beadQuestions.attributionEvidence)).toBe(true);
    }

    // 2D. 掃描作者自寫文字，禁止把「」拿來標非逐字引用的重點詞
    const authorProseFields: { where: string; text: string }[] = [];
    for (const seg of site.segments) {
      if (seg.treatyNote) authorProseFields.push({ where: `${seg.id}.treatyNote`, text: seg.treatyNote });
      for (const b of seg.beats) {
        authorProseFields.push({ where: `${b.id}.summary`, text: b.summary });
        if (b.commentaryPreview)
          authorProseFields.push({ where: `${b.id}.commentaryPreview`, text: b.commentaryPreview });
        if (b.wordPreview) authorProseFields.push({ where: `${b.id}.wordPreview`, text: b.wordPreview });
        for (const w of b.words ?? []) {
          authorProseFields.push({ where: `${b.id}.words.${w.id}.note`, text: w.note });
        }
      }
    }
    for (const card of site.readingCards) {
      authorProseFields.push({ where: `card.${card.id}.question`, text: card.question });
    }
    for (const st of site.sevenStones) {
      authorProseFields.push({ where: `sevenStones.${st.id}.what`, text: st.what });
    }
    for (const ev of site.shechemEvents) {
      if (ev.summary) authorProseFields.push({ where: `shechemEvents.${ev.id}.summary`, text: ev.summary });
    }
    for (const b of site.threeBurials) {
      authorProseFields.push({ where: `threeBurials.${b.id}.detail`, text: b.detail });
    }

    const allVerseConcat = Object.values(versesJson.verses).join('\n');
    for (const { where, text } of authorProseFields) {
      const quoteMatches = text.match(/「([^」]+)」/g) ?? [];
      for (const qm of quoteMatches) {
        const inner = qm.slice(1, -1);
        expect(
          allVerseConcat.includes(inner),
          `${where} 中的「${inner}」不是和合本逐字原句；重點詞請改用『』`,
        ).toBe(true);
      }
    }
  });

  it('閘門 3：原文計數（第3-13節1cs動詞=20、全章natan=7、avad動詞=16、eved名詞=2、和合本事奉=16）', () => {
    expect(site.step.oneCsVerbCount).toBe(20);
    expect(site.step.oneCsVerbs).toHaveLength(20);
    for (const v of site.step.oneCsVerbs) {
      expect(v.verse).toBeGreaterThanOrEqual(3);
      expect(v.verse).toBeLessThanOrEqual(13);
      expect(/V[A-Za-z0-9]*1cs/.test(v.morph)).toBe(true);
    }

    expect(site.step.giveCount).toBe(7);
    expect(site.step.gives).toHaveLength(7);
    const activeGives = site.step.gives.filter((g) => !g.passive);
    const passiveGives = site.step.gives.filter((g) => g.passive);
    expect(activeGives).toHaveLength(6);
    expect(passiveGives).toHaveLength(1);
    expect(passiveGives[0].verse).toBe(33);

    expect(site.step.serveVerbCount).toBe(16);
    expect(site.step.servantNounCount).toBe(2);
    expect(site.step.serveKnots).toHaveLength(18);

    let totalCuvServe = 0;
    for (let v = 1; v <= 33; v++) {
      const cuvText = site.verses[`書24:${v}`];
      const count = cuvText.split('事奉').length - 1;
      totalCuvServe += count;
      expect(count, `書24:${v} 的「事奉」次數應與 step.serveByVerse 一致`).toBe(
        site.step.serveByVerse[String(v)] ?? 0,
      );
    }
    expect(totalCuvServe).toBe(16);
  });

  it('閘門 4：原文與中文對位（20 個 1cs 動詞、7 個給、18 個事奉／僕人繩結皆存在於和合本且不重疊）', () => {
    function findNthSpan(verseText: string, sub: string, occ = 1): [number, number] {
      let from = 0;
      let idx = -1;
      for (let i = 0; i < occ; i++) {
        idx = verseText.indexOf(sub, from);
        if (idx === -1) return [-1, -1];
        from = idx + sub.length;
      }
      return [idx, idx + sub.length];
    }

    // 20 個 1cs 動詞在同一節內不可重疊
    const spansByVerse = new Map<number, { start: number; end: number; label: string }[]>();
    for (const item of site.step.oneCsVerbs) {
      expect(item.cuvSpans.length).toBeGreaterThan(0);
      const vText = site.verses[`書24:${item.verse}`];
      const list = spansByVerse.get(item.verse) ?? [];
      for (const sp of item.cuvSpans) {
        const [start, end] = findNthSpan(vText, sp.text, sp.occurrence ?? 1);
        expect(start, `1cs #${item.index} (書24:${item.verse}) 找不到「${sp.text}」`).toBeGreaterThanOrEqual(
          0,
        );
        for (const prev of list) {
          const overlaps = Math.max(start, prev.start) < Math.min(end, prev.end);
          expect(
            overlaps,
            `書24:${item.verse} 的「${sp.text}」與「${prev.label}」字元區間重疊`,
          ).toBe(false);
        }
        list.push({ start, end, label: sp.text });
      }
      spansByVerse.set(item.verse, list);
    }

    // 7 個「給」在同一節內不可重疊
    const giveByVerse = new Map<number, { start: number; end: number; label: string }[]>();
    for (const g of site.step.gives) {
      expect(g.cuvSpans.length).toBeGreaterThan(0);
      const vText = site.verses[`書24:${g.verse}`];
      const list = giveByVerse.get(g.verse) ?? [];
      for (const sp of g.cuvSpans) {
        const [start, end] = findNthSpan(vText, sp.text, sp.occurrence ?? 1);
        expect(start, `give #${g.index} (書24:${g.verse}) 找不到「${sp.text}」`).toBeGreaterThanOrEqual(0);
        for (const prev of list) {
          const overlaps = Math.max(start, prev.start) < Math.min(end, prev.end);
          expect(overlaps, `書24:${g.verse} 賜予標記重疊`).toBe(false);
        }
        list.push({ start, end, label: sp.text });
      }
      giveByVerse.set(g.verse, list);
    }

    // 18 個事奉／僕人繩結
    const knotByVerse = new Map<number, { start: number; end: number }[]>();
    for (const k of site.step.serveKnots) {
      const vText = site.verses[`書24:${k.verse}`];
      const [start, end] = findNthSpan(vText, k.cuvWord, k.cuvOccurrence);
      expect(
        start,
        `繩結 #${k.index} (書24:${k.verse}) 找不到第 ${k.cuvOccurrence} 個「${k.cuvWord}」`,
      ).toBeGreaterThanOrEqual(0);
      const list = knotByVerse.get(k.verse) ?? [];
      for (const prev of list) {
        expect(Math.max(start, prev.start) < Math.min(end, prev.end)).toBe(false);
      }
      list.push({ start, end });
      knotByVerse.set(k.verse, list);
    }
  });

  it('閘門 5：平行經文差異（書24:28-31 vs 士2:6-10 語序對調、亭拿西拉／亭拿希烈、知道／見、諸事／大事、士2:10獨排）', () => {
    const diff = buildParallelDiff(site.verses);
    expect(diff.pairs).toHaveLength(4);
    expect(diff.pairs.map((p) => `${p.leftRef}->${p.rightRef}`)).toEqual([
      '書24:28->士2:6',
      '書24:29->士2:8',
      '書24:30->士2:9',
      '書24:31->士2:7',
    ]);
    // 29-30 與 31 相對於士 2:7 與 2:8-9 次序對調
    expect(diff.pairs[1].reordered).toBe(true);
    expect(diff.pairs[2].reordered).toBe(true);
    expect(diff.pairs[3].reordered).toBe(true);

    // 30 vs 9：亭拿西拉 vs 亭拿希烈
    const pair30 = diff.pairs[2];
    const p30LeftDiff = pair30.segments
      .filter((s) => s.kind !== 'same')
      .map((s) => s.leftText)
      .join('');
    const p30RightDiff = pair30.segments
      .filter((s) => s.kind !== 'same')
      .map((s) => s.rightText)
      .join('');
    expect(p30LeftDiff).toContain('西拉');
    expect(p30RightDiff).toContain('希烈');

    // 31 vs 7：知道 vs 見、諸事 vs 大事
    const pair31 = diff.pairs[3];
    const p31LeftDiff = pair31.segments
      .filter((s) => s.kind !== 'same')
      .map((s) => s.leftText)
      .join('|');
    const p31RightDiff = pair31.segments
      .filter((s) => s.kind !== 'same')
      .map((s) => s.rightText)
      .join('|');
    expect(p31LeftDiff).toContain('知道');
    expect(p31RightDiff).toContain('見');
    expect(p31LeftDiff).toContain('諸');
    expect(p31RightDiff).toContain('大');

    // 士2:10 右欄獨立無左欄對應，並偵測「知道」→「不知道」反轉呼應
    expect(diff.unmatchedRight).toHaveLength(1);
    expect(diff.unmatchedRight[0].ref).toBe('士2:10');
    expect(diff.unmatchedRight[0].text).toContain('不知道耶和華，也不知道耶和華為以色列人所行的事');
    expect(
      diff.unmatchedRight[0].negatedEchoes.some(
        (e) => e.word === '知道' && e.negatedWord === '不知道' && e.leftRef === '書24:31',
      ),
    ).toBe(true);
  });

  it('閘門 6：約書亞記七處石頭（7 筆皆在 verses.json，前 6 處與 CT、GT 註釋一致）', () => {
    expect(site.sevenStones).toHaveLength(7);
    for (const st of site.sevenStones) {
      expect(site.verseBlocks[st.ref], `缺少經文區塊 ${st.ref}`).toBeTruthy();
      if (st.markerRef) {
        expect(site.verseBlocks[st.markerRef], `缺少經文區塊 ${st.markerRef}`).toBeTruthy();
      }
    }
    expect(site.sevenStones.slice(0, 6).map((s) => s.ref)).toEqual([
      '書4:20',
      '書7:26',
      '書8:29',
      '書8:32',
      '書10:27',
      '書22:27',
    ]);
    expect(site.sevenStones[6].ref).toBe('書24:26-27');
  });

  it('閘門 7：示劍事件檢驗（和合本含「示劍」，白名單僅限申27/書8與約4:5且具名標出來源；士9:6僅列經文）', () => {
    const WHITELIST = new Set(['申27:11-13；書8:30-35', '約4:5']);

    for (const ev of site.shechemEvents) {
      const blk = site.verseBlocks[ev.ref];
      expect(blk, `示劍事件缺少經文區塊 ${ev.ref}`).toBeTruthy();
      const fullText = blk.lines.map((l) => l.text).join('');

      if (!WHITELIST.has(ev.ref)) {
        expect(
          fullText.includes('示劍'),
          `非白名單示劍事件 ${ev.ref} 和合本經文必須出現「示劍」`,
        ).toBe(true);
      } else if (ev.ref === '申27:11-13；書8:30-35') {
        expect(ev.linkedBy, '申27/書8 白名單必須具名標出連入來源').toBeTruthy();
        const sources = ev.linkedBy!.map((c) => c.source).sort();
        expect(sources).toEqual(['BH', 'CT', 'GT']);
        const gtItem = ev.linkedBy!.find((c) => c.source === 'GT')!;
        expect(gtItem.work).toContain('約書亞記研經資料');
        expect(gtItem.work).not.toContain('綜合解讀');
        expect(JSON.stringify(ev)).not.toContain('綜合解讀');
      } else if (ev.ref === '約4:5') {
        expect(ev.linkedBy, '約4:5 白名單必須具名標出連入來源').toBeTruthy();
        expect(ev.linkedBy![0].source).toBe('GT');
        expect(ev.linkedBy![0].work).toContain('李道生');
      }

      if (ev.ref === '士9:6') {
        expect(ev.verbatimOnly).toBe(true);
        expect(ev.summary).toBeUndefined();
      }
    }
  });

  it('閘門 8：家庭層台詞（僅爺爺、父親、女兒三人開口；每句以全形問號結尾或逐字出自經文）', () => {
    const allowedSpeakers = new Set(['grandfather', 'father', 'daughter']);
    const allowedAnswerers = new Set(['grandfather', 'father']);

    let familyCount = 0;
    for (const seg of site.segments) {
      for (const b of seg.beats) {
        for (const fl of b.familyLines ?? []) {
          familyCount++;
          expect(allowedSpeakers.has(fl.speaker), `${b.id} 出現不允許的說話角色 ${fl.speaker}`).toBe(
            true,
          );
          if (fl.kind === 'question') {
            expect(
              fl.text.trim().endsWith('？'),
              `${b.id} 家庭問句「${fl.text}」必須以全形問號結尾`,
            ).toBe(true);
          } else {
            expect(fl.ref, `${b.id} cuv-quote 必須附經節 ref`).toBeTruthy();
            const blkText = site.verseBlocks[fl.ref!].lines.map((l) => l.text).join('');
            expect(
              blkText.includes(fl.text),
              `${b.id} 家庭引讀「${fl.text}」必須逐字出自 ${fl.ref}`,
            ).toBe(true);
          }
        }
        if (b.daughterQA) {
          expect(allowedAnswerers.has(b.daughterQA.answerer)).toBe(true);
          expect(b.daughterQA.question.trim().endsWith('？')).toBe(true);
        }
      }
    }
    expect(familyCount).toBeGreaterThanOrEqual(10);
  });

  it('閘門 9：外連網址與跨站 ID（https:// 公開網址、無 obsidian://、條目與家譜 ID 皆存在）', () => {
    for (const entry of Object.values(site.entries)) {
      const u = entryUrl(entry.type, entry.title);
      expect(u.startsWith('https://')).toBe(true);
      expect(u.includes('obsidian://')).toBe(false);
    }
    for (const blk of Object.values(site.verseBlocks)) {
      if (blk.kb) {
        const u = chapterUrl(blk.book, blk.chapter);
        expect(u.startsWith('https://')).toBe(true);
      }
    }
    expect(wildernessUrl().startsWith('https://')).toBe(true);

    const personIds = new Set<string>();
    for (const seg of site.segments) {
      for (const b of seg.beats) {
        for (const p of b.personLinks ?? []) personIds.add(p.targetId);
        for (const ext of b.externalLinks ?? []) {
          if (ext.kind === 'genealogy' && ext.targetId) personIds.add(ext.targetId);
        }
      }
    }
    for (const b of site.threeBurials) personIds.add(b.genealogyId);

    for (const pid of personIds) {
      const u = genealogyUrl(pid);
      expect(u.startsWith('https://')).toBe(true);
    }
    expect(personIds.has('拿鶴#他拉')).toBe(true);

    // 掃描所有專案源碼，確認無 obsidian://
    for (const file of listFilesRecursive(resolve(PROJECT_DIR, 'src'), ['.ts', '.css', '.json'])) {
      if (file.endsWith('gates.test.ts')) continue;
      const content = readFileSync(file, 'utf8');
      expect(content.includes('obsidian://'), `${file} 不可含 obsidian://`).toBe(false);
    }

    if (hasVaultLinks) {
      for (const entry of Object.values(site.entries)) {
        const mdPath = resolve(VAULT_ROOT, 'link_folder', entry.type, `${entry.title}.md`);
        expect(existsSync(mdPath), `link_folder 缺少條目：${mdPath}`).toBe(true);
      }
      for (const blk of Object.values(site.verseBlocks)) {
        if (blk.kb) {
          const chPath = resolve(VAULT_ROOT, blk.book, `第${blk.chapter}章.md`);
          expect(existsSync(chPath), `知識庫缺少章節主檔：${chPath}`).toBe(true);
        }
      }
    }

    if (hasGenealogyJson) {
      const gen = JSON.parse(
        readFileSync(
          resolve(VAULT_ROOT, 'appendix/website/全聖經/亞當到耶穌/src/data/genealogy.json'),
          'utf8',
        ),
      );
      const genMap = new Map<string, { id: string; parents?: { id: string }[] }>();
      for (const p of gen.persons) genMap.set(p.id, p);

      for (const pid of personIds) {
        expect(genMap.has(pid), `家譜網站 genealogy.json 找不到人物 ID：${pid}`).toBe(true);
      }
      const nahor = genMap.get('拿鶴#他拉')!;
      expect(nahor.parents?.some((pr) => pr.id === '他拉')).toBe(true);
    }
  });

  it('閘門 10：地理座標與不確定圈（遷徙相鄰站點 < 950 km；亭拿西拉、迦實山、非尼哈小山皆標 uncertain）', () => {
    for (const p of Object.values(site.places)) {
      expect(p.lon).toBeGreaterThan(28);
      expect(p.lon).toBeLessThan(50);
      expect(p.lat).toBeGreaterThan(24);
      expect(p.lat).toBeLessThan(40);
    }

    const migrationStops = [
      'ur',
      'haran',
      'euphrates',
      'shechem',
      'bethel',
      'hebron',
      'egypt',
      'rameses',
      'redsea',
      'sinai',
      'kadesh',
      'seir',
      'heshbon',
      'bashan',
      'moab',
      'jericho',
      'shechem',
    ];
    for (let i = 1; i < migrationStops.length; i++) {
      const a = site.places[migrationStops[i - 1]];
      const b = site.places[migrationStops[i]];
      const dist = haversineKm(a.lon, a.lat, b.lon, b.lat);
      expect(
        dist,
        `遷徙路線 ${a.nameZh} → ${b.nameZh} 距離 ${dist.toFixed(1)} km 超過 950 km`,
      ).toBeLessThan(950);
    }

    for (const unlocatedId of ['jordan-witness', 'gaash', 'gibeah-phinehas', 'mizpah-gilead']) {
      const p = site.places[unlocatedId];
      expect(p.unlocated, `${unlocatedId} 必須標記 unlocated: true（位置不詳）`).toBe(true);
      expect(p.uncertain, `${unlocatedId} 必須標記 uncertain: true`).toBe(true);
      expect(p.modernLabel.includes('位置不詳'), `${unlocatedId} modernLabel 必須標明位置不詳`).toBe(true);
    }

    for (const disputedId of [
      'redsea',
      'sinai',
      'heshbon',
      'gilgal',
      'achor',
      'ai',
      'makkedah',
      'timnath-serah',
      'sychar',
    ]) {
      const p = site.places[disputedId];
      expect(p.uncertain, `${disputedId} 有爭議地點必須標記 uncertain: true`).toBe(true);
      expect(Boolean(p.controversy && p.controversy.length > 8), `${disputedId} 必須附其他說法補充說明`).toBe(true);
      expect(
        p.modernLabel.includes('只是可能在這一帶'),
        `${disputedId} 必須附註「只是可能在這一帶」`,
      ).toBe(true);
    }

    // 大河與埃及座標修正核對
    expect(site.places.euphrates.lon).toBeCloseTo(40.4177, 3);
    expect(site.places.euphrates.lat).toBeCloseTo(35.2116, 3);
    expect(site.places.egypt.lon).toBeCloseTo(31.8342, 3);
    expect(site.places.egypt.lat).toBeCloseTo(30.7994, 3);

    // 民數記 33 章曠野路線站序閘門：以旬迦別（第32站）必須排在加低斯（第33站）之前
    const wr = site.geo.wildernessRoute;
    const ezionIdx = wr.findIndex(([lon, lat]) => Math.abs(lon - 34.9612) < 0.05 && Math.abs(lat - 29.5469) < 0.05);
    const kadeshIdx = wr.findIndex(([lon, lat]) => Math.abs(lon - 34.4222) < 0.05 && Math.abs(lat - 30.6483) < 0.05);
    expect(ezionIdx, '曠野路線找不到以旬迦別').toBeGreaterThan(0);
    expect(kadeshIdx, '曠野路線找不到加低斯').toBeGreaterThan(0);
    expect(ezionIdx, '民33 站序：以旬迦別（第32站）必須排在加低斯（第33站）之前').toBeLessThan(kadeshIdx);

    expect((site.places['gibeah-phinehas'].candidates ?? []).length).toBeGreaterThanOrEqual(2);
  });

  it('閘門 11：公開文字衛生（讀者可見字串不含內部檔名、格式、工程術語或「壯丁」）', () => {
    const FORBIDDEN = [
      'verses.json',
      'step.json',
      'site.json',
      'geo.json',
      'genealogy.json',
      '.yaml',
      'yaml',
      '.glb',
      '.txt',
      '資料尚未',
      '測試資料',
      '合成資料',
      '找不到對位',
      '機器產物',
      '已核對',
      '本次補上',
      'dStrong',
      'TODO',
      'FIXME',
      '壯丁',
      '半透明範圍圈',
      '範圍圈',
      '淡圈',
      '恐怕你忘記',
      '怎麼用經文回答',
      '一千多公里',
      '十餘公里',
    ];

    const SKIP_KEYS = new Set([
      'id',
      'cue',
      'storyCue',
      'url',
      'evidence',
      'line',
      'attributionLine',
      'attributionEvidence',
      'openBibleFriendly',
      'openBibleSlug',
      'soundCue',
      'placeId',
      'genealogyId',
      'targetId',
      'entryKey',
      'entryLinks',
      'placeLinks',
      'strong',
      'baseStrong',
      'morph',
      'kind',
      'interaction',
      'space',
      'translit',
      'headwordTranslit',
    ]);

    function walkVisibleStrings(node: unknown, path: string): void {
      if (typeof node === 'string') {
        const lower = node.toLowerCase();
        for (const bad of FORBIDDEN) {
          expect(
            lower.includes(bad.toLowerCase()),
            `公開欄位 ${path} 出現禁用工程字樣「${bad}」：${node}`,
          ).toBe(false);
        }
        return;
      }
      if (Array.isArray(node)) {
        node.forEach((child, idx) => walkVisibleStrings(child, `${path}[${idx}]`));
        return;
      }
      if (node && typeof node === 'object') {
        for (const [k, v] of Object.entries(node)) {
          if (SKIP_KEYS.has(k)) continue;
          walkVisibleStrings(v, `${path}.${k}`);
        }
      }
    }

    walkVisibleStrings(site, 'site');

    // 掃描 UI 與 HTML 檔案
    const uiFiles = [
      resolve(PROJECT_DIR, 'index.html'),
      ...listFilesRecursive(resolve(PROJECT_DIR, 'src/ui'), ['.ts']),
    ];
    for (const file of uiFiles) {
      if (!existsSync(file)) continue;
      const content = readFileSync(file, 'utf8');
      for (const bad of [
        'verses.json',
        'step.json',
        'site.json',
        'genealogy.json',
        '資料尚未',
        '測試資料',
        '合成資料',
        '找不到對位',
        '機器產物',
        '已核對',
        '本次補上',
        'dStrong',
        'TODO',
        '壯丁',
        '半透明範圍圈',
        '範圍圈',
        '淡圈',
        '恐怕你忘記',
        '怎麼用經文回答',
        '一千多公里',
        '十餘公里',
        '：「${qa.question}」',
      ]) {
        expect(content.includes(bad), `UI 檔案 ${file} 出現禁用字樣「${bad}」`).toBe(false);
      }
    }
  });

  it('閘門 12：STEP 希伯來字串原樣檢查（所有希伯來字皆為 STEP 原檔子字串，禁止自行去分隔符或組片語）', () => {
    const stepCorpusFromJson = Object.values(stepJson.tokensByKey)
      .flatMap((t) => [t.hebrew, t.lexicon, t.headword])
      .join('\n');

    const stepRawText = hasVaultRawData
      ? readFileSync(resolve(VAULT_ROOT, 'raw_data/stepbible_joshua_24.txt'), 'utf8')
      : null;

    // 連同空白相連的多詞希伯來片語一併捕捉（例如自行組成的 כָּרַת בְּרִית 會整段被抓出並判定失敗）
    const hebrewSeqRe = /(?:[\u0590-\u05FF]+\/?)+(?:\s+(?:[\u0590-\u05FF]+\/?)+)*/g;

    const filesToScan = [
      resolve(PROJECT_DIR, 'src/data/site.json'),
      resolve(PROJECT_DIR, 'index.html'),
      ...listFilesRecursive(resolve(PROJECT_DIR, 'src'), ['.ts']).filter(
        (f) => !f.endsWith('gates.test.ts'),
      ),
    ];

    let totalChecked = 0;
    for (const file of filesToScan) {
      if (!existsSync(file)) continue;
      const content = readFileSync(file, 'utf8');
      const matches = content.match(hebrewSeqRe) ?? [];
      for (const rawMatch of matches) {
        const seq = rawMatch.replace(/\/+$/, '');
        if (!seq) continue;
        totalChecked++;
        expect(
          stepCorpusFromJson.includes(seq),
          `${file} 出現不在 STEP 資料中的希伯來字串：「${seq}」`,
        ).toBe(true);
        if (stepRawText !== null) {
          expect(
            stepRawText.includes(seq),
            `${file} 出現不在 stepbible_joshua_24.txt 原檔中的希伯來字串：「${seq}」`,
          ).toBe(true);
        }
      }
    }
    expect(totalChecked).toBeGreaterThan(50);
  });

  it('閘門 13：反 AI 腔與標記節制（無「不是…而是…」／「讓我們一起」／「總而言之」，每段最多一處 ==高亮==）', () => {
    const notButRe = /不是[^。！？；\n]{1,30}而是/;
    const bannedPhrases = [
      '讓我們一起',
      '總而言之',
      '綜上所述',
      '值得注意的是',
      '舊版漏掉',
      '本次維護補上',
      '應並陳',
    ];

    function checkAuthorText(text: string, where: string): void {
      expect(notButRe.test(text), `${where} 出現對仗轉折「不是…而是…」：${text}`).toBe(false);
      for (const bp of bannedPhrases) {
        expect(text.includes(bp), `${where} 出現禁用套話「${bp}」`).toBe(false);
      }
      for (const para of text.split(/\n+/)) {
        const highlights = para.match(/==[^=\n]+==/g) ?? [];
        expect(highlights.length, `${where} 單段超過一處 ==高亮==`).toBeLessThanOrEqual(1);
        const outsideQuotes = para.replace(/「[^」]*」/g, '');
        const emphasisMarks = outsideQuotes.match(/『[^』]+』/g) ?? [];
        expect(
          emphasisMarks.length,
          `${where} 單段獨立『』超過兩處（${emphasisMarks.join('、')}）：${para}`,
        ).toBeLessThanOrEqual(2);
      }
    }

    for (const seg of site.segments) {
      if (seg.treatyNote) checkAuthorText(seg.treatyNote, `${seg.id}.treatyNote`);
      for (const b of seg.beats) {
        checkAuthorText(b.summary, `${b.id}.summary`);
        if (b.commentaryPreview) checkAuthorText(b.commentaryPreview, `${b.id}.commentaryPreview`);
        if (b.wordPreview) checkAuthorText(b.wordPreview, `${b.id}.wordPreview`);
        for (const c of b.commentaries ?? []) {
          if (c.paraphrase) checkAuthorText(c.paraphrase, `${b.id}.${c.id}.paraphrase`);
          if (c.quoteZh) checkAuthorText(c.quoteZh, `${b.id}.${c.id}.quoteZh`);
        }
        for (const w of b.words ?? []) {
          checkAuthorText(w.note, `${b.id}.${w.id}.note`);
        }
      }
    }
    for (const [ek, em] of Object.entries(site.entries)) {
      checkAuthorText(em.summary, `entries.${ek}.summary`);
    }
    for (const [pid, pl] of Object.entries(site.places)) {
      checkAuthorText(pl.summary, `places.${pid}.summary`);
    }
    for (const card of site.readingCards) {
      checkAuthorText(card.question, `card.${card.id}.question`);
      for (const v of card.views) {
        if (v.paraphrase) checkAuthorText(v.paraphrase, `card.${card.id}.${v.id}.paraphrase`);
        if (v.quoteZh) checkAuthorText(v.quoteZh, `card.${card.id}.${v.id}.quoteZh`);
      }
    }
    for (const { path, item } of collectAllCommentaryItems(site)) {
      if (item.paraphrase) checkAuthorText(item.paraphrase, `${path}.paraphrase`);
      if (item.quoteZh) checkAuthorText(item.quoteZh, `${path}.quoteZh`);
    }
  });

  it('閘門 14：CSS 命名空間（.jos-* / --jos-*）與專案根目錄單一 HTML 入口', () => {
    const rootHtmls = readdirSync(PROJECT_DIR).filter((name) => name.endsWith('.html'));
    expect(rootHtmls).toEqual(['index.html']);

    const cssFiles = listFilesRecursive(resolve(PROJECT_DIR, 'src/styles'), ['.css']);
    for (const file of cssFiles) {
      const raw = readFileSync(file, 'utf8').replace(/\/\*[\s\S]*?\*\//g, '');

      // 檢查所有自訂變數宣告與 var(--...)
      const customProps = raw.match(/--[a-zA-Z0-9_-]+/g) ?? [];
      for (const prop of customProps) {
        expect(
          prop.startsWith('--jos-'),
          `${file} 出現未使用 --jos- 前綴的 CSS 變數：${prop}`,
        ).toBe(true);
      }

      // 剝除 { ... } 屬性值區塊，只檢查選擇器中的 class 名稱
      const selectorOnly = raw
        .replace(/@keyframes\s+[a-zA-Z0-9_-]+\s*\{[^{}]*(?:\{[^{}]*\}[^{}]*)*\}/g, '')
        .replace(/\{[^{}]*\}/g, ' ');
      const classMatches = selectorOnly.match(/\.[a-zA-Z_-][a-zA-Z0-9_-]*/g) ?? [];
      for (const cls of classMatches) {
        expect(
          cls.startsWith('.jos-'),
          `${file} 出現未使用 .jos- 前綴的 CSS 類別選擇器：${cls}`,
        ).toBe(true);
      }
    }
  });

  it('閘門 15：一拍只講一種東西（短註 8–10 拍、每句 ≤ 40 字且以出處名開頭、出處對得上該拍註釋；畫面不顯示 summary；更多鈕名稱固定）', () => {
    const SOURCE_RE = /^(CT|GT|KC|BH)[^：]*：/;
    const noted: string[] = [];
    for (const seg of site.segments) {
      for (const b of seg.beats) {
        if (b.note === undefined) continue;
        noted.push(b.id);
        expect([...b.note].length, `${b.id} 短註超過 40 字：${b.note}`).toBeLessThanOrEqual(40);
        const m = SOURCE_RE.exec(b.note);
        expect(m, `${b.id} 短註必須以出處名開頭（例如「GT《丁道爾》：」）：${b.note}`).not.toBeNull();
        const sourceCode = m![1];
        const pool = [...(b.commentaries ?? []), ...(b.daughterQA?.notes ?? []), ...(seg.id === 'act-2' ? site.onlyIBasis : [])];
        expect(
          pool.some((c) => c.source === sourceCode),
          `${b.id} 短註的出處 ${sourceCode} 不在這一拍的註釋裡`,
        ).toBe(true);
        expect(/[「」]/.test(b.note), `${b.id} 短註是轉述，不放「」：${b.note}`).toBe(false);
      }
    }
    expect(noted.length).toBeGreaterThanOrEqual(8);
    expect(noted.length).toBeLessThanOrEqual(10);

    // 對話泡泡：手機橫擺最多兩行，每句不能太長（含引號 ≤ 32 字）
    for (const seg of site.segments) {
      for (const b of seg.beats) {
        for (const fl of b.familyLines ?? []) {
          const shown = fl.kind === 'cuv-quote' ? `「${fl.text}」` : fl.text;
          expect([...shown].length, `${b.id} 泡泡句子太長：${shown}`).toBeLessThanOrEqual(32);
        }
      }
    }

    // 畫面程式不得顯示 summary（資料仍保留）
    for (const rel of ['src/ui/story-view.ts', 'src/ui/more-card.ts']) {
      const code = readFileSync(resolve(PROJECT_DIR, rel), 'utf8');
      const stripped = code.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      expect(/\bsummary\b/.test(stripped), `${rel} 不應使用 summary`).toBe(false);
    }

    // 「更多」鈕的名稱
    const viewCode = readFileSync(resolve(PROJECT_DIR, 'src/ui/story-view.ts'), 'utf8');
    expect(viewCode.includes("'更多'")).toBe(true);
  });
});
