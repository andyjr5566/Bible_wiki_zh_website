import { describe, expect, it } from 'vitest';
import { readFileSync, readdirSync, statSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';
import figures from '../assets/figures/figures.json';
import atlas from '../assets/figures/atlas.json';
import sources from '../../scripts/figure-sources.json';

const root=resolve('src/assets/figures');
const files=(dir:string):string[]=>readdirSync(dir).flatMap(name=>{
  const p=resolve(dir,name); return statSync(p).isDirectory()?files(p):[p];
});
describe('人物卡片素材閘門',()=>{
  it('每張 PNG 的尺寸與頭頂、腳底錨點均有效',()=>{
    expect(Object.keys(figures.figures).length).toBeGreaterThan(0);
    for(const f of Object.values(figures.figures)){
      const png=readFileSync(resolve(root,f.file));
      expect(png.readUInt32BE(16)).toBe(f.width); expect(png.readUInt32BE(20)).toBe(f.height);
      for(const a of [f.head,f.foot]){
        expect(a).toHaveLength(2); expect(a.every(Number.isFinite)).toBe(true);
        expect(a[0]).toBeGreaterThanOrEqual(0);expect(a[0]).toBeLessThanOrEqual(f.width);
        expect(a[1]).toBeGreaterThanOrEqual(0);expect(a[1]).toBeLessThanOrEqual(f.height);
      }
      expect(f.foot[1]).toBeGreaterThan(f.head[1]);
    }
  });
  it('集中對應表存在且每個角色與姿勢都有產物',()=>{
    expect(existsSync('scripts/figure-sources.json')).toBe(true);
    const entries=figures.figures as Record<string,unknown>;
    for(const [role,poses] of Object.entries(sources.roles))for(const pose of Object.keys(poses))expect(entries[`${role}/${pose}`]).toBeDefined();
    for(const role of Object.values(sources.actors))expect(entries[`${role}/stand`]).toBeDefined();
  });
  it('人物貼圖總量不超過 4 MB（包含切片與 atlas）',()=>{
    const total=files(root).filter(p=>/\.(png|webp)$/.test(p)).reduce((n,p)=>n+statSync(p).size,0);
    expect(total).toBeLessThanOrEqual(4_000_000);
  });
  it('圖集涵蓋所有姿勢、錨點一致且 UV 不越界',()=>{
    expect(Object.keys(atlas.frames).sort()).toEqual(Object.keys(figures.figures).sort());
    const packed=atlas.frames as Record<string,{head:number[];foot:number[];uv:number[]}>;
    for(const [name,f] of Object.entries(figures.figures)){
      const a=packed[name];expect(a.head).toEqual(f.head);expect(a.foot).toEqual(f.foot);
      expect(a.uv.length).toBe(4);expect(a.uv.every(Number.isFinite)).toBe(true);
      expect(a.uv[0]).toBeGreaterThanOrEqual(0);expect(a.uv[1]).toBeGreaterThanOrEqual(0);
      expect(a.uv[2]).toBeGreaterThan(0);expect(a.uv[3]).toBeGreaterThan(0);
      expect(a.uv[0]+a.uv[2]).toBeLessThanOrEqual(1);expect(a.uv[1]+a.uv[3]).toBeLessThanOrEqual(1);
    }
  });
});
