/**
 * 吹角的介面層：圓形大按鈕「吹」（規格同 bake 的長按）。
 * - 滑鼠、觸控按住，或鍵盤按住空白鍵／Enter 都算；放開就停。
 * - 按住時 story.blow.level 在 1.2 秒內從 0 升到 1；放開後 0.6 秒內回落到 0。
 * - level 第一次到 1：blasts += 1、done = true。放開再按，再到 1 又算一聲（按鈕不會鎖死，讀者可以多吹幾次）。
 * - 讀者捲過這一拍還沒做：auto = true、done = true（sync）。不補畫聲波（level 維持 0）。
 * - 讀者觸發的動作：動態開關不影響，照常播放。
 * - 迴圈只在按住或 level > 0 時跑；pointerdown／keydown 會叫醒它；dt 夾在 0–0.1。
 * - 聲音由 audio.blow 合成（WebAudio），受聲音開關控制；沒有場景時也能用（只改 story 狀態與聲音）。
 * - 有兩拍 blow（吹角節、七的節奏的禧年角聲）：各拍的 blasts／done／auto 分開記。
 *   story.blow 是「目前所在那一拍」的工作副本（場景與驗收腳本讀它）：換拍時把舊的存回、讀進新的；
 *   level／holding 是即時的按鈕狀態，兩拍共用（同一時間只會按一顆）。
 */
import { SITE } from '../data/site';
import { story } from '../story/state';
import { clamp, h } from './dom';
import { makeFold } from './fold';

const RISE = 1 / 1.2; // 每秒
const FALL = 1 / 0.6; // 每秒
/** 吹滿一聲之後，level 要先落到這個值以下，再吹滿才算下一聲 */
const REARM = 0.2;

export interface BlowUI {
  /** beatId：這顆按鈕屬於哪一拍（各拍的狀態分開記） */
  controls(prompt: string, beatId: string): HTMLElement;
  /** 目前所在的拍（整份故事裡的序號）改變時呼叫：切換工作副本、捲過去沒做就補完 */
  sync(index: number): void;
}

interface Rec {
  blasts: number;
  done: boolean;
  auto: boolean;
}
interface Ctl {
  id: string;
  btn: HTMLButtonElement;
  status: HTMLElement;
  lastSig: string;
}

export function createBlowUI(onVoice: (holding: boolean, level: number) => void): BlowUI {
  /** 每一拍 blow 的序號（整份故事裡的第幾拍）與 id，照故事順序 */
  const blowBeats = SITE.chapters.flatMap((c) => c.beats).flatMap((b, i) => (b.interaction === 'blow' ? [{ id: b.id, index: i }] : []));
  const recs = new Map<string, Rec>(blowBeats.map((b) => [b.id, { blasts: 0, done: false, auto: false }]));
  /** story.blow 現在是哪一拍的工作副本 */
  let active = blowBeats[0]?.id ?? '';
  const held = new Set<string>();
  const ctls = new Map<string, Ctl>();
  let raf = 0;
  let last = 0;
  let armed = true;

  /** 這一拍的紀錄：目前那一拍用 story.blow，其他拍用存起來的 */
  const recOf = (id: string): Rec => (id === active ? story.blow : recs.get(id)!);

  function activate(id: string) {
    if (id === active || !recs.has(id)) return;
    const { blasts, done, auto } = story.blow;
    recs.set(active, { blasts, done, auto });
    const next = recs.get(id)!;
    story.blow.blasts = next.blasts;
    story.blow.done = next.done;
    story.blow.auto = next.auto;
    active = id;
  }

  function statusText(id: string): string {
    const r = recOf(id);
    if (r.auto && r.blasts === 0) return '已替你吹過';
    if (r.blasts > 0) return r.blasts === 1 ? '吹了一聲' : `吹了 ${r.blasts} 聲`;
    return id === active && story.blow.holding ? '吹著' : '還沒有吹';
  }

  function render() {
    const b = story.blow;
    for (const c of ctls.values()) {
      const on = c.id === active;
      const r = recOf(c.id);
      const sig = `${on ? Math.round(b.level * 200) : 0}|${r.done}|${r.auto}|${r.blasts}|${on && b.holding}`;
      if (sig === c.lastSig) continue;
      c.lastSig = sig;
      c.btn.style.setProperty('--p', (on ? b.level : 0).toFixed(3));
      c.btn.classList.toggle('is-held', on && b.holding);
      c.status.textContent = statusText(c.id);
    }
  }

  function step(now: number) {
    raf = 0;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    const b = story.blow;
    b.holding = held.size > 0;
    if (b.holding) {
      b.level = clamp(b.level + RISE * dt);
      if (b.level >= 1 && armed) {
        armed = false;
        b.blasts += 1;
        b.done = true;
      }
    } else {
      b.level = clamp(b.level - FALL * dt);
      if (b.level <= REARM) armed = true;
    }
    onVoice(b.holding, b.level);
    render();
    if (b.holding || b.level > 0) raf = requestAnimationFrame(step);
  }

  function wake() {
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(step);
    }
  }

  function press(id: string, src: string) {
    activate(id);
    held.add(src);
    story.blow.holding = true;
    // 在按下的手勢裡先呼叫一次，WebAudio 才能建立／恢復 AudioContext
    onVoice(true, story.blow.level);
    wake();
    render();
  }
  function release(src: string) {
    if (!held.delete(src)) return;
    if (!held.size) story.blow.holding = false;
    wake();
    render();
  }

  function controls(prompt: string, beatId: string): HTMLElement {
    const promptId = `jf-blow-prompt-${beatId}`;
    const button = h('button', { type: 'button', class: 'jf-bake-btn jf-blow-btn', 'aria-describedby': promptId },
      h('span', { class: 'jf-bake-label' }, '吹'));
    button.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      e.preventDefault();
      try {
        button.setPointerCapture(e.pointerId);
      } catch {
        /* 沒有 capture 也照常 */
      }
      press(beatId, `p${e.pointerId}`);
    });
    const up = (e: PointerEvent) => release(`p${e.pointerId}`);
    button.addEventListener('pointerup', up);
    button.addEventListener('pointercancel', up);
    button.addEventListener('lostpointercapture', up);
    button.addEventListener('contextmenu', (e) => e.preventDefault());
    button.addEventListener('keydown', (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      if (!e.repeat) press(beatId, 'key');
    });
    button.addEventListener('keyup', (e) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      release('key');
    });
    button.addEventListener('blur', () => release('key'));

    const status = h('p', { class: 'jf-bake-status jf-blow-status', role: 'status', 'aria-live': 'polite' });
    ctls.set(beatId, { id: beatId, btn: button, status, lastSig: '' });
    render();
    return h('div', { class: 'jf-interact jf-bake jf-blow', 'data-blow': beatId },
      h('div', { class: 'jf-bake-row' },
        button,
        h('div', { class: 'jf-bake-side' },
          h('p', { class: 'jf-prompt', id: promptId }, prompt),
          h('div', { class: 'jf-status-row' }, status, makeFold()))));
  }

  function sync(index: number) {
    if (!blowBeats.length) return;
    // 工作副本跟著目前所在的拍：最近一個「序號 ≤ 目前」的 blow 拍；還沒走到第一個就留在第一個
    let cur = blowBeats[0];
    for (const b of blowBeats) if (b.index <= index) cur = b;
    activate(cur.id);
    // 已經走過、還沒做的 blow 拍：記一筆已完成，不補畫聲波（level 維持 0）
    for (const b of blowBeats) {
      if (index <= b.index) continue;
      const r = recOf(b.id);
      if (r.done) continue;
      r.done = true;
      r.auto = true;
      if (b.id === active) {
        held.clear();
        story.blow.holding = false;
      }
    }
    render();
  }

  return { controls, sync };
}
