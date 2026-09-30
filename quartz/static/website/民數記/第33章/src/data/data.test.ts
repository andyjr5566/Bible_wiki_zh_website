import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

import { BBOX, H, POSITIONS, W, ZONE_MIN_GAP, resolvePositions } from '../geo';
import CANDIDATES from './candidates.json';
import { COMPARE_A, COMPARE_B } from './compare';
import type { CmpItem } from './compare';
import { DATES, monthsSince } from './dates';
import { DEBATES } from './debates';
import { EVENTS } from './events';
import { allFacts, allVoices } from './registry';
import { LEVEL_LABEL, OB_DATA, PICK, SITES, ZONE_MIN_R_KM, candLabel, entryUrl, kmBetween, levelOf, zoneOf } from './sites';
import { LANDMARKS, SEGMENTS, STATIONS, departedFrom, station } from './stations';
import type { Ref } from './types';
import { GT_PATTERNS } from './voices';

/** vault 根目錄：appendix/website/民數記/第33章/src/data → 上六層 */
const ROOT = resolve(__dirname, '../../../../../..');

/**
 * 這幾項要對照 vault 裡的 raw_scripture、章節主檔、地點條目與 raw_data，只有在 vault 內才跑得動。
 * repo（CI）只帶著已產生的 verses.json、places.json、candidates.json，沒有這些來源檔，所以在那裡略過。
 */
const IN_VAULT = existsSync(resolve(ROOT, 'raw_scripture', '民數記'));

const BOOKS: Record<string, string> = { 創: '創世記', 出: '出埃及記', 民: '民數記', 申: '申命記', 書: '約書亞記' };

const cache = new Map<string, string[]>();
function verses(book: string, ch: number): string[] {
  const key = `${book}${ch}`;
  if (!cache.has(key)) {
    const text = readFileSync(resolve(ROOT, 'raw_scripture', BOOKS[book], `第${ch}章.txt`), 'utf8');
    cache.set(key, text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.length > 0));
  }
  return cache.get(key)!;
}

function refText(ref: Ref): string {
  const m = /^(創|出|民|申|書)(\d+):(\d+)(?:-(\d+))?$/.exec(ref);
  if (!m) throw new Error(`無法解析的出處：${ref}`);
  const vs = verses(m[1], +m[2]);
  const a = +m[3];
  const b = m[4] ? +m[4] : a;
  if (a < 1 || b > vs.length || b < a) throw new Error(`${ref} 超出${BOOKS[m[1]]}第${m[2]}章的 ${vs.length} 節`);
  return vs.slice(a - 1, b).join('');
}

/** 去掉 Obsidian 標記（==高亮==、**粗體**、[[連結|顯示]]），留下讀者看到的字 */
const fileCache = new Map<string, string>();
function fileText(rel: string): string {
  if (!fileCache.has(rel)) {
    const raw = readFileSync(resolve(ROOT, rel), 'utf8');
    fileCache.set(rel, rel.endsWith('.md')
      ? raw.replace(/\[\[([^\]|]+)\|([^\]]+)\]\]/g, '$2').replace(/\[\[([^\]]+)\]\]/g, '$1').replace(/==/g, '').replace(/\*\*/g, '')
      : raw);
  }
  return fileCache.get(rel)!;
}

describe('站表', () => {
  it('四十二站，站號 1–42，站名不重複', () => {
    expect(STATIONS).toHaveLength(42);
    expect(STATIONS.map((s) => s.n)).toEqual(Array.from({ length: 42 }, (_, i) => i + 1));
    expect(new Set(STATIONS.map((s) => s.name)).size).toBe(42);
    expect(new Set(STATIONS.map((s) => s.key)).size).toBe(42);
  });
  it('經節依序：第 1 站在民33:3，第 2–34 站是 n+3 節，第 35–42 站是 n+6 節', () => {
    for (const s of STATIONS) {
      const expected = s.n === 1 ? 3 : s.n <= 34 ? s.n + 3 : s.n + 6;
      expect(s.verse, `${s.n} ${s.name}`).toBe(expected);
    }
  });
  it('分段：CT 12＋21＋9，GT 六程每程七站，兩種分法都蓋住 1–42', () => {
    expect(SEGMENTS.ct.map((s) => s.to - s.from + 1)).toEqual([12, 21, 9]);
    expect(SEGMENTS.gt.map((s) => s.to - s.from + 1)).toEqual([7, 7, 7, 7, 7, 7]);
    for (const seg of [SEGMENTS.ct, SEGMENTS.gt]) {
      const covered = seg.flatMap((s) => Array.from({ length: s.to - s.from + 1 }, (_, i) => s.from + i));
      expect(covered).toEqual(Array.from({ length: 42 }, (_, i) => i + 1));
    }
  });
  it('GT 串珠的數字對應，用站號算得出來', () => {
    const nth = (n: number) => ((n - 1) % 7) + 1; // 這一程的第幾站
    const stage = (n: number) => Math.ceil(n / 7);
    const by = Object.fromEntries(GT_PATTERNS.map((p) => [p.id, p.stations]));
    expect(by.water.map(nth)).toEqual([5, 5]);
    expect(by.water.map(stage)).toEqual([1, 5]);
    expect(by.deaths.map(nth)).toEqual([6, 6, 6]);
    expect(by.deaths.map(stage)).toEqual([4, 5, 6]);
    for (const id of ['wonders', 'battles', 'supply']) {
      expect(stage(by[id][1]) - stage(by[id][0])).toBe(1);
      expect(nth(by[id][1])).toBe(nth(by[id][0]));
    }
    expect(by.firsts).toEqual([1, 7, 12]);
    expect(station(12).name).toBe('西乃的曠野');
    expect(station(33).name).toBe('加低斯');
    expect(station(27).name).toBe('摩西錄');
    expect(station(34).name).toBe('何珥山');
  });
  it('事件與日期的站號在 1–42，日期依站序與時間遞增', () => {
    for (const e of EVENTS) {
      expect(e.st).toBeGreaterThanOrEqual(1);
      expect(e.st).toBeLessThanOrEqual(42);
    }
    for (let i = 1; i < DATES.length; i++) {
      expect(DATES[i].months).toBeGreaterThanOrEqual(DATES[i - 1].months);
      expect(DATES[i].st).toBeGreaterThanOrEqual(DATES[i - 1].st);
    }
  });
  it('日期換算：出埃及那天是 0；第二年二月二十日約 13.2 個月；第四十年五月初一約 471.5 個月', () => {
    expect(monthsSince(1, 1, 15)).toBe(0);
    expect(monthsSince(1, 2, 15)).toBe(1);
    expect(monthsSince(2, 2, 20)).toBeCloseTo(13.17, 2);
    expect(monthsSince(40, 5, 1)).toBeCloseTo(471.53, 2);
    expect(monthsSince(40, 11, 1)).toBeCloseTo(477.53, 2);
  });
});

describe('站序由經文機械推出（民33:3-48）', () => {
  it.skipIf(!IN_VAULT)('每一節的「從 X 起行」是前一站，站名出現在該節', () => {
    const bad: string[] = [];
    for (const s of STATIONS) {
      const v = refText(`民33:${s.verse}`);
      if (!v.includes(s.q)) bad.push(`${s.n} ${s.name}：民33:${s.verse} 找不到「${s.q}」`);
      if (!v.includes(s.name)) bad.push(`${s.n}：民33:${s.verse} 沒有站名 ${s.name}`);
      if (s.n >= 2) {
        const from = `從${departedFrom(s)}起行`;
        // 第 1 站本身是出發地，第 2 站（民33:5）寫的是「以色列人從蘭塞起行」
        if (!v.includes(from)) bad.push(`${s.n} ${s.name}：民33:${s.verse} 沒有「${from}」`);
      }
    }
    expect(bad).toEqual([]);
  });
  it.skipIf(!IN_VAULT)('民33:5-48 一共有 41 節「起行」，也就是 42 站', () => {
    const vs = verses('民', 33);
    const moves = vs.slice(4, 48).filter((l) => l.includes('起行')).length;
    expect(moves).toBe(41);
  });
  it.skipIf(!IN_VAULT)('民33:37 是最後一次「從加低斯起行」，民33:41 從何珥山起行', () => {
    expect(refText('民33:37')).toContain('從加低斯起行');
    expect(refText('民33:41')).toContain('從何珥山起行');
  });
  it.skipIf(!IN_VAULT)('地標（比哈希錄、巴力洗分、伯耶施末、亞伯什亭）出現在所引節', () => {
    for (const l of LANDMARKS) expect(refText(`民33:${l.verse}`)).toContain(l.q);
  });
});

describe('經文出處與逐字引文', () => {
  const facts = allFacts();
  it('有資料可以檢查', () => expect(facts.length).toBeGreaterThan(120));
  it.skipIf(!IN_VAULT)('每個出處都指向存在的經節', () => {
    const bad: string[] = [];
    for (const f of facts) for (const r of f.refs ?? []) {
      try { refText(r); } catch (e) { bad.push(`${(e as Error).message}（${f.text}）`); }
    }
    expect(bad).toEqual([]);
  });
  it.skipIf(!IN_VAULT)('每一段摘句都逐字出現在所引經節（和合本 raw_scripture）', () => {
    const bad = facts.filter((f) => f.q && !(f.refs ?? []).map(refText).join('').includes(f.q)).map((f) => `「${f.q}」不在 ${f.refs?.join('、')}`);
    expect(bad).toEqual([]);
  });
  it('「經文明說」一定附出處和摘句；「經文沒說」不附摘句', () => {
    expect(facts.filter((f) => f.status === 'explicit' && (!f.refs?.length || !f.q)).map((f) => f.text)).toEqual([]);
    expect(facts.filter((f) => f.status === 'not_stated' && f.q).map((f) => f.text)).toEqual([]);
  });
});

describe('比對表：三處經文的站名', () => {
  const both = (c: { left: { items: CmpItem[] }; right: { items: CmpItem[] } }) => [...c.left.items, ...c.right.items];
  it('每個「同一個地方」的對應，兩邊都有；名字相同的就是逐字相同', () => {
    for (const c of [COMPARE_A, COMPARE_B]) {
      const groups = new Map<string, CmpItem[]>();
      for (const i of both(c)) if (i.same) groups.set(i.same, [...(groups.get(i.same) ?? []), i]);
      for (const [k, items] of groups) {
        expect(items, k).toHaveLength(2);
        if (items.every((i) => i.via === 'identical')) expect(items[0].name, k).toBe(items[1].name);
      }
    }
  });
  it.skipIf(!IN_VAULT)('每個站名出現在所引經節', () => {
    for (const c of [COMPARE_A, COMPARE_B]) {
      for (const i of both(c)) expect(refText(i.ref), `${i.name}（${i.ref}）`).toContain(i.name);
    }
  });
  it('申10:6-7 的次序和民33:30-33 相反（比對表裡的先後）', () => {
    // 民33：摩西錄→比尼亞干→曷哈及甲→約巴他；申10：比尼亞干→摩西拉→谷歌大→約巴他（CT 的對應）
    const order = (items: CmpItem[]) => items.map((i) => i.same);
    expect(order(COMPARE_B.left.items)).toEqual(['moseroth', 'jaakan', 'gidgad', 'jotbathah']);
    expect(order(COMPARE_B.right.items)).toEqual(['jaakan', 'moseroth', 'gidgad', 'jotbathah']);
  });
});

describe('註釋家的話、地圖說明', () => {
  it.skipIf(!IN_VAULT)('引句逐字出現在出處檔；md 檔要在「」內；轉述的關鍵詞出現在該檔', () => {
    const bad: string[] = [];
    for (const v of allVoices()) {
      if (!existsSync(resolve(ROOT, v.file))) { bad.push(`找不到檔案：${v.file}`); continue; }
      const text = fileText(v.file);
      if (v.quote) {
        if (!text.includes(v.quote)) { bad.push(`${v.file} 找不到：${v.quote}`); continue; }
        if (v.file.endsWith('.md') && !v.plain) {
          const spans = text.match(/「[^」]*」/g) ?? [];
          const inLong = text.split(/\n/).some((line) => {
            const i = line.indexOf(v.quote!);
            return i >= 0 && line.lastIndexOf('「', i) > line.lastIndexOf('」', i);
          });
          if (!spans.some((s) => s.includes(v.quote!)) && !inLong) bad.push(`${v.file} 這句不在「」內（是轉述）：${v.quote}`);
        }
      }
      for (const k of v.keys ?? []) if (!text.includes(k)) bad.push(`${v.file} 找不到關鍵詞：${k}`);
      if (!v.quote && !v.keys?.length) bad.push(`${v.who}：沒有引號也沒有關鍵詞（${v.says}）`);
    }
    expect(bad).toEqual([]);
  });
  it.skipIf(!IN_VAULT)('CT 的原文字義與靈意，逐字出現在 CT 來源檔（靈意在〔靈意註解〕那一行）', () => {
    const ct = fileText('raw_data/ccbiblestudy_CT_numbers_33.txt');
    const lines = ct.split(/\r?\n/);
    const glossLines = lines.filter((l) => l.startsWith('〔原文字義〕'));
    const spiritLines = lines.filter((l) => l.startsWith('〔靈意註解〕'));
    const bad: string[] = [];
    for (const s of STATIONS) {
      if (s.ctGloss && !glossLines.some((l) => l.includes(s.ctGloss!))) bad.push(`${s.n} ${s.name} 字義：${s.ctGloss}`);
      if (s.ctSpirit && !spiritLines.some((l) => l.includes(s.ctSpirit!))) bad.push(`${s.n} ${s.name} 靈意：${s.ctSpirit}`);
      if (s.ctSpirit && !/^第.{1,4}站/.test(s.ctSpirit)) bad.push(`${s.n} 靈意開頭不是「第N站」`);
    }
    expect(bad).toEqual([]);
    // CT 對 34 何珥山、42 摩押平原沒有靈意註解
    expect(station(34).ctSpirit).toBeUndefined();
    expect(station(42).ctSpirit).toBeUndefined();
  });
});

describe('位置', () => {
  it('每一站都有候選資料（水域與範圍站除外）', () => {
    for (const s of STATIONS) {
      if (s.key === 'moab') continue;
      expect((CANDIDATES as Record<string, { cands: unknown[] }>)[s.key]?.cands.length, s.name).toBeGreaterThan(0);
    }
    for (const k of ['bethjeshimoth', 'abelshittim', 'crossing', 'pihahiroth', 'baalzephon']) expect(OB_DATA[k].cands.length).toBeGreaterThan(0);
  });
  it('候選依分數由高到低排；PICK 的序號存在', () => {
    for (const [k, v] of Object.entries(OB_DATA)) {
      const scores = v.cands.map((c) => c.score);
      expect(scores, k).toEqual([...scores].sort((a, b) => b - a));
    }
    for (const [k, p] of Object.entries(PICK)) expect(OB_DATA[k].cands[p.i], k).toBeDefined();
  });
  it('位置可信度由分數機械推出：高≥700、中≥400、低≥100；一帶最高算低，代表點最高算中', () => {
    const c = (score: number, kind = 'point') => ({ name: 'x', lon: 0, lat: 0, kind, score });
    expect(levelOf(c(700))).toBe('high');
    expect(levelOf(c(699))).toBe('mid');
    expect(levelOf(c(400))).toBe('mid');
    expect(levelOf(c(399))).toBe('low');
    expect(levelOf(c(100))).toBe('low');
    expect(levelOf(c(99))).toBe('none');
    expect(levelOf(c(1000, 'center'))).toBe('low');
    expect(levelOf(c(1000, 'representative point'))).toBe('mid');
    expect(LEVEL_LABEL.none).toBe('不詳');
  });
  it('候選名稱的中文標籤：常見句型換成中文，站名對得上就用站名；遺址名保留原文', () => {
    expect(candLabel('within 50 km of Mithkah')).toBe('離「密加」 50 公里內');
    expect(candLabel('another name for Makheloth')).toBe('「瑪吉希錄」的別名（同一個地點）');
    expect(candLabel('about 50 km around Mount Sinai')).toBe('「西乃山」周圍約 50 公里');
    expect(candLabel('along Wadi Gharandal')).toBe('沿 Wadi Gharandal 一帶');
    expect(candLabel('Tell Abu Sefeh')).toBe('Tell Abu Sefeh');
    // 所有候選都不會漏出英文句型
    const leftovers: string[] = [];
    for (const v of Object.values(OB_DATA)) for (const c of v.cands) {
      if (/^(within|another name for|about|along|region around|plain near|mouth of|in )\b/.test(candLabel(c.name))) leftovers.push(c.name);
    }
    expect(leftovers).toEqual([]);
  });
  it('已知的幾站：加低斯、普嫩、底本可信度高；水域那一站不詳', () => {
    const lv = (n: string) => SITES.find((s) => s.key === n)!.level;
    expect(lv('kadesh')).toBe('high');
    expect(lv('punon')).toBe('high');
    expect(lv('dibon')).toBe('high');
    expect(lv('moab')).toBe('high');
    expect(lv('redsea')).toBe('none');
  });
  it('每一站在圖上都有位置，並落在地圖範圍內', () => {
    expect(POSITIONS).toHaveLength(42);
    for (const p of POSITIONS) {
      expect(Number.isFinite(p.x) && Number.isFinite(p.y), `第${p.n}站`).toBe(true);
      expect(p.x).toBeGreaterThanOrEqual(-1);
      expect(p.x).toBeLessThanOrEqual(W + 1);
      expect(p.y).toBeGreaterThanOrEqual(-1);
      expect(p.y).toBeLessThanOrEqual(H + 1);
    }
    expect(BBOX.e).toBeGreaterThan(BBOX.w);
  });
  it('地理次序合理：蘭塞在最西北，摩押平原在最東北；加低斯比西乃靠北靠東', () => {
    const p = (n: number) => POSITIONS[n - 1];
    expect(p(1).x).toBeLessThan(p(12).x);
    expect(p(1).y).toBeLessThan(p(12).y);
    expect(p(42).x).toBeGreaterThan(p(33).x);
    expect(p(42).y).toBeLessThan(p(33).y);
    expect(p(33).y).toBeLessThan(p(12).y);
    expect(p(33).x).toBeGreaterThan(p(12).x);
  });
  it('三十八年那一段（第 16–31 站）是 zone：位置取可信候選的中間值，淡圈圈住這些候選', () => {
    const zs = SITES.filter((s) => s.mode === 'zone');
    expect(zs.map((s) => s.n)).toEqual(Array.from({ length: 16 }, (_, i) => i + 16));
    for (const s of zs) {
      const z = s.zone!;
      expect(z.used.length, `第${s.n}站`).toBeGreaterThan(0);
      // 中間值落在可信候選的外框裡
      const lons = z.used.map((c) => c.lon);
      const lats = z.used.map((c) => c.lat);
      expect(z.lon).toBeGreaterThanOrEqual(Math.min(...lons) - 1e-9);
      expect(z.lon).toBeLessThanOrEqual(Math.max(...lons) + 1e-9);
      expect(z.lat).toBeGreaterThanOrEqual(Math.min(...lats) - 1e-9);
      expect(z.lat).toBeLessThanOrEqual(Math.max(...lats) + 1e-9);
      // 圈住每一個可信候選，而且至少 8 公里
      expect(z.rKm).toBeGreaterThanOrEqual(ZONE_MIN_R_KM);
      for (const c of z.used) expect(kmBetween(c.lon, c.lat, z.lon, z.lat), `第${s.n}站 ${c.name}`).toBeLessThanOrEqual(z.rKm + 1e-6);
    }
    // 其他站不是 zone
    expect(SITES.filter((s) => s.mode === 'zone')).toHaveLength(16);
  });
  it('zoneOf：低分雜訊不計入、加權平均、N 公里內的圈至少 N 公里', () => {
    const c = (name: string, lon: number, lat: number, score: number, kind = 'point') => ({ name, lon, lat, kind, score });
    // 分數 100 與 20：20 < 35% × 100，不計入，中間值就是第一個點
    const one = zoneOf([c('a', 34, 30, 100), c('b', 36, 32, 20)])!;
    expect(one.used).toHaveLength(1);
    expect(one.lon).toBeCloseTo(34, 9);
    expect(one.rKm).toBe(ZONE_MIN_R_KM);
    // 分數 300 與 120（≥ 35%）：加權平均偏向高分那邊，(34×300＋35×120)÷420
    const two = zoneOf([c('a', 34, 30, 300), c('b', 35, 30, 120)])!;
    expect(two.used).toHaveLength(2);
    expect(two.lon).toBeCloseTo((34 * 300 + 35 * 120) / 420, 9);
    // 分數 300 與 100（33% < 35%）：低分那個不計入
    expect(zoneOf([c('a', 34, 30, 300), c('b', 35, 30, 100)])!.used).toHaveLength(1);
    expect(two.rKm).toBeGreaterThan(50);
    // 「某點 50 公里內」：圈至少 50 公里
    const near = zoneOf([c('within 50 km of X', 34, 30, 500, 'center')])!;
    expect(near.rKm).toBe(50);
    // 分數全部 ≤ 0：沒有可信候選
    expect(zoneOf([c('a', 34, 30, -5)])).toBeNull();
  });
  it('zone 的站在圖上不會疊在一起，也不會離自己的中間值太遠', () => {
    const zs = POSITIONS.filter((p) => p.mode === 'zone');
    const d = (a: { x: number; y: number }, b: { x: number; y: number }) => Math.hypot(a.x - b.x, a.y - b.y);
    for (let i = 0; i < zs.length; i++) {
      for (let j = i + 1; j < zs.length; j++) expect(d(zs[i], zs[j]), `第${zs[i].n}與${zs[j].n}站`).toBeGreaterThan(ZONE_MIN_GAP * 0.8);
      // 被輕輕撥開，不是搬家
      expect(d(zs[i], { x: zs[i].zx!, y: zs[i].zy! }), `第${zs[i].n}站`).toBeLessThan(ZONE_MIN_GAP * 4);
      expect(zs[i].zr!).toBeGreaterThan(0);
    }
    // 和非 zone 的站也保持距離
    for (const q of POSITIONS.filter((p) => p.mode !== 'zone' && p.mode !== 'route')) {
      for (const z of zs) expect(d(q, z), `第${q.n}站與第${z.n}站`).toBeGreaterThan(ZONE_MIN_GAP * 0.6);
    }
  });
  it('推開的結果每次都一樣（固定次數、固定順序）', () => {
    const again = resolvePositions();
    for (const p of POSITIONS) {
      const q = again[p.n - 1];
      expect(q.x).toBeCloseTo(p.x, 9);
      expect(q.y).toBeCloseTo(p.y, 9);
    }
  });
  it('每一站的站名位置有值', () => {
    for (const p of POSITIONS) expect(['start', 'middle', 'end']).toContain(p.anchor);
  });
  it('同一個座標的站散開，不會疊在一起', () => {
    const seen = new Set<string>();
    for (const p of POSITIONS) {
      const k = `${Math.round(p.x)},${Math.round(p.y)}`;
      expect(seen.has(k), `第${p.n}站和別站同一點`).toBe(false);
      seen.add(k);
    }
  });
});

describe('地點條目與 verses.json', () => {
  it.skipIf(!IN_VAULT)('places.json 和 link_folder/地點 的條目一致（改了條目要重跑 npm run places）', async () => {
    // @ts-expect-error — plain .mjs helper without types
    const { buildPlaces, ENTRIES } = await import('../../scripts/build-places.mjs');
    const stored = JSON.parse(readFileSync(resolve(__dirname, 'places.json'), 'utf8'));
    expect(stored).toEqual(buildPlaces());
    const used = [...new Set(STATIONS.flatMap((s) => (s.entry ? [s.entry] : [])))].sort();
    expect([...ENTRIES].sort()).toEqual(used);
    for (const v of Object.values(stored) as string[]) expect(v.length).toBeGreaterThan(20);
  });
  it('條目連結是公開的網頁網址（GitHub 上渲染的條目頁），不是 obsidian://', () => {
    expect(entryUrl('加低斯')).toBe('https://andyjr5566.github.io/Bible_wiki_zh_website/link_folder/%E5%9C%B0%E9%BB%9E/%E5%8A%A0%E4%BD%8E%E6%96%AF');
    for (const s of STATIONS) {
      if (!s.entry) continue;
      const u = entryUrl(s.entry);
      expect(u.startsWith('https://'), s.entry).toBe(true);
      expect(u).not.toMatch(/obsidian/i);
      expect(decodeURIComponent(u).endsWith(`/link_folder/地點/${s.entry}`), s.entry).toBe(true);
    }
  });
  it.skipIf(!IN_VAULT)('每個有條目的站，網址指到的檔案在知識庫裡真的存在', () => {
    for (const s of STATIONS) {
      if (s.entry) expect(existsSync(resolve(ROOT, 'link_folder', '地點', `${s.entry}.md`)), s.entry).toBe(true);
    }
  });
  it.skipIf(!IN_VAULT)('verses.json 和 raw_scripture 完全一致（改了經文檔要重跑 npm run verses）', async () => {
    // @ts-expect-error — plain .mjs helper without types
    const { buildVerses } = await import('../../scripts/build-verses.mjs');
    expect(JSON.parse(readFileSync(resolve(__dirname, 'verses.json'), 'utf8'))).toEqual(buildVerses());
  });
  it('每個辯論、比對、日期的站號與經節都有內容（不是空殼）', () => {
    expect(DEBATES.length).toBeGreaterThanOrEqual(8);
    for (const d of DEBATES) expect(d.voices.length, d.id).toBeGreaterThan(0);
  });
});
