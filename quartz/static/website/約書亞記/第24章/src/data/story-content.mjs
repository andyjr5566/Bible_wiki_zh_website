// 只分配版面上的句段；每個字都從正式 verseBlocks 取出，不複製或改寫經文。
export const beatSlices = {
  gather: { 1: [0, 1] },
  leaders: { 1: [1, 3] },
  'before-god': { 1: [3] },
  now: { 14: [0, 2] },
  'three-gods': { 14: [2], 15: [0, 3] },
  'my-house': { 15: [3] },
  write: { 26: [0, 1] },
  raise: { 26: [1] },
};
export const stationSlices = {
  ford: { 3: [0, 2] },
  isaac: { 3: [2] },
  redsea: { 7: [0, 5] },
  wilderness: { 7: [5] },
};
export function splitSentences(text) {
  return text.match(/[^，；。！？]+[，；。！？]*|[，；。！？]+/gu) ?? [text];
}
export function primaryRefOf(beat) {
  if (beat.verse) return beat.verse;
  if (!beat.familyLines && !beat.compareRefs) return beat.bgVerses?.[0];
  // 註釋的引註只供查閱，不另打一次已經讀過的經文。
}
export function storyLines(beat, data, station) {
  const block = data.verseBlocks[primaryRefOf(beat)];
  if (!block) return [];
  const slices = station ? stationSlices[station.id] : beatSlices[beat.cue];
  return block.lines.filter(line => !station || station.verses.includes(line.v)).flatMap(line => {
    const range = slices?.[line.v];
    const text = range ? splitSentences(line.text).slice(...range).join('') : line.text;
    return text ? [{ ...line, text }] : [];
  });
}
export const readingCharacters = text => [...text.replace(/\s/gu, '')].length;
const beatAction = { prologue: 400, gather: 120, leaders: 180, write: 400, raise: 600, cannot: 1200,
  'three-gods': 180, 'put-away': 400, 'joshua-dies': 180, bones: 180 };
const stationAction = { 'beyond-river': 180, ford: 400, isaac: 180, 'esau-jacob': 400,
  egypt: 400, redsea: 2600, wilderness: 180, east: 400, moab: 600, jordan: 700, canaan: 400 };
/**
 * 7字/100px；動作另計，入退場共360px。播放也使用同一份內容與動作預算。
 * 播放秒數以每秒4.7字計（2026-10-27 使用者回報有些字出現沒多久就換掉，由每秒6字放慢到5.2字；
 * 同日再要求整體再慢一點點，放慢到4.7字；
 * 標準檔再乘 1.5），最短4秒。
 */
export function contentRhythm(text, actionPx = 0, note = '', holdCharacters = 0) {
  const characters = readingCharacters(text), noteCharacters = readingCharacters(note);
  const readingPx = (characters + noteCharacters + holdCharacters) * 100 / 7;
  return { characters, noteCharacters, holdCharacters, readingPx, actionPx, transitionPx: 360,
    px: Math.ceil(Math.max(600, readingPx + actionPx + 360) / 20) * 20,
    seconds: Math.max(4, (characters + noteCharacters + holdCharacters) / 4.7 + actionPx / 150 + 2.4) };
}
/**
 * 畫面上一次最多顯示一組三句；每一句分到的時間依字數，另加 SENTENCE_PAD 字的浮現時間，
 * 每組最後一句再加 GROUP_HOLD 字的停留（2026-10-27 使用者回報組尾的句子常常出現一下就換掉）。
 * 停留也算進捲動長度與播放秒數，不是從別的句子挪時間。
 */
export const GROUP_SIZE = 3;
export const SENTENCE_PAD = 6;
export const GROUP_HOLD = 14;
export function sentencePlan(text) {
  const parts = splitSentences(text);
  const weights = parts.map((part, i) => Math.max(1, readingCharacters(part)) + SENTENCE_PAD
    + (i % GROUP_SIZE === GROUP_SIZE - 1 || i === parts.length - 1 ? GROUP_HOLD : 0));
  return { parts, weights };
}
/** 一節經文在畫面上要占的份量：字數加上每組的停留 */
export function verseWeight(text) {
  return Math.max(1, readingCharacters(text)) + Math.ceil(splitSentences(text).length / GROUP_SIZE) * GROUP_HOLD;
}
const holdOf = lines => lines.reduce((sum, line) => sum + Math.ceil(splitSentences(line.text).length / GROUP_SIZE) * GROUP_HOLD, 0);
/** 終幕兩欄一次亮一組對照，每組約半屏多的捲動與6.6秒播放（2026-10-27 使用者覺得太久，由 570px／7.7 秒加快）。 */
export const COMPARE_ROW_PX = 500;
export const COMPARE_ROW_SECONDS = 6.6;
export function compareRowCount(beat, data) {
  const left = data.verseBlocks[beat.compareRefs.left]?.lines.length ?? 0;
  return left + (beat.compareRefs.extraRight ? 1 : 0);
}
export function beatRhythm(beat, data) {
  if (beat.compareRefs) {
    const rows = compareRowCount(beat, data);
    const rhythm = contentRhythm('', rows * COMPARE_ROW_PX, beat.note);
    return { ...rhythm, seconds: rows * COMPARE_ROW_SECONDS + 2 };
  }
  if (beat.familyLines) return contentRhythm(beat.familyLines.map(line => line.text).join(''), beatAction[beat.cue] ?? 0, beat.note);
  const lines = storyLines(beat, data);
  return contentRhythm(lines.map(line => line.text).join(''), beatAction[beat.cue] ?? 0, beat.note, holdOf(lines));
}
export function stationRhythm(station, data) {
  const beat = data.segments.flatMap(s => s.beats).find(b => b.id === station.beat);
  const lines = storyLines(beat, data, station);
  return contentRhythm(lines.map(line => line.text).join(''), stationAction[station.id] ?? 0, beat.note, holdOf(lines));
}
/** 同經節逐句唯一、完整且順序不變；終幕兩欄及家人對話不屬於逐字經文軌。 */
export function validateStoryContent(data, stations) {
  const seen = new Set(), joined = new Map(), originals = new Map();
  let units = 0, sentences = 0;
  for (const beat of data.segments.flatMap(s => s.beats)) {
    const block = data.verseBlocks[primaryRefOf(beat)];
    if (!block) continue;
    for (const line of block.lines) originals.set(`${block.abbr}${block.chapter}:${line.v}`, line.text);
    const list = stations.filter(s => s.beat === beat.id);
    for (const station of list.length ? list : [undefined]) {
      units++;
      for (const line of storyLines(beat, data, station)) {
        const ref = `${block.abbr}${block.chapter}:${line.v}`;
        for (const sentence of splitSentences(line.text)) {
          const key = `${ref}\0${sentence}`;
          if (seen.has(key)) throw new Error(`重複打出：${ref}／${station?.id ?? beat.cue}／${sentence}`);
          seen.add(key); sentences++;
        }
        joined.set(ref, (joined.get(ref) ?? '') + line.text);
      }
    }
  }
  for (const [ref, text] of originals) if (joined.get(ref) !== text)
    throw new Error(`句段缺漏或次序改變：${ref}`);
  return { units, verses: originals.size, sentences, duplicates: 0 };
}
