// 場景層入口：createScene。Three.js 低面數 3D＋版畫刻線著色器。
// 渲染流程：主場景（天空→世界→半夜黑暗）→ meal 分格（scissor）→ 覆蓋層（抹除轉場＋紙紋）。
import { Mesh, OrthographicCamera, PlaneGeometry, Scene, Vector3, WebGLRenderer, WebGLRenderTarget } from 'three';
import type { Palette } from '../data/types';
import { story } from '../story/state';
import type { CreateScene, SceneHandle, SceneOptions } from './api';
import { HyssopCtl } from './hyssop';
import { Interior } from './interior';
import { darknessMat, disposeShared, grainMat, PalVec, setLook, tjMat, U, wipeMat } from './materials';
import { c as cu, CHAPTER_IDS, CUE_IDX, createTrackOut, inCoda, inMidnight, midnightP, paletteAt, REST, sampleTracks, stepRest, stepSummer, SUMMER, TJ_DIR, tjAmt, wipeAmt } from './tracks';
import { Vortex } from './vortex';
import { clamp } from './util';
import { WaveCtl } from './wave';
import { World, type Frame } from './world';

const DEFAULT_PAL: Palette = { paper: '#efe5cf', ink: '#1a2342', accent: '#b9832e', glow: '#f7efd8' };

const _v = new Vector3();

export const createScene: CreateScene = (opts: SceneOptions): SceneHandle | null => {
  const { canvas, palettes, laterPalette, onEvent } = opts;
  let renderer: WebGLRenderer;
  try {
    renderer = new WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: 'high-performance', stencil: false });
  } catch {
    return null;
  }
  if (!renderer.capabilities.isWebGL2) {
    renderer.dispose();
    return null;
  }
  renderer.autoClear = false;
  renderer.info.autoReset = false;
  // 開發用：lab 頁可強制指定鏡頭（px,py,pz,tx,ty,tz,fov,fitW）
  let camOverride: number[] | null = null;
  Object.defineProperty(canvas, '__jfCam', { configurable: true, value: (v: number[] | null) => { camOverride = v; dirty = true; } });
  // 開發用：每幀花的時間（毫秒，含 gl.finish，只在 __jfBench 開啟時量）。rAF 在 headless 被鎖在約 30，量不出餘裕，所以另外量這個。
  let vortexLast: () => { x: number; y: number; r: number; on: boolean } = () => ({ x: 0, y: 0, r: 0, on: false });
  let bench = false;
  let benchMs = 0;
  let gpuMs = -1;
  const gl2 = renderer.getContext() as WebGL2RenderingContext;
  const timerExt = gl2.getExtension('EXT_disjoint_timer_query_webgl2') as { TIME_ELAPSED_EXT: number; GPU_DISJOINT_EXT: number } | null;
  const pendingQ: WebGLQuery[] = [];
  // 開發用：目前這一幀的鏡頭軌道值（px,py,pz,tx,ty,tz,fov,fitW）與收起程度，tools/check-subject-box.mjs 用來找「鏡頭目標點」
  Object.defineProperty(canvas, '__jfTrack', { configurable: true, value: () => ({ cam: Array.from(tracks.cam), fold: foldF }) });
  Object.defineProperty(canvas, '__jfVortex', { configurable: true, value: () => vortexLast() });
  Object.defineProperty(canvas, '__jfBench', { configurable: true, value: (on: boolean) => { bench = on; benchMs = 0; } });
  Object.defineProperty(canvas, '__jfInfo', { configurable: true, value: () => ({ triangles: renderer.info.render.triangles, calls: renderer.info.render.calls, geometries: renderer.info.memory.geometries, frameMs: benchMs, gpuMs }) });
  renderer.setClearColor(0x15130f, 1);

  const pals = CHAPTER_IDS.map((id) => new PalVec(palettes[id] ?? palettes['passover'] ?? palettes['opening'] ?? DEFAULT_PAL));
  // 回聲拍（後來的歷史）用的舊紙配色放在最後
  const laterPV = new PalVec(laterPalette ?? { paper: '#e2d2ad', ink: '#38291a', accent: '#8a5a2b', glow: '#efd9a8' });
  pals.push(laterPV);

  const world = new World(() => onEvent({ type: 'door-shut' }));
  // 開發用：lab 頁檢查物件狀態
  Object.defineProperty(canvas, '__jfWorld', { configurable: true, value: world });
  const interior = new Interior();
  const hyssop = new HyssopCtl(canvas, world.camera, onEvent);
  world.scene.add(hyssop.group);
  const wave = new WaveCtl(canvas, world.camera, onEvent);
  world.scene.add(wave.group);

  // 半夜的黑暗（世界場景最上層）
  const dMat = darknessMat();
  const darkness = new Mesh(new PlaneGeometry(2, 2), dMat);
  darkness.frustumCulled = false;
  darkness.renderOrder = 10;
  darkness.visible = false;
  world.scene.add(darkness);

  // 覆蓋層：抹除轉場、紙紋
  const overlay = new Scene();
  const ortho = new OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const wMat = wipeMat();
  const gMat = grainMat();
  const wipe = new Mesh(new PlaneGeometry(2, 2), wMat);
  wipe.frustumCulled = false;
  wipe.renderOrder = 1;
  const grain = new Mesh(new PlaneGeometry(2, 2), gMat);
  grain.frustumCulled = false;
  grain.renderOrder = 2;
  // 七的節奏的漩渦：畫在抹除之上、紙紋之下（抹除掃過時漩渦不跟著閃）
  const vortex = new Vortex();
  vortexLast = () => vortex.last;
  overlay.add(wipe, vortex.mesh, vortex.labels, grain);

  // 時間跳躍抹除（回聲拍進出）：先把世界畫到離screen的畫布，再用斜向舊紙抹除合成
  const tMat = tjMat();
  const tjScene = new Scene();
  const tjQuad = new Mesh(new PlaneGeometry(2, 2), tMat);
  tjQuad.frustumCulled = false;
  tjScene.add(tjQuad);
  let tjRT: WebGLRenderTarget | null = null;

  // ---------------------------------------------------------------- 尺寸
  let W = canvas.clientWidth || window.innerWidth;
  let H = canvas.clientHeight || window.innerHeight;
  let dprIn = window.devicePixelRatio || 1;
  let bufW = 1;
  let bufH = 1;
  const capFor = (w: number): number => (w < 760 || matchMedia('(pointer: coarse)').matches ? 1.5 : 1.75);
  const applySize = () => {
    const dpr = Math.min(dprIn, capFor(W));
    renderer.setPixelRatio(dpr);
    renderer.setSize(W, H, false);
    bufW = canvas.width;
    bufH = canvas.height;
    U.uDpr.value = bufW / Math.max(W, 1);
    U.uRes.value.set(bufW, bufH);
    U.uViewport.value.set(bufW, bufH);
    hyssop.setSize(W, H);
    wave.setSize(W, H);
    dirty = true;
  };

  // ---------------------------------------------------------------- 狀態
  const tracks = createTrackOut();
  const fr: Frame = { s: 0, idx: 0, dt: 0, time: 0, dark: 0, motionOff: false };
  let lastIdx = 0;
  let darkF = story.dark ? 1 : 0;
  // 說明框收起：由 <html data-fold> 的變化通知（MutationObserver，不在每幀查 DOM）。
  // foldF 以時間阻尼追 foldT（約 0.5 秒），動態關閉時直接到位。
  const root = document.documentElement;
  let foldT = root.hasAttribute('data-fold') ? 1 : 0;
  let foldF = foldT;
  const foldObs = new MutationObserver(() => {
    foldT = root.hasAttribute('data-fold') ? 1 : 0;
    dirty = true;
  });
  foldObs.observe(root, { attributes: true, attributeFilter: ['data-fold'] });
  let last = performance.now();
  let raf = 0;
  let disposed = false;
  let readySent = false;
  let dirty = true;
  const sig = new Float64Array(20);
  const lastSig = new Float64Array(20);
  let panelEl: HTMLElement | null = null;
  let panelTick = 0;
  const panelBox = { x: 0, y: 0, w: 0, h: 0, cx: 0, cy: 0, cw: 0, ch: 0 };

  /** 沿祖先連乘 opacity；display／visibility 為隱藏時回傳 0（介面把分格淡入淡出時，分格內的畫面要跟著出現／消失） */
  const effectiveOpacity = (el: HTMLElement): number => {
    let o = 1;
    let n: HTMLElement | null = el;
    for (let d = 0; n && d < 8; d++, n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
      o *= parseFloat(cs.opacity);
    }
    return o;
  };

  const findPanel = (s: number): boolean => {
    if (s < cu('meal', -0.5) || s > cu('meal', 1.5)) return false; // 只有吃羊羔前後才畫室內
    if (!panelEl || !panelEl.isConnected || panelTick++ % 45 === 0) panelEl = document.querySelector<HTMLElement>('[data-jf-panel="meal"]');
    if (!panelEl) return false;
    if (effectiveOpacity(panelEl) < 0.5) return false;
    const r = panelEl.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    const x = r.left - c.left;
    const y = r.top - c.top;
    if (r.width < 8 || r.height < 8) return false;
    const x0 = clamp(x, 0, W);
    const y0 = clamp(y, 0, H);
    const x1 = clamp(x + r.width, 0, W);
    const y1 = clamp(y + r.height, 0, H);
    if (x1 - x0 < 4 || y1 - y0 < 4) return false;
    panelBox.x = x;
    panelBox.y = y;
    panelBox.w = r.width;
    panelBox.h = r.height;
    panelBox.cx = x0;
    panelBox.cy = y0;
    panelBox.cw = x1 - x0;
    panelBox.ch = y1 - y0;
    return true;
  };
  /** 世界座標 → 繪圖緩衝的像素（y 向上）；在鏡頭後方回傳 false */
  const projBuf = (v: Vector3, out: { x: number; y: number }): boolean => {
    _v.copy(v).project(world.camera);
    out.x = (_v.x * 0.5 + 0.5) * bufW;
    out.y = (_v.y * 0.5 + 0.5) * bufH;
    return _v.z < 1;
  };
  const pa = { x: 0, y: 0 };
  const pb = { x: 0, y: 0 };
  const pc = { x: 0, y: 0 };

  const updateDarkness = (s: number) => {
    const on = inMidnight(s);
    darkness.visible = on;
    if (!on) return;
    const u = dMat.uniforms;
    const band = bufW * 0.4;
    const p = midnightP(s);
    u.uBand.value = band;
    u.uFront.value = (bufW + band) * (1 - p) - band * p;
    u.uAmt.value = 1;
    u.uFlow.value = fr.motionOff ? 0 : fr.time;
    // 地平線高度
    const cam = world.camera;
    cam.getWorldDirection(_v);
    _v.y = 0;
    if (_v.lengthSq() < 1e-6) _v.set(0, 0, -1);
    _v.normalize().multiplyScalar(3000).add(cam.position);
    _v.y = 0;
    const okH = projBuf(_v, pa);
    u.uHorizonY.value = okH ? pa.y : bufH * 0.5;
    u.uRise.value = 0.16;
    // 有血的門：從上方分開繞過
    const doors = u.uDoors.value as { set: (x: number, y: number, z: number, w: number) => void }[];
    let n = 0;
    if (story.hyssop.done) {
      for (const h of world.houses) {
        if (n >= 10) break;
        const rigOn = h.decals[0].grow > 0.3;
        if (!rigOn) continue;
        _v.copy(h.door);
        if (!projBuf(_v, pa)) continue;
        _v.set(h.door.x + 0.95, h.door.y, h.door.z);
        projBuf(_v, pb);
        _v.set(h.door.x, h.door.y + 1.35, h.door.z);
        projBuf(_v, pc);
        const rx = Math.abs(pb.x - pa.x) * 1.15;
        const ry = Math.abs(pc.y - pa.y) * 0.95;
        if (pa.x + rx < -50 || pa.x - rx > bufW + 50) continue;
        doors[n].set(pa.x, pa.y, Math.max(rx, 6), Math.max(ry, 6));
        n++;
      }
    }
    u.uDoorN.value = n;
  };

  // ---------------------------------------------------------------- 迴圈
  const frame = (now: number) => {
    if (disposed) return;
    raf = requestAnimationFrame(frame);
    if (document.hidden) return;
    const t0 = bench ? performance.now() : 0;
    const dt = clamp((now - last) / 1000, 0, 0.1);
    last = now;
    fr.dt = dt;
    fr.time += dt;
    fr.motionOff = story.motionOff;
    darkF += ((story.dark ? 1 : 0) - darkF) * (1 - Math.exp(-dt * 9));
    if (Math.abs(darkF - (story.dark ? 1 : 0)) < 0.002) darkF = story.dark ? 1 : 0;
    fr.dark = darkF;

    const ci = CUE_IDX[story.cue];
    if (ci !== undefined) lastIdx = ci;
    fr.idx = lastIdx;
    fr.s = lastIdx + clamp(story.beatProgress, 0, 1);

    if (foldF !== foldT) {
      foldF = fr.motionOff ? foldT : foldF + (foldT - foldF) * (1 - Math.exp(-dt * 5.5));
      if (Math.abs(foldF - foldT) < 0.002) foldF = foldT;
    }
    fr.fold = foldF;

    const hasPanel = findPanel(fr.s);
    const busy = world.busy || hyssop.busy || wave.busy || SUMMER.busy || REST.busy || vortex.busy || foldF !== foldT;
    const hm = story.hyssop.marks;
    sig[0] = fr.s;
    sig[1] = story.day;
    sig[2] = darkF;
    sig[3] = W;
    sig[4] = H;
    sig[5] = bufW;
    sig[6] = (hm.lintel ? 1 : 0) + (hm.left ? 2 : 0) + (hm.right ? 4 : 0) + (story.hyssop.done ? 8 : 0);
    sig[7] = hasPanel ? panelBox.x : -1;
    sig[8] = panelBox.y;
    sig[9] = panelBox.w;
    sig[10] = panelBox.h;
    sig[11] = story.bake.progress;
    sig[12] = story.count;
    sig[13] = story.wave.swings + (story.wave.done ? 10 : 0);
    sig[14] = story.month;
    sig[15] = story.motionOff ? 1 : 0;
    sig[16] = story.blow.level;
    sig[17] = story.blow.holding ? 1 : 0;
    sig[18] = story.later ? 1 : 0;
    sig[19] = foldF;
    let same = true;
    for (let i = 0; i < 20; i++) {
      if (sig[i] !== lastSig[i]) {
        same = false;
        lastSig[i] = sig[i];
      }
    }
    if (fr.motionOff && !busy && !dirty && same) return;
    dirty = false;

    stepSummer(fr.s, dt);
    stepRest(fr.s, dt);
    sampleTracks(fr.s, tracks, W <= 720);
    if (camOverride) for (let i = 0; i < 8; i++) tracks.cam[i] = camOverride[i];
    U.uDark.value = darkF;
    U.uTime.value = fr.time;
    if (!fr.motionOff) U.uAnim.value += dt;
    const pk = paletteAt(fr.s);
    setLook(pals[pk.a], pals[pk.b], pk.k, darkF);
    world.updateScene(fr, tracks, W, H, hasPanel ? panelBox : null);
    world.updateObjects(fr);
    // 漩渦：coda 時要收進開場的那一彎月，所以把月亮的螢幕位置（CSS px）傳進去
    let moonX = W * 0.5;
    let moonY = H * 0.3;
    if (inCoda(fr.s) && projBuf(world.moon.position, pa)) {
      moonX = pa.x / (bufW / W);
      moonY = (bufH - pa.y) / (bufH / H);
    }
    vortex.update(fr.s, W, H, bufW / Math.max(W, 1), W <= 720, darkF, 1 - tracks.sky[2], moonX, moonY, dt);
    hyssop.update(dt, fr.s, fr.idx);
    wave.update(dt, fr.s, fr.idx, fr.time, !fr.motionOff);
    updateDarkness(fr.s);
    wMat.uniforms.uWipe.value = wipeAmt(fr.s);
    wipe.visible = wMat.uniforms.uWipe.value > 0.002;
    gMat.uniforms.uJitter.value = fr.motionOff ? 0 : fr.time;

    // 主場景
    let q: WebGLQuery | null = null;
    if (bench && timerExt) {
      while (pendingQ.length && gl2.getQueryParameter(pendingQ[0], gl2.QUERY_RESULT_AVAILABLE)) {
        const old = pendingQ.shift()!;
        if (!gl2.getParameter(timerExt.GPU_DISJOINT_EXT)) {
          const ms = (gl2.getQueryParameter(old, gl2.QUERY_RESULT) as number) / 1e6;
          gpuMs = gpuMs < 0 ? ms : gpuMs * 0.9 + ms * 0.1;
        }
        gl2.deleteQuery(old);
      }
      q = gl2.createQuery();
      gl2.beginQuery(timerExt.TIME_ELAPSED_EXT, q);
    }
    renderer.info.reset();
    renderer.setScissorTest(false);
    renderer.setViewport(0, 0, W, H);
    U.uViewport.value.set(bufW, bufH);
    renderer.setClearColor(0x15130f, 1);
    const tjv = tjAmt(fr.s);
    const useTJ = tjv > 0.002;
    if (useTJ) {
      if (!tjRT) tjRT = new WebGLRenderTarget(bufW, bufH, { samples: 4 });
      if (tjRT.width !== bufW || tjRT.height !== bufH) tjRT.setSize(bufW, bufH);
      renderer.setRenderTarget(tjRT);
    }
    renderer.clear(true, true, true);
    renderer.render(world.scene, world.camera);
    if (useTJ) {
      renderer.setRenderTarget(null);
      renderer.setViewport(0, 0, W, H);
      renderer.clear(true, true, true);
      const tu = tMat.uniforms;
      tu.tScene.value = tjRT!.texture;
      tu.uTJ.value = tjv;
      tu.uDirT.value = TJ_DIR.dir;
      const dk = darkF;
      (tu.uPaperC.value as Vector3).set(laterPV.paper.x * (1 - dk * 0.82), laterPV.paper.y * (1 - dk * 0.82), laterPV.paper.z * (1 - dk * 0.82));
      (tu.uInkC.value as Vector3).copy(laterPV.ink).lerp(laterPV.glow, dk * 0.8);
      renderer.render(tjScene, ortho);
    }

    // meal 分格：同一個 renderer 以 scissor 畫在 DOM 矩形內
    if (hasPanel) {
      const dpr = bufW / W;
      interior.update(fr.time, fr.motionOff, panelBox.w / panelBox.h, clamp(fr.s - CUE_IDX['meal'], 0, 1));
      renderer.setViewport(panelBox.x, H - panelBox.y - panelBox.h, panelBox.w, panelBox.h);
      renderer.setScissor(panelBox.cx, H - panelBox.cy - panelBox.ch, panelBox.cw, panelBox.ch);
      renderer.setScissorTest(true);
      U.uViewport.value.set(panelBox.w * dpr, panelBox.h * dpr);
      renderer.clearDepth();
      renderer.render(interior.scene, interior.camera);
      renderer.setScissorTest(false);
      renderer.setViewport(0, 0, W, H);
      U.uViewport.value.set(bufW, bufH);
    }

    // 覆蓋層
    renderer.clearDepth();
    renderer.render(overlay, ortho);

    if (q) {
      gl2.endQuery(timerExt!.TIME_ELAPSED_EXT);
      pendingQ.push(q);
    }
    if (bench) {
      renderer.getContext().finish();
      benchMs = benchMs === 0 ? performance.now() - t0 : benchMs * 0.9 + (performance.now() - t0) * 0.1;
    }
    if (!readySent) {
      readySent = true;
      onEvent({ type: 'ready' });
    }
  };

  const onVis = () => {
    if (document.hidden) {
      cancelAnimationFrame(raf);
      raf = 0;
    } else if (!raf && !disposed) {
      last = performance.now();
      dirty = true;
      raf = requestAnimationFrame(frame);
    }
  };
  document.addEventListener('visibilitychange', onVis);
  const onLost = (e: Event) => {
    e.preventDefault();
    onEvent({ type: 'webgl-lost' });
  };
  canvas.addEventListener('webglcontextlost', onLost);
  // 拖曳牛膝草時要叫醒迴圈：motionOff 下閒置時會跳過整幀（連 hyssop.update 一起），
  // 而 hyssop.busy 只在 update 裡更新，不叫醒的話拖曳時草不會跟手、甩到門框停住也不算打到。
  const wake = () => {
    dirty = true;
  };
  for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const) canvas.addEventListener(t, wake);

  applySize();
  raf = requestAnimationFrame(frame);

  return {
    resize(w, h, dpr) {
      W = w;
      H = h;
      dprIn = dpr;
      applySize();
    },
    dispose() {
      disposed = true;
      cancelAnimationFrame(raf);
      foldObs.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      canvas.removeEventListener('webglcontextlost', onLost);
      for (const t of ['pointerdown', 'pointermove', 'pointerup', 'pointercancel'] as const) canvas.removeEventListener(t, wake);
      hyssop.dispose();
      wave.dispose();
      interior.dispose();
      tjRT?.dispose();
      world.dispose();
      disposeShared();
      renderer.dispose();
    },
    hyssopAction(a) {
      hyssop.hyssopAction(a);
      dirty = true;
    },
    waveAction() {
      wave.waveAction();
      dirty = true;
    },
    interactiveRects() {
      return story.cue === 'wave' ? wave.interactiveRects() : hyssop.interactiveRects();
    },
  };
};










