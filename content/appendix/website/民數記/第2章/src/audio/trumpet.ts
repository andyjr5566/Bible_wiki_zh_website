import type { SignalId } from '../data/trumpets';

/**
 * 銀號的聲音，用 Web Audio 即時合成，不載入任何音檔。預設靜音，使用者按了聲音開關才會出聲。
 * 經文只記了「吹」、「吹出大聲」、「二次吹出大聲」，沒有音高與節奏。這裡的長聲與短促聲
 * 借用 BH 對 tekiah（長聲）與 teruah（短促聲）的區分，音高與節奏都是示意。
 */
let ctx: AudioContext | null = null;
let master: GainNode | null = null;

function audio(): { ctx: AudioContext; out: GainNode } | null {
  try {
    if (!ctx) {
      const AC = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.55;
      master.connect(ctx.destination);
    }
    if (ctx.state === 'suspended') void ctx.resume();
    return { ctx, out: master! };
  } catch {
    return null;
  }
}

function note(a: { ctx: AudioContext; out: GainNode }, freq: number, at: number, dur: number, vol = 0.16) {
  const { ctx: c, out } = a;
  const g = c.createGain();
  const f = c.createBiquadFilter();
  f.type = 'lowpass';
  f.Q.value = 2;
  f.frequency.setValueAtTime(700, at);
  f.frequency.linearRampToValueAtTime(3400, at + 0.05);
  f.frequency.linearRampToValueAtTime(1900, at + dur);
  g.gain.setValueAtTime(0, at);
  g.gain.linearRampToValueAtTime(vol, at + 0.035);
  g.gain.setValueAtTime(vol, Math.max(at + 0.04, at + dur - 0.09));
  g.gain.linearRampToValueAtTime(0, at + dur);
  for (const [type, mult] of [['sawtooth', 1], ['square', 1.004]] as const) {
    const o = c.createOscillator();
    o.type = type;
    o.frequency.value = freq * mult;
    // 微微的顫音
    const lfo = c.createOscillator();
    const lg = c.createGain();
    lfo.frequency.value = 5.2;
    lg.gain.value = freq * 0.006;
    lfo.connect(lg).connect(o.frequency);
    o.connect(f);
    lfo.start(at);
    o.start(at);
    o.stop(at + dur + 0.05);
    lfo.stop(at + dur + 0.05);
  }
  f.connect(g).connect(out);
}

const C5 = 523.25;
const E5 = 659.25;
const G4 = 392;

/** 短促聲（teruah）：一串急促的音 */
function alarm(a: { ctx: AudioContext; out: GainNode }, at: number): number {
  const notes = [C5, E5, C5, E5, C5, E5, C5];
  notes.forEach((f, i) => note(a, f, at + i * 0.13, 0.11));
  return notes.length * 0.13 + 0.05;
}

/** 回傳這個聲音大約持續幾秒；沒開聲音也回傳同樣的長度，讓畫面節奏一致 */
export function playSignal(id: SignalId, enabled: boolean): number {
  const long = 1.5;
  const dur = id === 'both' || id === 'one' ? long : id === 'alarm1' ? 1.0 : 2.2;
  if (!enabled) return dur;
  const a = audio();
  if (!a) return dur;
  const t = a.ctx.currentTime + 0.05;
  switch (id) {
    case 'both': // 兩枝齊吹：兩個號同時，音高略有差異
      note(a, G4, t, long, 0.13);
      note(a, G4 * 1.012, t, long, 0.13);
      break;
    case 'one':
      note(a, G4, t, long, 0.16);
      break;
    case 'alarm1':
      alarm(a, t);
      break;
    case 'alarm2':
      alarm(a, t);
      alarm(a, t + 1.15);
      break;
  }
  return dur;
}

/** 使用者第一次打開聲音時呼叫，讓瀏覽器允許出聲 */
export function unlockAudio() {
  audio();
}
