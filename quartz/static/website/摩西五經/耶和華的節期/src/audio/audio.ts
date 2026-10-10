/**
 * 聲音：預設開（ui/chrome.ts 在讀者第一次點擊、觸控或按鍵時才呼叫 setEnabled，瀏覽器規定）；那時才建立 <audio> 元素（不用 Web Audio，file:// 也能播）。
 * - 環境音（night-wind、depart、fire、field-wind）用 requestAnimationFrame 淡入淡出。
 * - 單次音效（lamb、dip、strike、door）直接播放；wailing 進入時淡入、離開時淡出。
 * - fire（烤餅那一拍 loop）、field-wind（8 秒一陣風，每搖一下播一次，同時最多兩陣）、harvest（單次，barley-ripe 與 rejoice 那兩拍）。
 * - 秋季：desert-wind（scapegoat 那一拍 loop）、branches（branches 拍進入時一次；booth、echo-roofs 拍隨拍內進度每過 0.2 一次）。
 * - 背景音樂（music）：聲音開著就一直 loop，音量壓在環境音底下；wailing 那一拍與按住「吹」時讓開（降到三成多）。
 * - 吹角（blow）不是檔案：用 WebAudio 合成，見檔尾的 createBlowVoice。受聲音開關控制；動態開關不影響。
 * - 檔案載入或播放失敗、或 audio-sources.yaml 還沒登記的音檔，一律安靜略過。
 * 音檔清單與授權在 data/audio-sources.yaml，授權頁由 src/ui/ending.ts 列出。
 */
import type { AudioSource } from '../data/types';
import type { SceneEvent } from '../scene/api';

interface Track {
  id: string;
  file: string;
  loop: boolean;
  /** 這個音檔的最大音量（0–1） */
  max: number;
  /** 淡入、淡出各要幾秒（從 0 到 max） */
  fadeIn: number;
  fadeOut: number;
  el: HTMLAudioElement | null;
  vol: number;
  want: number;
  /** 在手勢內解鎖過（iOS／Safari 要求每個元素都先在讀者操作時播過一次） */
  ready: boolean;
  failed: boolean;
}

const SPEC: Record<string, Pick<Track, 'max' | 'fadeIn' | 'fadeOut'>> = {
  'night-wind': { max: 0.5, fadeIn: 2.2, fadeOut: 1.6 },
  depart: { max: 0.55, fadeIn: 1.8, fadeOut: 1.8 },
  wailing: { max: 0.7, fadeIn: 0.9, fadeOut: 1.4 },
  lamb: { max: 0.9, fadeIn: 0.05, fadeOut: 0.8 },
  dip: { max: 0.9, fadeIn: 0.02, fadeOut: 0.3 },
  strike: { max: 0.95, fadeIn: 0.02, fadeOut: 0.3 },
  door: { max: 0.9, fadeIn: 0.02, fadeOut: 0.6 },
  fire: { max: 0.5, fadeIn: 1.2, fadeOut: 1.4 },
  'field-wind': { max: 0.45, fadeIn: 1.6, fadeOut: 1.6 },
  harvest: { max: 0.5, fadeIn: 1.4, fadeOut: 1.8 },
  'desert-wind': { max: 0.5, fadeIn: 2, fadeOut: 1.6 },
  branches: { max: 0.7, fadeIn: 0.05, fadeOut: 0.6 },
  music: { max: 0.4, fadeIn: 4, fadeOut: 2.5 },
};

/** 背景音樂讓開時的倍數 */
const MUSIC_DUCK = 0.35;

/** 每過拍內進度 0.2 觸發一次樹枝沙沙聲的拍 */
const RUSTLE_STEP = 0.2;
const RUSTLE_CUES = new Set(['booth', 'echo-roofs']);

/** field-wind 每搖一下播一陣，同時最多這麼多陣 */
const MAX_GUSTS = 2;

export interface AudioController {
  readonly enabled: boolean;
  setEnabled(on: boolean): void;
  /** 目前所在的拍改變時呼叫 */
  onBeat(index: number): void;
  onSceneEvent(e: SceneEvent): void;
  /** 每幀呼叫：目前拍的 cue 與拍內進度。booth、echo-roofs 每過 0.2 響一次樹枝聲 */
  onProgress(cue: string, progress: number): void;
  /**
   * 吹角：holding 為按住中、level 為 0–1。按下的那一刻（手勢內）就要呼叫一次，才能建立 AudioContext。
   * 聲音關著、或瀏覽器沒有 WebAudio 時什麼都不做。
   */
  blow(holding: boolean, level: number): void;
  onChange(cb: (enabled: boolean) => void): void;
}

export function createAudio(sources: AudioSource[], cues: string[], hasScene: () => boolean): AudioController {
  const tracks = new Map<string, Track>();
  for (const s of sources) {
    const spec = SPEC[s.id] ?? { max: 0.7, fadeIn: 1, fadeOut: 1 };
    tracks.set(s.id, { id: s.id, file: s.file, loop: !!s.loop, ...spec, el: null, vol: 0, want: 0, ready: false, failed: false });
  }
  const listeners: ((on: boolean) => void)[] = [];
  let enabled = false;
  let beat = 0;
  let raf = 0;
  let last = 0;
  const gusts: HTMLAudioElement[] = [];
  const blowVoice = createBlowVoice(() => enabled);
  let rustleStep = -1;
  let blowing = false;

  const idxOf = (cue: string) => cues.indexOf(cue);

  function make(t: Track) {
    if (t.el || t.failed) return;
    const el = new Audio();
    el.preload = 'auto';
    el.loop = t.loop;
    el.addEventListener('error', () => {
      t.failed = true;
    });
    el.src = `./audio/${t.file}`;
    t.el = el;
    // 在讀者按下開關的手勢裡先靜音播一下再停，之後才能由捲動自動播放
    el.muted = true;
    const p = el.play();
    const done = () => {
      try {
        el.pause();
        el.currentTime = 0;
      } catch {
        /* 略過 */
      }
      el.muted = false;
      t.ready = true;
      reapply();
    };
    if (p && typeof p.then === 'function') p.then(done, () => {
      el.muted = false;
      t.ready = true;
      reapply();
    });
    else done();
  }

  function play(t: Track, force = false) {
    const el = t.el;
    if (!el || !t.ready || t.failed || !el.paused) return;
    // 播完的單次音效不因為重新判斷而再播一次
    if (!t.loop && el.ended && !force) return;
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(() => undefined);
  }

  function frame(now: number) {
    raf = 0;
    const dt = Math.min(0.1, Math.max(0, (now - last) / 1000));
    last = now;
    let busy = false;
    for (const t of tracks.values()) {
      const el = t.el;
      if (!el) continue;
      if (t.vol !== t.want) {
        const rate = (t.want > t.vol ? 1 / t.fadeIn : 1 / t.fadeOut) * t.max;
        t.vol = t.want > t.vol ? Math.min(t.want, t.vol + rate * dt) : Math.max(t.want, t.vol - rate * dt);
        el.volume = Math.min(1, Math.max(0, t.vol));
        busy = true;
      }
      if (t.want === 0 && t.vol === 0 && !el.paused) el.pause();
    }
    if (busy) raf = requestAnimationFrame(frame);
  }

  function kick() {
    if (!raf) {
      last = performance.now();
      raf = requestAnimationFrame(frame);
    }
  }

  /** 設定某個音檔的目標音量並確保它在播（want > 0）或淡出後停（want = 0） */
  function setWant(id: string, want: number, restart = false) {
    const t = tracks.get(id);
    if (!t || !enabled) return;
    if (!t.el) make(t);
    if (!t.el || t.failed) return;
    t.want = want;
    if (want > 0) {
      if (restart) {
        try {
          t.el.currentTime = 0;
        } catch {
          /* 還沒載入完：從頭開始播即可 */
        }
      }
      play(t, restart);
    }
    kick();
  }

  /** 照目前所在的拍，重新決定環境音與 wailing 該不該響 */
  function reapply() {
    if (!enabled || document.hidden) return;
    const cue = cues[beat];
    const mid = idxOf('midnight');
    const dep = idxOf('depart');
    const vig = idxOf('vigil');
    setWant('night-wind', mid < 0 || beat < mid ? SPEC['night-wind'].max : 0);
    setWant('depart', dep >= 0 && beat >= dep && beat <= (vig < 0 ? dep : vig) ? SPEC.depart.max : 0);
    setWant('wailing', cue === 'wailing' ? SPEC.wailing.max : 0);
    setWant('fire', cue === 'bake' ? SPEC.fire.max : 0);
    setWant('harvest', cue === 'rejoice' || cue === 'barley-ripe' ? SPEC.harvest.max : 0);
    setWant('desert-wind', cue === 'scapegoat' || cue === 'echo-land-rest' ? SPEC['desert-wind'].max : 0);
    setWant('music', SPEC.music.max * (cue === 'wailing' || blowing ? MUSIC_DUCK : 1));
  }

  function fire(id: string) {
    const t = tracks.get(id);
    if (!t || !enabled) return;
    if (!t.el) make(t);
    if (!t.el || t.failed) return;
    t.vol = t.want = t.max;
    t.el.volume = t.max;
    try {
      t.el.currentTime = 0;
    } catch {
      /* 略過 */
    }
    play(t, true);
  }

  /** 搖一下放一陣風：每陣用自己的元素，同時最多 MAX_GUSTS 陣，滿了這一下就不再疊 */
  function gust() {
    const t = tracks.get('field-wind');
    if (!t || !enabled || t.failed) return;
    for (let i = gusts.length - 1; i >= 0; i--) if (gusts[i].ended || gusts[i].paused) gusts.splice(i, 1);
    if (gusts.length >= MAX_GUSTS) return;
    const el = new Audio(`./audio/${t.file}`);
    el.volume = t.max;
    el.addEventListener('error', () => {
      t.failed = true;
    });
    const drop = () => {
      const k = gusts.indexOf(el);
      if (k >= 0) gusts.splice(k, 1);
    };
    el.addEventListener('ended', drop);
    gusts.push(el);
    const p = el.play();
    if (p && typeof p.catch === 'function') p.catch(drop);
  }

  document.addEventListener('visibilitychange', () => {
    if (document.hidden) {
      for (const t of tracks.values()) t.el?.pause();
      for (const g of gusts) g.pause();
    } else {
      reapply();
    }
  });

  return {
    get enabled() {
      return enabled;
    },
    setEnabled(on: boolean) {
      if (on === enabled) return;
      enabled = on;
      if (on) {
        for (const t of tracks.values()) make(t);
        reapply();
      } else {
        for (const t of tracks.values()) {
          t.want = 0;
          t.vol = 0;
          t.el?.pause();
        }
        for (const g of gusts) g.pause();
        gusts.length = 0;
        blowVoice.stop();
      }
      for (const cb of listeners) cb(enabled);
    },
    onBeat(index: number) {
      const prev = cues[beat];
      beat = index;
      const cue = cues[index];
      if (cue !== prev) rustleStep = -1; // 進入新的一拍：第一次 onProgress 只記下所在的位置，不響
      if (!enabled) return;
      if (cue !== prev) {
        if (cue === 'day-10') {
          setWant('lamb', SPEC.lamb.max, true);
        }
        // 場景載不進來時沒有 door-shut 事件，改在進入那一拍時播關門聲
        if (cue === 'door-shut' && !hasScene()) fire('door');
        if (cue === 'wailing') {
          setWant('wailing', SPEC.wailing.max, true);
        }
        if (prev === 'day-10') setWant('lamb', 0);
        if (cue === 'rejoice' || cue === 'barley-ripe') setWant('harvest', SPEC.harvest.max, true);
        if (cue === 'branches') fire('branches');
      }
      reapply();
    },
    onSceneEvent(e: SceneEvent) {
      if (e.type === 'hyssop-dip') fire('dip');
      else if (e.type === 'hyssop-strike') fire('strike');
      else if (e.type === 'door-shut') fire('door');
      else if (e.type === 'wave-swing') gust();
    },
    onProgress(cue: string, progress: number) {
      if (!RUSTLE_CUES.has(cue)) return;
      const step = Math.min(5, Math.floor(progress / RUSTLE_STEP));
      // 往回捲不響；往前每跨過一個 0.2 響一次。進入這一拍時所在的位置不算
      if (rustleStep >= 0 && step > rustleStep && enabled && !document.hidden) fire('branches');
      rustleStep = step;
    },
    blow(holding: boolean, level: number) {
      blowVoice.update(holding, level);
      if (holding !== blowing) {
        blowing = holding;
        reapply();
      }
    },
    onChange(cb) {
      listeners.push(cb);
    },
  };
}

// ---------------------------------------------------------------------------
// 吹角：WebAudio 合成（不用錄音檔，也不假裝是哪一種樂器——經文只說 teruah，響亮的聲音）。
// 約 233 Hz 的基音，兩個略微失諧的振盪器（波形含二、三次泛音），低通約 1.8 kHz；
// 起音時音高從低一個半音在 150 ms 內滑上來；疊一層 10% 的帶通噪聲當氣息；
// 音量跟著 level，放開後 300 ms 收尾。
// ---------------------------------------------------------------------------

const BLOW_F0 = 233.08; // B♭3
const BLOW_GAIN = 0.3;
const BLOW_RELEASE = 0.3; // 秒

interface Voice {
  master: GainNode;
  oscs: OscillatorNode[];
  noise: AudioBufferSourceNode;
  released: boolean;
}

function createBlowVoice(isEnabled: () => boolean) {
  let ctx: AudioContext | null = null;
  let voice: Voice | null = null;
  let wave: PeriodicWave | null = null;
  let noiseBuf: AudioBuffer | null = null;
  let unavailable = false;

  function ensureCtx(): AudioContext | null {
    if (unavailable) return null;
    if (!ctx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) {
        unavailable = true;
        return null;
      }
      try {
        ctx = new Ctor();
      } catch {
        unavailable = true;
        return null;
      }
    }
    if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
    return ctx;
  }

  function start(c: AudioContext): Voice {
    // 基音 1、二次 0.42、三次 0.26、四次 0.1：偏圓潤的銅管感，不是鋸齒波的刺
    if (!wave) wave = c.createPeriodicWave(new Float32Array([0, 0, 0, 0, 0]), new Float32Array([0, 1, 0.42, 0.26, 0.1]));
    if (!noiseBuf) {
      noiseBuf = c.createBuffer(1, c.sampleRate, c.sampleRate);
      const d = noiseBuf.getChannelData(0);
      for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
    }
    const now = c.currentTime;
    const master = c.createGain();
    master.gain.value = 0;
    const low = c.createBiquadFilter();
    low.type = 'lowpass';
    low.frequency.value = 1800;
    low.Q.value = 0.7;
    low.connect(master);
    master.connect(c.destination);

    const oscs = [-6, 6].map((cents) => {
      const o = c.createOscillator();
      o.setPeriodicWave(wave!);
      o.detune.value = cents;
      // 起音：從低一個半音，150 ms 內滑上來
      o.frequency.setValueAtTime(BLOW_F0 / 2 ** (1 / 12), now);
      o.frequency.exponentialRampToValueAtTime(BLOW_F0, now + 0.15);
      const g = c.createGain();
      g.gain.value = 0.45;
      o.connect(g);
      g.connect(low);
      o.start(now);
      return o;
    });

    // 氣息：10% 的帶通噪聲
    const noise = c.createBufferSource();
    noise.buffer = noiseBuf;
    noise.loop = true;
    const band = c.createBiquadFilter();
    band.type = 'bandpass';
    band.frequency.value = 900;
    band.Q.value = 0.9;
    const ng = c.createGain();
    ng.gain.value = 0.1;
    noise.connect(band);
    band.connect(ng);
    ng.connect(master);
    noise.start(now);
    return { master, oscs, noise, released: false };
  }

  function end(v: Voice, c: AudioContext) {
    const now = c.currentTime;
    v.master.gain.cancelScheduledValues(now);
    v.master.gain.setValueAtTime(v.master.gain.value, now);
    v.master.gain.linearRampToValueAtTime(0, now + BLOW_RELEASE);
    v.released = true;
    const stopAt = now + BLOW_RELEASE + 0.05;
    for (const o of v.oscs) o.stop(stopAt);
    v.noise.stop(stopAt);
  }

  const api = {
    update(holding: boolean, level: number) {
      if (!isEnabled()) {
        api.stop();
        return;
      }
      if (holding) {
        const c = ensureCtx();
        if (!c) return;
        if (!voice || voice.released) voice = start(c);
        // 音量跟著 level；短的平滑避免每幀階梯
        voice.master.gain.setTargetAtTime(BLOW_GAIN * Math.max(0.05, level), c.currentTime, 0.03);
      } else if (voice && !voice.released && ctx) {
        end(voice, ctx);
      }
    },
    stop() {
      if (voice && !voice.released && ctx) end(voice, ctx);
    },
  };
  return api;
}
