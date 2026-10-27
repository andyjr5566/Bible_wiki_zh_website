// 彙整 data/*.yaml 與 src/data/{verses,step,geo}.json，產出 src/data/site.json。
// 支援 `--check` 模式：不依賴上層 vault（CI 無 vault 環境亦可執行），驗證磁碟上的 site.json 與即時計算結果完全一致。
import { existsSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import YAML from 'yaml';
import { validateStoryContent } from '../src/data/story-content.mjs';

const here = dirname(fileURLToPath(import.meta.url));
const PROJECT_DIR = resolve(here, '..');
const VAULT_ROOT = resolve(here, '../../../../..');

const SOURCES = {
  CT: {
    label: 'ccbiblestudy 黃迦勒《約書亞記註解》',
    url: 'https://www.ccbiblestudy.org/Old%20Testament/06Josh/06CT24.htm',
  },
  GT: {
    label: 'ccbiblestudy《約書亞記第二十四章拾穗》',
    url: 'https://www.ccbiblestudy.org/Old%20Testament/06Josh/06GT24.htm',
  },
  KC: {
    label: 'KingComments Joshua 24',
    url: 'https://www.kingcomments.com/en/bible-studies/Jos/24',
  },
  BH: {
    label: 'BibleHub Study Bible Joshua 24',
    url: 'https://biblehub.com/study/joshua/24.htm',
  },
};

const STEP_SOURCE = {
  label: 'STEP Bible（CC BY 4.0）',
  url: 'https://github.com/STEPBible/STEPBible-Data',
  license: 'CC BY 4.0',
};

/** 每個連往知識庫公開網站之條目的一句話簡介（不搬移條目全文） */
const ENTRY_SUMMARIES = {
  '事件/示劍更新盟約': '約書亞臨終前召集眾支派在示劍數算神恩、三度問答並立石寫書更新盟約的完整事件整理。',
  '主題/立石為證': '從雅各、約書亞到撒母耳，聖經裡立起石頭作為立約與紀念見證的跨卷脈絡。',
  '地點/示劍（城）': '位於以巴路山與基利心山谷口的迦南中部重鎮，貫穿列祖築壇、立約、分城與王國分裂。',
  '地點/基利心山與以巴路山': '夾峙示劍山谷的南北雙峰，以色列人進迦南後曾在此宣讀祝福與咒詛。',
  '地點/亭拿西拉': '各支派分地結束後分給約書亞的以法蓮山地城邑，也是約書亞安葬之地。',
  '地點/迦實山': '約書亞墓地南側的山嶺，經文記於亭拿西拉以南，確實位置今日已不可考。',
  '地點/基比亞（以法蓮）': '大祭司以利亞撒安葬之處，經文稱為他兒子非尼哈在以法蓮山地所得的小山。',
  '地點/以法蓮山地': '迦南中央山地的核心區域，示劍、示羅、亭拿西拉與非尼哈的小山皆在其間。',
  '地點/吉甲': '以色列人過約但河後安營並立起十二塊石頭紀念神大能的地方。',
  '地點/示羅': '分地時期設立會幕的中央聖所所在地，位於示劍以南的以法蓮山地。',
  '地點/耶利哥': '過約但河後攻取的第一座堅固城，代表河西爭戰得勝的起點。',
  '地點/亞割谷': '審判違背當滅之物禁令的亞干並堆石為記的山谷。',
  '地點/瑪基大': '南方戰役中封住五王洞口並堆放幾塊大石頭直存到今日的地方。',
  '地點/西珥山': '死海南方山地，神賜給以掃為業，使迦南地專留給雅各後裔。',
  '地點/約但河': '以色列人走乾地進入迦南的界河，河東支派亦在河邊築證壇表明同屬耶和華。',
  '背景/宗主條約': '古代近東宗主王與藩屬立約的文體結構，包含前言、歷史序言、條款與見證存放。',
  '背景/摩利橡樹': '亞伯拉罕初入迦南築壇、雅各埋藏外邦神像與約書亞立石所在的示劍聖樹背景。',
  '歷史/約瑟骸骨葬於示劍': '約瑟臨終起誓遺命、出埃及隨隊同行四十年，至分地安息後安葬示劍的跨卷應驗。',
  '神學/除掉外邦神': '從創世記35章到約書亞記24章，除去有形與內心偶像、專心歸向耶和華的呼召。',
  '解經爭議/你們不能事奉耶和華': '約書亞為何在百姓答應事奉後說『你們不能事奉耶和華』的四家解讀並陳。',
  '原文/事奉與作奴僕同一字根（a.vad）': '希伯來文的事奉、為奴與僕人共用同一個『事奉』字根，連結脫離埃及奴役與歸屬事奉真神。',
  '原文/黃蜂': '神打發飛在以色列人前面的『黃蜂』：字面昆蟲、象徵驚恐、寓意或雙關等各家讀法。',
  '人物/他拉': '亞伯拉罕與拿鶴的父親，原住大河那邊的吾珥，後遷居哈蘭。',
  '人物/亞伯拉罕': '神從大河那邊呼召出來、領他走遍迦南全地並應許賜地給後裔的列祖。',
  '人物/巴勒': '摩押王西撥的兒子，因懼怕以色列人而差人召巴蘭前來咒詛。',
  '人物/巴蘭（比珥的兒子）': '受巴勒重金延請卻被神攔阻、反倒四次開口祝福以色列人的異族術士。',
  '人物/約書亞': '嫩的兒子，接續摩西領百姓過河爭戰分地，臨終在示劍與民立約，被稱為耶和華的僕人。',
  '人物/約瑟': '雅各之子，臨終憑信心留下搬運骸骨回迦南的遺命，最終葬在示劍父親所買之地。',
  '人物/以利亞撒': '亞倫的兒子，與約書亞同時代的大祭司，葬在他兒子非尼哈所得的小山上。',
  '人物/非尼哈': '以利亞撒的兒子，繼承大祭司職任，在以法蓮山地得著小山安葬父親。',
};

function readYaml(relPath) {
  const full = resolve(PROJECT_DIR, relPath);
  return YAML.parse(readFileSync(full, 'utf8'));
}

function readJson(relPath) {
  const full = resolve(PROJECT_DIR, relPath);
  return JSON.parse(readFileSync(full, 'utf8'));
}

function verifyManifestUrlsIfInVault() {
  const manifestPath = resolve(VAULT_ROOT, '06 約書亞記/.tmp/第24章/source_manifest.md');
  if (!existsSync(manifestPath)) return;
  const manifest = readFileSync(manifestPath, 'utf8');
  for (const [key, info] of Object.entries(SOURCES)) {
    if (!manifest.includes(info.url)) {
      throw new Error(`SOURCES.${key}.url 不在 source_manifest.md 中：${info.url}`);
    }
  }
}

/**
 * 解析經文參照字串（支援單節 `書24:1`、範圍 `書24:16-18`、逗號跳節 `士9:4,46` / `書24:1,25-27,32`、
 * 以及分號跨章 `申27:11-13；書8:30-35`），回傳對應之單章或多段展開結果。
 */
export function expandRefKeys(refStr) {
  const parts = refStr.split(/[；;]/).map((s) => s.trim()).filter(Boolean);
  const keys = [];
  const subBlocks = [];

  for (const part of parts) {
    const m = /^([^\d:：]+)(\d+):([\d,\-\s]+)$/.exec(part);
    if (!m) {
      throw new Error(`無法解析經文參照格式：${refStr}（子段：${part}）`);
    }
    const abbr = m[1].trim();
    const chapter = Number(m[2]);
    const spec = m[3].trim();
    const verseNums = [];
    for (const seg of spec.split(',').map((s) => s.trim()).filter(Boolean)) {
      const rm = /^(\d+)-(\d+)$/.exec(seg);
      if (rm) {
        const a = Number(rm[1]);
        const b = Number(rm[2]);
        for (let v = a; v <= b; v++) verseNums.push(v);
      } else {
        verseNums.push(Number(seg));
      }
    }
    for (const v of verseNums) {
      keys.push(`${abbr}${chapter}:${v}`);
    }
    subBlocks.push({ part, abbr, chapter, verseNums });
  }
  return { keys, subBlocks };
}

function attachCommentaryUrl(item) {
  const src = SOURCES[item.source];
  if (!src) {
    throw new Error(`未知的註釋來源代碼：${item.source} (${item.id})`);
  }
  return {
    ...item,
    url: src.url,
  };
}

export function buildSiteData() {
  verifyManifestUrlsIfInVault();

  const storyYaml = readYaml('data/story.yaml');
  const cardsYaml = readYaml('data/cards.yaml');
  const placesYaml = readYaml('data/places.yaml');
  const echoesYaml = readYaml('data/echoes.yaml');

  const versesPayload = readJson('src/data/verses.json');
  const stepPayload = readJson('src/data/step.json');
  const geoData = readJson('src/data/geo.json');

  const allVerses = versesPayload.verses;
  const kbChapters = versesPayload.kbChapters;
  const tokensByKey = stepPayload.tokensByKey;

  const usedVerses = {};
  const verseBlocks = {};
  const entryKeySet = new Set();

  function registerRef(refStr) {
    if (!refStr) return;
    const { keys, subBlocks } = expandRefKeys(refStr);
    for (const k of keys) {
      if (!(k in allVerses)) {
        throw new Error(`經節 ${k}（來自參照 ${refStr}）不在 src/data/verses.json 中`);
      }
      usedVerses[k] = allVerses[k];
    }
    if (!verseBlocks[refStr]) {
      // 若為單一章節參照，直接建立 VerseBlock；若含分號跨章（如 申27:11-13；書8:30-35），合併顯示並在子段亦註冊
      const first = subBlocks[0];
      const chInfo = kbChapters[`${first.abbr}${first.chapter}`];
      if (!chInfo) {
        throw new Error(`章節資訊缺失：${first.abbr}${first.chapter}`);
      }
      if (subBlocks.length === 1) {
        verseBlocks[refStr] = {
          ref: refStr,
          book: chInfo.bookFolder,
          abbr: first.abbr,
          chapter: first.chapter,
          lines: first.verseNums.map((v) => ({ v, text: allVerses[`${first.abbr}${first.chapter}:${v}`] })),
          kb: Boolean(chInfo.kb),
        };
      } else {
        const mergedLines = [];
        let allKb = true;
        for (const sb of subBlocks) {
          const info = kbChapters[`${sb.abbr}${sb.chapter}`];
          if (!info) throw new Error(`章節資訊缺失：${sb.abbr}${sb.chapter}`);
          if (!info.kb) allKb = false;
          verseBlocks[sb.part] = {
            ref: sb.part,
            book: info.bookFolder,
            abbr: sb.abbr,
            chapter: sb.chapter,
            lines: sb.verseNums.map((v) => ({ v, text: allVerses[`${sb.abbr}${sb.chapter}:${v}`] })),
            kb: Boolean(info.kb),
          };
          for (const v of sb.verseNums) {
            mergedLines.push({
              v,
              text: `（${sb.abbr}${sb.chapter}:${v}）${allVerses[`${sb.abbr}${sb.chapter}:${v}`]}`,
            });
          }
        }
        verseBlocks[refStr] = {
          ref: refStr,
          book: chInfo.bookFolder,
          abbr: first.abbr,
          chapter: first.chapter,
          lines: mergedLines,
          kb: allKb,
        };
      }
    }
  }

  // 確保書 24:1-33 與士 2:6-10 單節全部收錄
  for (let v = 1; v <= 33; v++) registerRef(`書24:${v}`);
  for (let v = 6; v <= 10; v++) registerRef(`士2:${v}`);

  function registerEntry(key) {
    if (!key) return;
    entryKeySet.add(key);
  }

  // 1. 整理 segments & beats
  const segments = storyYaml.segments.map((seg) => ({
    ...seg,
    beats: seg.beats.map((beat) => {
      if (beat.verse) registerRef(beat.verse);
      for (const r of beat.bgVerses ?? []) registerRef(r);
      for (const r of beat.moreVerses ?? []) registerRef(r);
      if (beat.compareRefs) {
        registerRef(beat.compareRefs.left);
        registerRef(beat.compareRefs.right);
        registerRef(beat.compareRefs.extraRight);
      }
      for (const fl of beat.familyLines ?? []) {
        if (fl.ref) registerRef(fl.ref);
      }
      for (const bs of beat.balakStages ?? []) {
        registerRef(bs.ref);
      }
      for (const gc of beat.giftCards ?? []) {
        registerRef(gc.deut6Ref);
      }
      for (const ek of beat.entryLinks ?? []) {
        registerEntry(ek);
      }

      let daughterQA = undefined;
      if (beat.daughterQA) {
        for (const r of beat.daughterQA.verses ?? []) registerRef(r);
        for (const ek of beat.daughterQA.entryLinks ?? []) registerEntry(ek);
        daughterQA = {
          ...beat.daughterQA,
          notes: (beat.daughterQA.notes ?? []).map(attachCommentaryUrl),
        };
      }

      const words = beat.words
        ? beat.words.map((w) => {
            const stepTok = tokensByKey[`${w.verse}:${w.position}`];
            if (!stepTok) {
              throw new Error(`找不到 STEP 詞項：書24:${w.verse} #${w.position} (${w.id})`);
            }
            return {
              id: w.id,
              label: w.label,
              ref: `書24:${w.verse}`,
              verse: w.verse,
              position: w.position,
              hebrew: stepTok.hebrew,
              translit: stepTok.translit,
              gloss: stepTok.gloss,
              strong: stepTok.strong,
              morph: stepTok.morph,
              morphText: stepTok.morphText,
              lexicon: stepTok.lexicon,
              headword: stepTok.headword,
              headwordTranslit: stepTok.headwordTranslit,
              lexiconGloss: stepTok.lexiconGloss,
              note: w.note,
            };
          })
        : undefined;

      const outBeat = {
        ...beat,
        commentaries: beat.commentaries ? beat.commentaries.map(attachCommentaryUrl) : undefined,
        daughterQA,
        words,
      };
      for (const k of Object.keys(outBeat)) {
        if (outBeat[k] === undefined) delete outBeat[k];
      }
      return outBeat;
    }),
  }));

  // 2. 整理 cards.yaml
  const readingCards = cardsYaml.questions.map((q) => {
    for (const r of q.verses ?? []) registerRef(r);
    for (const ek of q.entryLinks ?? []) registerEntry(ek);
    return {
      ...q,
      views: q.views.map(attachCommentaryUrl),
    };
  });

  // 3. 整理 places（合併 geo.json 算出的經緯度與候選）
  const places = {};
  for (const p of placesYaml.places) {
    for (const r of p.verses ?? []) registerRef(r);
    if (p.entryKey) registerEntry(p.entryKey);
    const geoPlace = geoData.places[p.id];
    if (!geoPlace) {
      throw new Error(`geo.json 缺少地點：${p.id}`);
    }
    places[p.id] = geoPlace;
  }

  // 4. 整理 echoes.yaml
  const onlyIBasis = echoesYaml.onlyIBasis.map(attachCommentaryUrl);
  const shapeTreatyNotes = echoesYaml.shapeTreatyNotes.map(attachCommentaryUrl);
  const oakMoments = echoesYaml.oakMoments.map((m) => {
    registerRef(m.ref);
    return m.note ? { ...m, note: attachCommentaryUrl(m.note) } : m;
  });
  const oakSameTreeNote = attachCommentaryUrl(echoesYaml.oakSameTreeNote);

  const shechemEvents = echoesYaml.shechemEvents.map((ev) => {
    registerRef(ev.ref);
    return {
      ...ev,
      linkedBy: ev.linkedBy ? ev.linkedBy.map(attachCommentaryUrl) : undefined,
    };
  });

  const shechemArchaeology = {
    ...echoesYaml.shechemArchaeology,
    sourceNote: attachCommentaryUrl(echoesYaml.shechemArchaeology.sourceNote),
  };

  const sevenStones = echoesYaml.sevenStones.map((st) => {
    registerRef(st.ref);
    if (st.markerRef) registerRef(st.markerRef);
    return st;
  });
  const sevenStonesNotes = echoesYaml.sevenStonesNotes.map(attachCommentaryUrl);

  const otherStones = echoesYaml.otherStones.map((os) => {
    registerRef(os.ref);
    return {
      ...os,
      note: attachCommentaryUrl(os.note),
    };
  });

  const burialsIntro = attachCommentaryUrl(echoesYaml.burialsIntro);
  const threeBurials = echoesYaml.threeBurials.map((b) => {
    registerRef(b.ref);
    if (b.entryKey) registerEntry(b.entryKey);
    return {
      ...b,
      notes: b.notes.map(attachCommentaryUrl),
    };
  });

  const section05Title = echoesYaml.section05Title ?? '免得你忘記';
  const lestForget = echoesYaml.lestForget.map((lf) => {
    for (const r of lf.refs) registerRef(r);
    return {
      ...lf,
      notes: lf.notes.map(attachCommentaryUrl),
    };
  });

  const beadQuestions = {
    work: echoesYaml.beadQuestions.work,
    url: SOURCES.GT.url,
    attributionLine: echoesYaml.beadQuestions.attributionLine,
    attributionEvidence: echoesYaml.beadQuestions.attributionEvidence,
    items: echoesYaml.beadQuestions.items,
  };

  // 確保核心 10 條目全部納入 entries 索引
  for (const k of Object.keys(ENTRY_SUMMARIES)) {
    entryKeySet.add(k);
  }

  const vaultLinkFolder = resolve(VAULT_ROOT, 'link_folder');
  const hasVaultLinks = existsSync(vaultLinkFolder);
  const entries = {};

  for (const key of Array.from(entryKeySet).sort()) {
    const slashIdx = key.indexOf('/');
    if (slashIdx <= 0) {
      throw new Error(`條目 key 格式錯誤（應為 類型/條目名）：${key}`);
    }
    const type = key.slice(0, slashIdx);
    const title = key.slice(slashIdx + 1);
    if (hasVaultLinks) {
      const mdPath = resolve(vaultLinkFolder, type, `${title}.md`);
      if (!existsSync(mdPath)) {
        throw new Error(`link_folder 找不到條目檔案：${mdPath}`);
      }
    }
    const summary = ENTRY_SUMMARIES[key];
    if (!summary) {
      throw new Error(`ENTRY_SUMMARIES 尚未提供條目一句話簡介：${key}`);
    }
    entries[key] = { key, type, title, summary };
  }

  return {
    meta: {
      title: '至於我和我家',
      subtitle: '約書亞記 24 章・示劍立約',
      sources: SOURCES,
      stepSource: STEP_SOURCE,
    },
    verses: usedVerses,
    verseBlocks,
    entries,
    places,
    geo: geoData,
    step: stepPayload.stats,
    segments,
    onlyIBasis,
    shapeTreatyNotes,
    oakMoments,
    oakSameTreeNote,
    shechemEvents,
    shechemArchaeology,
    sevenStones,
    sevenStonesNotes,
    otherStones,
    burialsIntro,
    threeBurials,
    section05Title,
    lestForget,
    readingCards,
    beadQuestions,
  };
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const checkOnly = process.argv.includes('--check');
  const site = buildSiteData();
  const content = validateStoryContent(site, readJson('src/data/stations.json'));
  console.log(`故事句段閘門通過：經節=${content.verses}, 句段=${content.sentences}, 重複=${content.duplicates}`);
  const serialized = JSON.stringify(site, null, 2) + '\n';
  const outPath = resolve(PROJECT_DIR, 'src/data/site.json');

  if (checkOnly) {
    if (!existsSync(outPath)) {
      console.error('data:check 失敗：src/data/site.json 不存在，請先執行 npm run data');
      process.exit(1);
    }
    const current = readFileSync(outPath, 'utf8').replace(/\r\n/g, '\n');
    if (current !== serialized) {
      console.error('data:check 失敗：src/data/site.json 與 data/*.yaml 最新內容不一致，請執行 node scripts/build-site.mjs 更新');
      process.exit(1);
    }
    console.log(
      `data:check 通過：段落=${site.segments.length}, 拍數=${site.segments.reduce((n, s) => n + s.beats.length, 0)}, 各家題卡=${site.readingCards.length}, 條目=${Object.keys(site.entries).length}`,
    );
  } else {
    writeFileSync(outPath, serialized, 'utf8');
    console.log(
      `site.json 已寫入：段落=${site.segments.length}, 拍數=${site.segments.reduce((n, s) => n + s.beats.length, 0)}, 各家題卡=${site.readingCards.length}, 條目=${Object.keys(site.entries).length}, 經文區塊=${Object.keys(site.verseBlocks).length}`,
    );
  }
}
