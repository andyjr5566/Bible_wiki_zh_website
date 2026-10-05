import * as THREE from 'three';
import { BALAAM_FACTS } from '../data/center';
import { CLANS } from '../data/levites';
import { MATRIARCH, TRIBES, camp, fmt, tribe } from '../data/tribes';
import type { CampId } from '../data/types';
import type { SignalId } from '../data/trumpets';
import { phasesOf, viewAt } from '../phases';
import * as store from '../store';
import { h, svg } from '../ui/dom';
import { factLine } from '../ui/evidence';
import { ICONS } from '../ui/icons';
import { CAMP_HEX } from '../ui/meta';
import { selLabel } from '../ui/campmap';
import { tentsFor } from '../layout';
import { buildEntities } from './entities';
import { PRESETS, createStage } from './scene';
import type { CamPreset, Stage } from './scene';
import { buildWorld, loadAssets } from './world';
import type { World } from './world';

const PRESET_LABEL: Record<CamPreset, string> = { top: '俯視', orbit: '繞著看', ground: '營地地面', balaam: '營外高處' };
const SIG_COLOR: Record<SignalId, number> = { both: 0xb88a1c, one: 0xb88a1c, alarm1: CAMP_HEX.judah, alarm2: CAMP_HEX.reuben };

export type RiseKey = CampId | 'levi' | 'court';

/** 給捲動故事與頁面用的控制介面 */
export interface ThreeCtl {
  stage: Stage;
  world: World;
  /** 故事模式：鏡頭由捲動決定、不能點選、工具列收起、名牌只顯示 setLabels 指定的 */
  setStory(on: boolean): void;
  pose(pos: readonly [number, number, number], target: readonly [number, number, number]): void;
  setTod(t: number, immediate?: boolean): void;
  setRise(key: RiseKey, r: number): void;
  /** 名牌的 key：t-支派、c-利未族、court、b-營；null＝全部 */
  setLabels(keys: readonly string[] | null): void;
  /** 全螢幕自由探索 */
  explore(on: boolean): void;
  isExploring(): boolean;
}

export async function mountThree(wrap: HTMLElement, opts: { onExplore?: (on: boolean) => void; onProgress?: (n: number, total: number) => void } = {}): Promise<ThreeCtl> {
  // 先確認這台裝置有 WebGL
  const probe = document.createElement('canvas');
  if (!(probe.getContext('webgl2') || probe.getContext('webgl'))) throw new Error('no webgl');

  const assets = await loadAssets(opts.onProgress);

  const stage = createStage(wrap);
  const world = buildWorld(stage.scene, assets);
  const entities = buildEntities(world, assets);

  let storyOn = false;
  let exploring = false;
  let labelFilter: Set<string> | null = null;

  /* ---- 自由探索的工具列：鏡頭、日夜、拔營、名稱、離開 ---- */
  let preset: CamPreset = 'orbit';
  const presetBtns = (Object.keys(PRESETS) as CamPreset[]).map((p) => h('button', {
    class: 'chipbtn', type: 'button', 'aria-pressed': String(p === preset), onclick: () => setPreset(p),
  }, PRESET_LABEL[p]));
  const nightBtn = h('button', { class: 'chipbtn', type: 'button', 'aria-pressed': 'false', onclick: () => store.set({ night: !store.get().night }) }, svg(ICONS.moon), '夜間');
  const playBtn = h('button', { class: 'chipbtn', type: 'button', onclick: () => {
    const st = store.get();
    const last = phasesOf(st.mode).length - 1;
    if (st.playing) store.set({ playing: false });
    else store.set({ playing: true, phase: st.phase >= last ? 0 : st.phase });
  } }, svg(ICONS.play), '拔營');
  const resetBtn = h('button', { class: 'chipbtn', type: 'button', onclick: () => store.set({ phase: 0, playing: false }) }, svg(ICONS.reset), '住營');
  let showLabels = true;
  const labelBtn = h('button', { class: 'chipbtn', type: 'button', 'aria-pressed': 'true', onclick: () => {
    showLabels = !showLabels;
    labelBtn.setAttribute('aria-pressed', String(showLabels));
    labelLayer.style.display = showLabels ? '' : 'none';
  } }, '名稱');
  const closeBtn = h('button', { class: 'chipbtn x-close', type: 'button', onclick: () => api.explore(false) }, svg(ICONS.x), '回到故事');
  const bar = h('div', { class: 'three-bar', role: 'toolbar', 'aria-label': '立體營地的鏡頭與播放' }, ...presetBtns, nightBtn, playBtn, resetBtn, labelBtn, closeBtn);
  const caption = h('div', { class: 'three-caption', 'aria-live': 'polite' });
  const labelLayer = h('div', { class: 'three-labels', 'aria-hidden': 'true' });
  wrap.append(labelLayer, bar, caption);

  const labelEls = world.labels.map((l) => {
    const el = h('button', { class: 'tlabel', type: 'button', tabindex: -1, 'data-k': l.key, onclick: () => { if (!storyOn) store.set({ sel: l.sel }); } }, l.text);
    labelLayer.append(el);
    return { el, l };
  });

  function setPreset(p: CamPreset) {
    preset = p;
    presetBtns.forEach((b, i) => b.setAttribute('aria-pressed', String((Object.keys(PRESETS) as CamPreset[])[i] === p)));
    stage.flyTo(p);
    renderCaption();
  }

  /* ---- 點選（只有自由探索時） ---- */
  const ray = new THREE.Raycaster();
  const ndc = new THREE.Vector2();
  let down: { x: number; y: number; t: number } | null = null;
  const dom = stage.renderer.domElement;
  dom.addEventListener('pointerdown', (e) => { down = { x: e.clientX, y: e.clientY, t: performance.now() }; });
  dom.addEventListener('pointerup', (e) => {
    if (!down || storyOn) return;
    const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
    const quick = performance.now() - down.t < 500;
    down = null;
    if (moved > 5 || !quick) return;
    const r = dom.getBoundingClientRect();
    ndc.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    ray.setFromCamera(ndc, stage.camera);
    const hit = ray.intersectObjects(world.hitboxes, false)[0];
    store.set({ sel: hit ? (hit.object.userData.sel as store.Selection) : null });
  });

  /* ---- 依 store 更新 ---- */
  const cream = new THREE.Color(0xf1e6cc);
  function recolorMother(on: boolean) {
    for (const t of TRIBES) {
      const mesh = world.tribeTents[t.id];
      const base = new THREE.Color(on ? MATRIARCH[t.mother].color : CAMP_HEX[t.camp]);
      const col = new THREE.Color();
      for (let i = 0; i < mesh.instanceMatrix.count; i++) {
        col.copy(base).lerp(cream, 0.4 + ((i * 37) % 16) / 100);
        mesh.setColorAt(i, col);
      }
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
    }
  }
  function setCounts(c26: boolean) {
    for (const t of TRIBES) world.tribeTents[t.id].count = tentsFor(c26 ? t.c26.n : t.c2.n);
  }

  const selWorld = (sel: store.Selection): THREE.Vector3 | null => {
    if (!sel) return null;
    if (sel.kind === 'camp') {
      const ds = world.decals.filter((x) => x.camp === sel.id && x.tribe);
      const v = new THREE.Vector3();
      ds.forEach((x) => v.add(x.mesh.position));
      return v.multiplyScalar(1 / Math.max(1, ds.length));
    }
    const d = world.decals.find((x) => {
      if (sel.kind === 'tribe') return x.tribe === sel.id;
      if (sel.kind === 'clan') return x.clan === sel.id;
      return !!x.court;
    });
    return d ? d.mesh.position.clone() : null;
  };

  let visible = true;
  store.subscribe((st, prev) => {
    if (!storyOn) stage.setNight(st.night);
    nightBtn.setAttribute('aria-pressed', String(st.night));
    if (st.layers.banner !== prev.layers.banner) {
      for (const f of Object.values(world.flags)) {
        (f.mesh.material as THREE.MeshStandardMaterial).map = st.layers.banner ? f.trad : f.day;
        (f.mesh.material as THREE.MeshStandardMaterial).needsUpdate = true;
      }
    }
    if (st.layers.mother !== prev.layers.mother) recolorMother(st.layers.mother);
    if (st.layers.c26 !== prev.layers.c26) setCounts(st.layers.c26);
    if (st.pulse && st.pulse.t !== prev.pulse?.t) pulse(st.pulse.id);
    if (st.playing !== prev.playing) {
      playBtn.replaceChildren(svg(st.playing ? ICONS.pause : ICONS.play), st.playing ? '暫停' : '拔營');
    }
    // 自由探索時選了東西：鏡頭慢慢移過去（保持目前的視角）
    if (exploring && visible && st.sel && !store.sameSel(st.sel, prev.sel)) {
      const p = selWorld(st.sel);
      if (p && preset !== 'balaam') {
        const off = stage.camera.position.clone().sub(stage.controls.target);
        const dist = Math.min(off.length(), st.sel.kind === 'camp' ? 380 : 240);
        off.setLength(Math.max(dist, 120));
        stage.flyCustom(p.clone().add(off), p.clone().setY(4), 1000);
      }
    }
    renderCaption();
  });

  function renderCaption() {
    const st = store.get();
    const bits: (Node | string)[] = [];
    if (preset === 'balaam') {
      bits.push(h('div', null, h('b', null, '站在營外的高處往下看。'), ' 山的位置與高度是示意；經文寫的是：'),
        ...BALAAM_FACTS.map((f) => h('div', null, factLine(f))));
    } else {
      if (st.phase > 0) {
        const phases = phasesOf(st.mode);
        const p = phases[Math.min(st.phase, phases.length - 1)];
        const title = p.kind === 'step' ? `第 ${p.index + 1} 批：${p.step.label}` : p.kind === 'cloud' ? '雲彩從帳幕收上去' : p.kind === 'done' ? '全部出發了' : '';
        if (title) bits.push(h('div', null, h('b', null, title), p.kind === 'step' && p.step.carries ? `　帶著：${p.step.carries}` : ''));
      }
      if (st.sel) {
        const sel = st.sel;
        let extra = '';
        if (sel.kind === 'tribe') {
          const t = tribe(sel.id);
          extra = `　${fmt(t.c2.n)} 名・首領${t.leader}`;
        } else if (sel.kind === 'camp') {
          extra = `　${fmt(camp(sel.id).total.n)} 名`;
        } else if (sel.kind === 'clan') {
          const n = CLANS.find((c) => c.id === sel.id)?.count?.n;
          extra = n ? `　${fmt(n)} 名` : '';
        }
        bits.push(h('div', null, h('b', null, selLabel(sel)), extra));
      }
      if (!bits.length) bits.push('拖曳旋轉、滾輪或雙指縮放。點一個區塊選取；上面的「拔營」可以看整個營怎麼動起來。');
    }
    caption.replaceChildren(...bits.map((b) => (typeof b === 'string' ? document.createTextNode(b) : b)));
  }
  renderCaption();

  /* ---- 號聲的圈圈 ---- */
  const rings: { mesh: THREE.Mesh; t0: number }[] = [];
  let blink: { id: SignalId; t0: number } | null = null;
  function pulse(id: SignalId) {
    const cw = world.rectWorld({ x: 344, y: 239, w: 140, h: 70 });
    const mesh = new THREE.Mesh(new THREE.RingGeometry(3, 3.8, 72), new THREE.MeshBasicMaterial({ color: SIG_COLOR[id], transparent: true, opacity: 0.9, side: THREE.DoubleSide, depthWrite: false }));
    mesh.rotation.x = -Math.PI / 2;
    mesh.position.set(cw.cx, 1.2, cw.cz);
    world.root.add(mesh);
    rings.push({ mesh, t0: performance.now() });
    blink = { id, t0: performance.now() };
  }

  /* ---- 每一格 ---- */
  const v3 = new THREE.Vector3();
  let lift = 0;
  stage.onFrame((dt, t) => {
    const st = store.get();
    entities.update(dt, st);
    const view = viewAt(st.mode, st.phase);

    // 雲彩：住營時遮蓋帳幕，收上去就往上飄走；越接近夜裡越像火
    const liftTarget = view.cloudLifted ? 1 : 0;
    const step = dt / 2.6;
    lift += Math.max(-step, Math.min(step, liftTarget - lift));
    const tod = stage.tod();
    const night = 1 - THREE.MathUtils.smoothstep(tod, 0.32, 0.62);
    world.cloud.update(dt, { lift, night, t });

    // 旗子飄動（裝飾動態：作業系統要求減少動態時不飄）
    const still = matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.dataset.motion === 'off';
    if (!still) for (const f of Object.values(world.flags)) f.mesh.rotation.y = Math.sin(t * 2 + f.mesh.id) * 0.12;

    // 選取的高亮（故事模式不顯示）
    const sel = storyOn ? null : st.sel;
    for (const d of world.decals) {
      let target = 0;
      if (sel) {
        if (sel.kind === 'tribe') target = d.tribe === sel.id ? 0.38 : d.camp === tribe(sel.id).camp && d.tribe ? 0.16 : 0;
        else if (sel.kind === 'camp') target = d.camp === sel.id && d.tribe ? 0.24 : 0;
        else if (sel.kind === 'clan') target = d.clan === sel.id ? 0.4 : 0;
        else target = d.court ? 0.3 : 0;
      }
      const m = d.mesh.material as THREE.MeshBasicMaterial;
      m.opacity += (target - m.opacity) * Math.min(1, dt * 8);
    }

    // 號聲：圈圈擴散，被點到的營亮一下
    for (let i = rings.length - 1; i >= 0; i--) {
      const k = (performance.now() - rings[i].t0) / 1900;
      if (k >= 1) { world.root.remove(rings[i].mesh); rings[i].mesh.geometry.dispose(); rings.splice(i, 1); continue; }
      rings[i].mesh.scale.setScalar(1 + k * 95);
      (rings[i].mesh.material as THREE.MeshBasicMaterial).opacity = 0.9 * (1 - k);
    }
    for (const mat of Object.values(world.campMats)) mat.emissiveIntensity = 0;
    if (blink) {
      const k = (performance.now() - blink.t0) / 2200;
      if (k >= 1) blink = null;
      else {
        const amp = 0.55 * Math.abs(Math.sin(k * Math.PI * 5)) * (1 - k);
        if (blink.id === 'alarm1') world.campMats.judah.emissiveIntensity = amp;
        else if (blink.id === 'alarm2') world.campMats.reuben.emissiveIntensity = amp;
        else if (blink.id === 'both') for (const m of Object.values(world.campMats)) m.emissiveIntensity = amp * 0.7;
      }
    }

    // 名稱標籤跟著位置走
    const w = wrap.clientWidth;
    const hh = wrap.clientHeight;
    for (const { el, l } of labelEls) {
      const allowed = !labelFilter || labelFilter.has(l.key);
      const ls = l.sel;
      // 已經出發或還沒立起來的：標籤收起來
      const gone = !!ls && (
        ls.kind === 'tabernacle' ? !world.courtGroup.visible
          : ls.kind === 'tribe' ? !world.tribeGroups[ls.id].visible
            : ls.kind === 'clan' ? !world.clanGroups[ls.id].visible
              : !world.flags[ls.id].mesh.visible || !world.flags[ls.id].mesh.parent!.visible);
      let on = allowed && !gone;
      if (on) {
        v3.copy(l.pos).project(stage.camera);
        on = v3.z < 1 && Math.abs(v3.x) < 1.05 && Math.abs(v3.y) < 1.05;
      }
      el.style.display = on ? '' : 'none';
      if (on) el.style.transform = `translate(${((v3.x + 1) / 2) * w}px, ${((1 - v3.y) / 2) * hh}px) translate(-50%, -50%)`;
      el.classList.toggle('sel', !!sel && store.sameSel(sel, l.sel));
    }
  });

  /* ---- 只有看得到的時候才畫 ---- */
  const io = new IntersectionObserver((entries) => {
    visible = entries.some((e) => e.isIntersecting);
    if (visible && !document.hidden) stage.start(); else stage.stop();
  }, { threshold: 0.01 });
  io.observe(wrap);
  document.addEventListener('visibilitychange', () => {
    if (document.hidden) stage.stop(); else if (visible) stage.start();
  });

  const desired = { pos: new THREE.Vector3(), target: new THREE.Vector3() };
  const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape' && exploring) api.explore(false); };

  const api: ThreeCtl = {
    stage, world,
    setStory(on) {
      storyOn = on;
      wrap.classList.toggle('is-story', on);
      stage.follow(on ? desired : null);
      if (!on) stage.setNight(store.get().night);
    },
    pose(pos, target) {
      desired.pos.set(...pos);
      desired.target.set(...target);
    },
    setTod(t, immediate) { if (storyOn) stage.setTod(t, immediate); },
    setRise(key, r) { world.setRise(key, r); },
    setLabels(keys) { labelFilter = keys ? new Set(keys) : null; },
    explore(on) {
      if (on === exploring) return;
      exploring = on;
      wrap.classList.toggle('is-explore', on);
      document.documentElement.classList.toggle('three-explore', on);
      if (on) {
        api.setStory(false);
        labelFilter = null;
        // 從故事的哪一幕進來都一樣：整個營都立好
        for (const k of ['court', 'levi', 'judah', 'reuben', 'ephraim', 'dan'] as RiseKey[]) world.setRise(k, 1);
        setPreset('orbit');
        addEventListener('keydown', onKey);
        closeBtn.focus();
      } else {
        removeEventListener('keydown', onKey);
      }
      opts.onExplore?.(on);
    },
    isExploring: () => exploring,
  };

  // 除錯：__num2.cam('ground') 直接切鏡頭
  Object.assign((window as unknown as { __num2?: object }).__num2 ?? {}, { cam: setPreset, three: api });
  stage.start();
  return api;
}
