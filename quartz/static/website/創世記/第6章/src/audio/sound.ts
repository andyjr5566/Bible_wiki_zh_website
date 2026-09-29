import type { Frame } from '../three/engine';

/**
 * 環境音，全部用 Web Audio 當場合成，沒有音檔。預設靜音，使用者按了才開。
 * 雨、風、浪是濾過的雜訊；雷、木頭嘎吱、關門、火、鴿子是一次性的小事件。
 */
export function createSound() {
  let ctx: AudioContext | null = null;
  let master: GainNode;
  let on = false;
  const layers: Record<string, { gain: GainNode; filter?: BiquadFilterNode }> = {};
  let lastDoor = 0;
  let creakIn = 3;
  let cooIn = 2;
  let crackleIn = 0.2;
  let padNodes: { osc: OscillatorNode; g: GainNode }[] = [];
  let padFilter: BiquadFilterNode;

  function noiseBuffer(c: AudioContext, kind: 'white' | 'brown', secs = 4) {
    const b = c.createBuffer(1, c.sampleRate * secs, c.sampleRate);
    const d = b.getChannelData(0);
    let last = 0;
    for (let i = 0; i < d.length; i++) {
      const w = Math.random() * 2 - 1;
      if (kind === 'white') d[i] = w;
      else {
        last = (last + 0.02 * w) / 1.02;
        d[i] = last * 3.5;
      }
    }
    return b;
  }

  function loop(c: AudioContext, buf: AudioBuffer, type: BiquadFilterType, freq: number, q = 0.7) {
    const src = c.createBufferSource();
    src.buffer = buf;
    src.loop = true;
    const f = c.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = q;
    const g = c.createGain();
    g.gain.value = 0;
    src.connect(f).connect(g).connect(master);
    src.start(0, Math.random() * 3);
    return { gain: g, filter: f };
  }

  function init() {
    ctx = new AudioContext();
    master = ctx.createGain();
    master.gain.value = 0;
    const comp = ctx.createDynamicsCompressor();
    master.connect(comp).connect(ctx.destination);
    const white = noiseBuffer(ctx, 'white');
    const brown = noiseBuffer(ctx, 'brown', 6);
    layers.wind = loop(ctx, brown, 'lowpass', 500);
    layers.rain = loop(ctx, white, 'bandpass', 2600, 0.4);
    layers.roof = loop(ctx, brown, 'lowpass', 900);
    layers.sea = loop(ctx, brown, 'lowpass', 320);
    // 背景和聲：很輕，隨場景換調
    padFilter = ctx.createBiquadFilter();
    padFilter.type = 'lowpass';
    padFilter.frequency.value = 900;
    const padOut = ctx.createGain();
    padOut.gain.value = 0.05;
    padFilter.connect(padOut).connect(master);
    padNodes = [0, 1, 2, 3].map(() => {
      const osc = ctx!.createOscillator();
      osc.type = 'sine';
      const g = ctx!.createGain();
      g.gain.value = 0.25;
      osc.connect(g).connect(padFilter);
      osc.start();
      return { osc, g };
    });
  }

  const set = (p: AudioParam, v: number, tc = 0.6) => ctx && p.setTargetAtTime(v, ctx.currentTime, tc);

  function burst(opts: { dur: number; freq: number; type: BiquadFilterType; q?: number; gain: number; delay?: number; glide?: number }) {
    if (!ctx) return;
    const t0 = ctx.currentTime + (opts.delay ?? 0);
    const src = ctx.createBufferSource();
    src.buffer = noiseBuffer(ctx, 'brown', Math.ceil(opts.dur + 0.5));
    const f = ctx.createBiquadFilter();
    f.type = opts.type;
    f.frequency.setValueAtTime(opts.freq, t0);
    if (opts.glide) f.frequency.exponentialRampToValueAtTime(opts.glide, t0 + opts.dur);
    f.Q.value = opts.q ?? 0.8;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(opts.gain, t0 + Math.min(0.08, opts.dur * 0.1));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + opts.dur);
    src.connect(f).connect(g).connect(master);
    src.start(t0);
    src.stop(t0 + opts.dur + 0.1);
  }

  function tone(freq: number, dur: number, gain: number, glideTo?: number, delay = 0, type: OscillatorType = 'sine') {
    if (!ctx) return;
    const t0 = ctx.currentTime + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, t0);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, t0 + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(gain, t0 + dur * 0.25);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + dur);
    o.connect(g).connect(master);
    o.start(t0);
    o.stop(t0 + dur + 0.05);
  }

  // 和弦：平靜（大三）、暴風（低沉小調）、彩虹（明亮）
  const CHORDS = {
    calm: [110, 164.8, 220, 277.2],
    storm: [55, 82.4, 130.8, 110],
    bright: [130.8, 196, 261.6, 329.6],
  };

  return {
    get on() {
      return on;
    },
    async toggle() {
      if (!ctx) init();
      on = !on;
      if (on) await ctx!.resume();
      set(master.gain, on ? 0.9 : 0, 0.3);
      return on;
    },
    thunder(distance: number) {
      if (!ctx || !on) return;
      const near = Math.max(0, 1 - distance / 2600);
      // 光速和音速差：遠的雷晚一點才到（這裡縮短了，免得等太久）
      burst({ dur: 3 + near * 2, freq: 90 + near * 260, glide: 60, type: 'lowpass', gain: 0.35 + near * 0.5, delay: distance / 900 });
      burst({ dur: 0.6, freq: 1400, type: 'bandpass', gain: 0.1 * near, delay: distance / 900 });
    },
    update(fr: Frame, dt: number) {
      if (!ctx || !on) return;
      const L = fr.look;
      const inside = fr.inside;
      set(layers.rain.gain.gain, L.rain * (inside ? 0.12 : 0.34));
      set(layers.rain.filter!.frequency, inside ? 900 : 2600);
      set(layers.roof.gain.gain, L.rain * (inside ? 0.5 : 0));
      set(layers.wind.gain.gain, 0.05 + L.storm * 0.3 + L.cloud * 0.03);
      set(layers.wind.filter!.frequency, 300 + L.storm * 500 + Math.sin(performance.now() / 2300) * 120);
      const seaLvl = L.water > -5 ? Math.min(1, 0.15 + L.waves) * (0.12 + 0.2 * fr.floating) : 0;
      set(layers.sea.gain.gain, seaLvl * (0.8 + 0.4 * Math.sin(performance.now() / 1700)));

      // 背景和聲
      const chord = L.storm > 0.5 ? CHORDS.storm : L.bow > 0.3 ? CHORDS.bright : CHORDS.calm;
      padNodes.forEach((n, i) => set(n.osc.frequency, chord[i] * (1 + (i % 2 ? 0.003 : -0.002)), 1.5));
      set(padFilter.frequency, 500 + (1 - L.storm) * 700 + L.bow * 600, 1.2);

      // 關門：由開到關的那一刻
      if (L.door > 0.96 && lastDoor <= 0.96 && L.water < 0) {
        tone(52, 1.2, 0.5, 38);
        burst({ dur: 0.5, freq: 400, type: 'lowpass', gain: 0.4 });
      }
      lastDoor = L.door;

      // 漂浮時木頭嘎吱
      if (fr.floating > 0.5) {
        creakIn -= dt;
        if (creakIn <= 0) {
          creakIn = 2 + Math.random() * 4;
          const f0 = 180 + Math.random() * 160;
          burst({ dur: 0.7 + Math.random() * 0.6, freq: f0, glide: f0 * 0.7, type: 'bandpass', q: 14, gain: inside ? 0.5 : 0.18 });
        }
      }
      // 祭壇的火
      if (L.altar > 0.5) {
        crackleIn -= dt;
        if (crackleIn <= 0) {
          crackleIn = 0.05 + Math.random() * 0.25;
          burst({ dur: 0.05 + Math.random() * 0.06, freq: 2500 + Math.random() * 2500, type: 'highpass', gain: 0.05 + Math.random() * 0.08 });
        }
      }
      // 鴿子
      if (L.birds > 0.3 && L.birds < 0.95) {
        cooIn -= dt;
        if (cooIn <= 0) {
          cooIn = 3 + Math.random() * 4;
          tone(420, 0.35, 0.05, 380, 0);
          tone(470, 0.6, 0.06, 400, 0.4);
          tone(400, 0.4, 0.04, 360, 1.05);
        }
      }
    },
  };
}
export type Sound = ReturnType<typeof createSound>;
