// Freesound 頁面工具：search <query> 列出 CC0 結果；info <id...> 抓授權、長度、預覽網址；get <id> <out> 下載 hq 預覽 mp3。
import { writeFileSync } from 'node:fs';
const UA = { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/141.0.0.0' };
const [cmd, ...args] = process.argv.slice(2);
const get = async (u) => (await fetch(u, { headers: UA })).text();

if (cmd === 'search') {
  const q = encodeURIComponent(args.join(' '));
  const html = await get(`https://freesound.org/search/?q=${q}&f=license:%22Creative+Commons+0%22&s=Relevance`);
  const seen = new Set();
  for (const m of html.matchAll(/href="\/people\/([^/]+)\/sounds\/(\d+)\/"[^>]*>([^<]{2,120})</g)) {
    if (seen.has(m[2])) continue; seen.add(m[2]);
    console.log(`${m[2]}\t${m[1]}\t${m[3].trim()}`);
  }
} else if (cmd === 'info') {
  for (const id of args) {
    const html = await get(`https://freesound.org/s/${id}/`);
    const title = /<title>([^<]*)<\/title>/.exec(html)?.[1]?.trim();
    const lic = [...html.matchAll(/creativecommons\.org\/(publicdomain\/zero|licenses\/[a-z-]+)\/[\d.]+/g)].map((m) => m[0]);
    const prev = /https:\/\/cdn\.freesound\.org\/previews\/[^"']+?-hq\.mp3/.exec(html)?.[0];
    const dur = /data-duration="([\d.]+)"/.exec(html)?.[1] ?? /([\d.]+)\s*s<\/dd>/.exec(html)?.[1];
    const licText = /(Creative Commons 0|Attribution NonCommercial|Attribution 4\.0|Attribution 3\.0|Sampling\+)/.exec(html)?.[1];
    console.log(JSON.stringify({ id, title, licText, lic: [...new Set(lic)], dur, prev }));
  }
} else if (cmd === 'get') {
  const [id, out] = args;
  const html = await get(`https://freesound.org/s/${id}/`);
  const prev = /https:\/\/cdn\.freesound\.org\/previews\/[^"']+?-hq\.mp3/.exec(html)?.[0];
  if (!prev) { console.log('no preview'); process.exit(1); }
  const buf = Buffer.from(await (await fetch(prev, { headers: UA })).arrayBuffer());
  writeFileSync(out, buf);
  console.log(`saved ${out} ${buf.length} bytes from ${prev}`);
}
