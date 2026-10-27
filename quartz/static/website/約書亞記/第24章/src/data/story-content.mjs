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
 * 9字/100px；動作另計，入退場共360px。播放也使用同一份內容與動作預算。
 * 播放秒數以每秒6字計（使用者試聽後認為舊的每秒4字太慢，舊1.5倍速才剛好），最短4秒。
 */
export function contentRhythm(text, actionPx = 0, note = '') {
  const characters = readingCharacters(text), noteCharacters = readingCharacters(note);
  const readingPx = (characters + noteCharacters) * 100 / 9;
  return { characters, noteCharacters, readingPx, actionPx, transitionPx: 360,
    px: Math.ceil(Math.max(600, readingPx + actionPx + 360) / 20) * 20,
    seconds: Math.max(4, (characters + noteCharacters) / 6 + actionPx / 150 + 2.4) };
}
/** 終幕兩欄一次亮一組對照，每組約一屏的捲動與7秒播放。 */
export const COMPARE_ROW_PX = 520;
export const COMPARE_ROW_SECONDS = 7;
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
  const text = beat.familyLines?.map(line => line.text).join('') ?? storyLines(beat, data).map(line => line.text).join('');
  return contentRhythm(text, beatAction[beat.cue] ?? 0, beat.note);
}
export function stationRhythm(station, data) {
  const beat = data.segments.flatMap(s => s.beats).find(b => b.id === station.beat);
  return contentRhythm(storyLines(beat, data, station).map(line => line.text).join(''),
    stationAction[station.id] ?? 0, beat.note);
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
