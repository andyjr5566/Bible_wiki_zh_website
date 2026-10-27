// 從 raw_data/stepbible_joshua_24.txt 確定性解析約書亞記 24 章全部希伯來詞項，
// 並計算第 3–13 節 1cs 動詞（20）、全章 H5414（7）、H5647（16）、H5650（2），寫入 src/data/step.json。
import { readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const ROOT = resolve(here, '../../../../..');
const STEP_PATH = resolve(ROOT, 'raw_data/stepbible_joshua_24.txt');

/**
 * 20 個第一人稱單數（1cs）動詞對應之和合本字串與記憶地圖位置 ID。
 * 閘門 4 會機械驗證每一個 cuvSpans 字串確實按指定次序出現在該節和合本且不重疊。
 */
const ONE_CS_META = {
  '3:1': { placeId: 'euphrates', cuvSpans: [{ text: '我將' }, { text: '帶來' }] },
  '3:8': { placeId: 'canaan-walk', cuvSpans: [{ text: '領' }] },
  '3:13': { placeId: 'hebron', cuvSpans: [{ text: '使' }, { text: '眾多' }] },
  '3:16': { placeId: 'hebron', cuvSpans: [{ text: '賜給' }] },
  '4:1': { placeId: 'bethel', cuvSpans: [{ text: '賜給', occurrence: 1 }] },
  '4:7': { placeId: 'seir', cuvSpans: [{ text: '賜給', occurrence: 2 }] },
  '5:1': { placeId: 'egypt', cuvSpans: [{ text: '我差遣' }] },
  '5:6': { placeId: 'egypt', cuvSpans: [{ text: '降災' }] },
  '5:10': { placeId: 'egypt', cuvSpans: [{ text: '我', occurrence: 2 }, { text: '所行的' }] },
  '5:13': { placeId: 'rameses', cuvSpans: [{ text: '領出來' }] },
  '6:1': { placeId: 'redsea', cuvSpans: [{ text: '我領' }, { text: '出' }] },
  '7:18': { placeId: 'redsea', cuvSpans: [{ text: '我' }, { text: '所行的' }] },
  '8:1': { placeId: 'heshbon', cuvSpans: [{ text: '我領' }] },
  '8:11': { placeId: 'heshbon', cuvSpans: [{ text: '我將' }, { text: '交在' }] },
  '8:17': { placeId: 'bashan', cuvSpans: [{ text: '我', occurrence: 3 }, { text: '滅絕' }] },
  '10:2': { placeId: 'moab', cuvSpans: [{ text: '我不肯' }] },
  '10:8': { placeId: 'moab', cuvSpans: [{ text: '我便救' }] },
  '11:18': { placeId: 'jericho', cuvSpans: [{ text: '我把' }, { text: '交在' }] },
  '12:1': { placeId: 'jericho', cuvSpans: [{ text: '我打發' }] },
  '13:1': {
    placeId: 'shechem',
    cuvSpans: [
      { text: '我賜給', occurrence: 1 },
      { text: '我賜給', occurrence: 2 },
    ],
  },
};

const GIVE_META = {
  '3:16': { cuvSpans: [{ text: '賜給' }], passive: false },
  '4:1': { cuvSpans: [{ text: '賜給', occurrence: 1 }], passive: false },
  '4:7': { cuvSpans: [{ text: '賜給', occurrence: 2 }], passive: false },
  '8:11': { cuvSpans: [{ text: '交在' }], passive: false },
  '11:18': { cuvSpans: [{ text: '交在' }], passive: false },
  '13:1': {
    cuvSpans: [
      { text: '賜給', occurrence: 1 },
      { text: '賜給', occurrence: 2 },
    ],
    passive: false,
  },
  '33:11': { cuvSpans: [{ text: '所得' }], passive: true },
};

const SERVE_KNOT_META = {
  '2:21': { kind: 'other-gods', cuvWord: '事奉', cuvOccurrence: 1 },
  '14:5': { kind: 'yhwh', cuvWord: '事奉', cuvOccurrence: 1 },
  '14:13': { kind: 'other-gods', cuvWord: '事奉', cuvOccurrence: 2 },
  '14:18': { kind: 'yhwh', cuvWord: '事奉', cuvOccurrence: 3 },
  '15:4': { kind: 'yhwh', cuvWord: '事奉', cuvOccurrence: 1 },
  '15:12': { kind: 'yhwh', cuvWord: '事奉', cuvOccurrence: 2 },
  '15:17': { kind: 'other-gods', cuvWord: '事奉', cuvOccurrence: 3 },
  '15:32': { kind: 'yhwh', cuvWord: '事奉', cuvOccurrence: 4 },
  '16:9': { kind: 'other-gods', cuvWord: '事奉', cuvOccurrence: 1 },
  '17:12': { kind: 'bondage', cuvWord: '為奴', cuvOccurrence: 1 },
  '18:13': { kind: 'yhwh', affirmationOrder: 1, cuvWord: '事奉', cuvOccurrence: 1 },
  '19:7': { kind: 'yhwh', cuvWord: '事奉', cuvOccurrence: 1 },
  '20:5': { kind: 'other-gods', cuvWord: '事奉', cuvOccurrence: 1 },
  '21:9': { kind: 'yhwh', affirmationOrder: 2, cuvWord: '事奉', cuvOccurrence: 1 },
  '22:14': { kind: 'yhwh', cuvWord: '事奉', cuvOccurrence: 1 },
  '24:8': { kind: 'yhwh', affirmationOrder: 3, cuvWord: '事奉', cuvOccurrence: 1 },
  '29:9': { kind: 'servant', cuvWord: '僕人', cuvOccurrence: 1 },
  '31:1': { kind: 'yhwh', cuvWord: '事奉', cuvOccurrence: 1 },
};

function parseLexicon(lex) {
  const m = /^([^\s(]+)\s*\(([^)]+)\):\s*(.+)$/.exec(lex.trim());
  if (!m) {
    return { headword: '', headwordTranslit: '', lexiconGloss: lex.trim() };
  }
  return {
    headword: m[1],
    headwordTranslit: m[2],
    lexiconGloss: m[3],
  };
}

export function buildStep() {
  const raw = readFileSync(STEP_PATH, 'utf8').replace(/^\uFEFF/, '');
  const lines = raw.split(/\r?\n/);

  const tokensByKey = {};
  const allTokens = [];
  let currentVerse = 0;

  for (const line of lines) {
    const vMatch = /^## Joshua 24:(\d+)\s*$/.exec(line);
    if (vMatch) {
      currentVerse = Number(vMatch[1]);
      continue;
    }
    if (!currentVerse || !line.startsWith('|')) continue;
    const cols = line.split('|').slice(1, -1).map((c) => c.trim());
    if (cols.length < 7) continue;
    if (cols[0] === '#' || cols[0].startsWith('---')) continue;

    const position = Number(cols[0]);
    if (!Number.isInteger(position)) continue;

    const [hebrew, translit, gloss, strong, morphFull, lexicon] = cols.slice(1);
    const dashIdx = morphFull.indexOf(' — ');
    const morph = dashIdx >= 0 ? morphFull.slice(0, dashIdx).trim() : morphFull.trim();
    const morphText = dashIdx >= 0 ? morphFull.slice(dashIdx + 3).trim() : '';
    const baseStrong = (/^(H\d+)/.exec(strong)?.[1]) ?? strong;
    const { headword, headwordTranslit, lexiconGloss } = parseLexicon(lexicon);

    const tok = {
      verse: currentVerse,
      position,
      hebrew,
      translit,
      gloss,
      strong,
      baseStrong,
      morph,
      morphText,
      lexicon,
      headword,
      headwordTranslit,
      lexiconGloss,
    };
    const key = `${currentVerse}:${position}`;
    tokensByKey[key] = tok;
    allTokens.push(tok);
  }

  // 1. 第 3–13 節 1cs 動詞
  const oneCsByVerse = {};
  for (let v = 3; v <= 13; v++) oneCsByVerse[String(v)] = 0;

  const oneCsVerbs = [];
  for (const tok of allTokens) {
    if (tok.verse >= 3 && tok.verse <= 13 && /V[A-Za-z0-9]*1cs/.test(tok.morph)) {
      oneCsByVerse[String(tok.verse)]++;
      const key = `${tok.verse}:${tok.position}`;
      const meta = ONE_CS_META[key];
      if (!meta) {
        throw new Error(`STEP 發現未登記之 1cs 動詞：24:${key} (${tok.hebrew})`);
      }
      oneCsVerbs.push({
        index: oneCsVerbs.length + 1,
        verse: tok.verse,
        position: tok.position,
        hebrew: tok.hebrew,
        translit: tok.translit,
        strong: tok.strong,
        morph: tok.morph,
        gloss: tok.gloss,
        cuvSpans: meta.cuvSpans,
        placeId: meta.placeId,
      });
    }
  }

  // 2. 全章 H5414（給／賜給／交在／所得）
  const gives = [];
  for (const tok of allTokens) {
    if (tok.baseStrong === 'H5414') {
      const key = `${tok.verse}:${tok.position}`;
      const meta = GIVE_META[key];
      if (!meta) {
        throw new Error(`STEP 發現未登記之 H5414：24:${key} (${tok.hebrew})`);
      }
      gives.push({
        index: gives.length + 1,
        verse: tok.verse,
        position: tok.position,
        hebrew: tok.hebrew,
        translit: tok.translit,
        strong: tok.strong,
        morph: tok.morph,
        gloss: tok.gloss,
        cuvSpans: meta.cuvSpans,
        passive: meta.passive,
      });
    }
  }

  // 3. 全章 H5647（事奉 16 次）與 H5650（為奴／僕人 2 次）
  const serveByVerse = {};
  for (let v = 1; v <= 33; v++) serveByVerse[String(v)] = 0;

  let serveVerbCount = 0;
  let servantNounCount = 0;
  const serveKnots = [];

  for (const tok of allTokens) {
    if (tok.baseStrong === 'H5647' || tok.baseStrong === 'H5650') {
      if (tok.baseStrong === 'H5647') {
        serveVerbCount++;
        serveByVerse[String(tok.verse)]++;
      } else {
        servantNounCount++;
      }
      const key = `${tok.verse}:${tok.position}`;
      const meta = SERVE_KNOT_META[key];
      if (!meta) {
        throw new Error(`STEP 發現未登記之 H5647/H5650：24:${key} (${tok.hebrew})`);
      }
      const knot = {
        index: serveKnots.length + 1,
        verse: tok.verse,
        position: tok.position,
        hebrew: tok.hebrew,
        translit: tok.translit,
        strong: tok.strong,
        baseStrong: tok.baseStrong,
        gloss: tok.gloss,
        kind: meta.kind,
        cuvWord: meta.cuvWord,
        cuvOccurrence: meta.cuvOccurrence,
      };
      if (meta.affirmationOrder) {
        knot.affirmationOrder = meta.affirmationOrder;
      }
      serveKnots.push(knot);
    }
  }

  return {
    stats: {
      oneCsVerbCount: oneCsVerbs.length,
      oneCsByVerse,
      giveCount: gives.length,
      serveVerbCount,
      servantNounCount,
      serveByVerse,
      oneCsVerbs,
      gives,
      serveKnots,
    },
    tokensByKey,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const out = buildStep();
  const outPath = resolve(here, '../src/data/step.json');
  writeFileSync(outPath, JSON.stringify(out, null, 2) + '\n', 'utf8');
  console.log(
    `step.json: tokens=${Object.keys(out.tokensByKey).length}, 1cs=${out.stats.oneCsVerbCount}, H5414=${out.stats.giveCount}, H5647=${out.stats.serveVerbCount}, H5650=${out.stats.servantNounCount}`,
  );
}
