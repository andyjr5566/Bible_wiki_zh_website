import epicUrl from '../assets/music/epic.mp3';
import expansionUrl from '../assets/music/expansion.mp3';
import firstlightUrl from '../assets/music/firstlight.mp3';
import hopeUrl from '../assets/music/hope.mp3';
import plainsUrl from '../assets/music/plains.mp3';
import pursuitUrl from '../assets/music/pursuit.mp3';
import ruinsUrl from '../assets/music/ruins.mp3';
import waitingUrl from '../assets/music/waiting.mp3';
import crowdMurmurUrl from '../assets/audio/crowd-murmur.mp3';
import crowdSurgeUrl from '../assets/audio/crowd-surge.mp3';
import desertWindUrl from '../assets/audio/desert-wind.mp3';
import oakLeavesUrl from '../assets/audio/oak-leaves.mp3';
import riverUrl from '../assets/audio/river.mp3';
import seaCrashUrl from '../assets/audio/sea-crash.mp3';
import seaRoarUrl from '../assets/audio/sea-roar.mp3';
import stoneThudUrl from '../assets/audio/stone-thud.mp3';
import valleyWindUrl from '../assets/audio/valley-wind.mp3';
import type { SiteData } from '../data/types';
import { stationReadPx } from '../data/storytelling';
import { sampleStation, stations as allStations } from '../scene/stations';
import { viewportHeight } from '../ui/viewport';
import type { StoryState } from './state';

type LoopKey = 'valleyWind' | 'oakLeaves' | 'river' | 'seaRoar' | 'desertWind' | 'crowdMurmur';

const LOOP_URLS: Record<LoopKey, string> = {
  valleyWind: valleyWindUrl,
  oakLeaves: oakLeavesUrl,
  river: riverUrl,
  seaRoar: seaRoarUrl,
  desertWind: desertWindUrl,
  crowdMurmur: crowdMurmurUrl,
};

/** 配樂：2026-10-27 使用者試聽後選定的八首，各自接成無縫循環（見 素材來源.md〈配樂〉）。 */
export type MusicKey = 'ruins' | 'plains' | 'epic' | 'pursuit' | 'waiting' | 'expansion' | 'firstlight' | 'hope';

const MUSIC_URLS: Record<MusicKey, string> = {
  ruins: ruinsUrl,
  plains: plainsUrl,
  epic: epicUrl,
  pursuit: pursuitUrl,
  waiting: waitingUrl,
  expansion: expansionUrl,
  firstlight: firstlightUrl,
  hope: hopeUrl,
};
// 成品統一在約 -22 LUFS，這裡的音量決定它在環境音之上多少；平靜的壓低，史詩的略大。
// Epic 與 Pursuit 在紅海前後直接交接，兩首設成同一個音量才不會換曲時忽大忽小。
const MUSIC_VOLUME: Record<MusicKey, number> = {
  ruins: 0.26, plains: 0.26, epic: 0.32, pursuit: 0.32, waiting: 0.26, expansion: 0.26, firstlight: 0.28, hope: 0.28,
};

/** 整理區的配樂音量（相對終幕） */
const REVIEW_MUSIC_GAIN = 0.7;

/** 換曲的速度（每 90 ms 往目標靠近的比例）：cut 約半秒、fast 約 1 秒、normal 約 3 秒、slow 約 8 秒。 */
const FADE_RATE = { cut: 0.5, fast: 0.25, normal: 0.06, slow: 0.025 } as const;
export type MusicFade = keyof typeof FADE_RATE;

export interface MusicCue {
  key: MusicKey | null;
  /** 乘在 MUSIC_VOLUME 上，做出同一首曲子裡的層次 */
  gain: number;
  fade: MusicFade;
  /** 從安靜重新進來時跳到第幾秒（沒有就接著上次停的地方） */
  startAt?: number;
}

export interface MusicContext {
  /** 第二幕目前所在的站：p 是閱讀段進度，flight 是站與站之間的飛行 */
  station?: { id: string; p: number; flight: boolean } | null;
  /** 約但河刀弓垂下後安靜的長度（站內進度），約一屏 */
  jordanQuiet?: number;
}

/** 紅海站畫面的時間點（stations.json 的圖層動作）：水牆 0.38 開始合上；黑暗 0.55 起散去，到 0.85 已看得見對岸。 */
export const REDSEA_WATER_CLOSES = 0.38;
const REDSEA_DARKNESS_LIFTS = 0.85;
/** 約但河站 0.5：過河的人換成刀弓垂下 */
const JORDAN_SWORDS_DOWN = 0.5;

/**
 * 紅海的海聲（怒海循環音）隨畫面推進：追兵逼近時越來越大，水牆合上時最滿（同時響一次巨響），
 * 戰車沉沒後退下，黑暗散去後只剩很輕的海。海聲不算風，不受 WIND_SCALE 影響。
 */
export function redseaRoar(p: number, flight: boolean): number {
  if (flight) return 0.2;
  if (p < REDSEA_WATER_CLOSES) return 0.4 + 0.4 * (p / REDSEA_WATER_CLOSES);
  if (p < 0.72) return 1;
  if (p < REDSEA_DARKNESS_LIFTS) return 1 - 0.75 * (p - 0.72) / (REDSEA_DARKNESS_LIFTS - 0.72);
  return 0.25;
}

const cueOf = (key: MusicKey | null, gain = 1, fade: MusicFade = 'normal', startAt?: number): MusicCue => ({ key, gain, fade, startAt });

/**
 * 配樂的進出與停頓（2026-10-27 與使用者逐點確認）：
 * - 紅海：追兵逼近時換成 Pursuit；水牆一開始合上就驟停，只留海聲與海水合上的一聲；黑暗散去後 Epic 輕輕回來。
 * - 約但河：刀弓垂下（「並不是用你的刀，也不是用你的弓」）時 Epic 停約一屏，再從頭進場。
 * - 第四幕：Waiting II 從第三幕延續到第16–18節；第19–20節整個安靜；第21節起 Unexplored Expansion 慢慢疊上來，
 *   到第24節第三次「必事奉」最滿。
 */
export function musicCue(cue: string, segment: string, ctx: MusicContext = {}): MusicCue {
  if (cue === 'cannot') return cueOf(null, 0, 'cut');
  if (segment === 'prologue' || segment === 'act-1') return cueOf('ruins');
  if (segment === 'act-2') {
    const st = ctx.station;
    if (!st) return cueOf('plains');
    switch (st.id) {
      case 'egypt': return cueOf('epic', 1, 'normal', 0);
      case 'redsea':
        if (st.flight) return cueOf('epic');
        if (st.p < REDSEA_WATER_CLOSES) return cueOf('pursuit', 1, 'fast', 16);
        if (st.p < REDSEA_DARKNESS_LIFTS) return cueOf(null, 0, 'cut');
        return cueOf('epic', 0.55, 'slow', 0);
      case 'wilderness': return cueOf('epic', 0.6, 'slow');
      case 'east': return cueOf('epic');
      case 'moab': return cueOf('epic', 0.85);
      case 'jordan':
        if (st.flight || st.p < JORDAN_SWORDS_DOWN) return cueOf('epic');
        if (st.p < JORDAN_SWORDS_DOWN + (ctx.jordanQuiet ?? 0.2)) return cueOf(null, 0, 'cut');
        return cueOf('epic', 1, 'normal', 0);
      case 'canaan': return cueOf('plains', 1, 'slow');
      default: return cueOf('plains');
    }
  }
  if (segment === 'act-3') return cueOf('waiting');
  if (segment === 'act-4') {
    switch (cue) {
      case 'answer-1': return cueOf('waiting');
      case 'answer-2': return cueOf('expansion', 0.45, 'slow', 0);
      case 'witness': return cueOf('expansion', 0.65, 'slow');
      case 'put-away': return cueOf('expansion', 0.55, 'slow');
      case 'answer-3': return cueOf('expansion', 1, 'slow');
      default: return cueOf('expansion', 0.6, 'slow');
    }
  }
  if (segment === 'act-5') {
    return cueOf('firstlight');
  }
  return cueOf('hope');
}

/** 風與樹葉的整體音量（2026-10-27 使用者兩次要求風聲再小一點）。 */
const WIND_SCALE = 0.4;
const WIND_LOOPS = new Set<LoopKey>(['valleyWind', 'desertWind', 'oakLeaves']);

/** 第二幕各站的環境音（0–1）。只有渡河、紅海、曠野與迦南有；其餘站只有配樂。 */
const STATION_SOUND: Record<string, Partial<Record<LoopKey, number>>> = {
  ford: { river: 0.3 },
  wilderness: { desertWind: 0.3 },
  canaan: { oakLeaves: 0.14 },
};

export interface StoryAudioController {
  sync(inReviewZone: boolean): void;
  playStoneThud(): void;
}

function seekTo(el: HTMLAudioElement, seconds: number): void {
  try {
    if (el.readyState >= 1) el.currentTime = seconds;
    else el.addEventListener('loadedmetadata', () => { el.currentTime = seconds; }, { once: true });
  } catch {
    // 尚未可定位時略過，曲子從頭播放
  }
}

export function createStoryAudio(_data: SiteData, state: StoryState, onActivated?: () => void): StoryAudioController {
  const loops: Partial<Record<LoopKey, HTMLAudioElement>> = {};
  const targets: Record<LoopKey, number> = {
    valleyWind: 0,
    oakLeaves: 0,
    river: 0,
    seaRoar: 0,
    desertWind: 0,
    crowdMurmur: 0,
  };

  const musicEls: Partial<Record<MusicKey, HTMLAudioElement>> = {};
  const musicTargets = Object.fromEntries(Object.keys(MUSIC_URLS).map(k => [k, 0])) as Record<MusicKey, number>;
  let musicFade: MusicFade = 'normal';
  let musicStartAt: number | undefined;

  let seaCloseShot: HTMLAudioElement | null = null;
  let crowdSurgeShot: HTMLAudioElement | null = null;
  let stoneThudShot: HTMLAudioElement | null = null;
  let lastBeatId = '';
  let seaClosing = false;
  let fadeTimer: number | null = null;

  function ensureElements(): void {
    for (const k of Object.keys(LOOP_URLS) as LoopKey[]) {
      if (!loops[k]) {
        const el = new Audio(LOOP_URLS[k]);
        el.loop = true;
        el.preload = 'auto';
        el.volume = 0;
        loops[k] = el;
      }
    }
    if (!seaCloseShot) {
      seaCloseShot = new Audio(seaCrashUrl);
      seaCloseShot.preload = 'auto';
    }
    if (!crowdSurgeShot) {
      crowdSurgeShot = new Audio(crowdSurgeUrl);
      crowdSurgeShot.preload = 'auto';
    }
    if (!stoneThudShot) {
      stoneThudShot = new Audio(stoneThudUrl);
      stoneThudShot.preload = 'auto';
    }
  }

  function playOneShot(el: HTMLAudioElement | null, vol: number): void {
    if (!el || !state.soundOn || !state.audioReady || document.hidden) return;
    try {
      el.pause();
      el.currentTime = 0;
      el.volume = Math.max(0, Math.min(1, vol));
      void el.play().catch(() => {});
    } catch {
      // 瀏覽器自動播放限制下安全靜默
    }
  }

  function computeTargets(inReviewZone: boolean): void {
    for (const k of Object.keys(targets) as LoopKey[]) {
      targets[k] = 0;
    }
    for (const k of Object.keys(musicTargets) as MusicKey[]) {
      musicTargets[k] = 0;
    }
    if (!state.soundOn || !state.audioReady || document.hidden) return;
    // 故事演完、來到下方的整理區：環境音收掉，終幕的配樂留下來小聲繼續播
    if (inReviewZone) {
      musicFade = 'slow';
      musicStartAt = undefined;
      musicTargets.hope = MUSIC_VOLUME.hope * REVIEW_MUSIC_GAIN;
      return;
    }

    const sample = state.segment === 'act-2' ? sampleStation(state.beat, state.beatProgress) : null;
    const jordan = allStations.find(st => st.id === 'jordan');
    const music = musicCue(state.cue, state.segment, {
      station: sample ? { id: sample.station.id, p: sample.p, flight: sample.flight } : null,
      jordanQuiet: jordan ? viewportHeight() / stationReadPx(jordan) : undefined,
    });
    musicFade = music.fade;
    musicStartAt = music.startAt;
    if (music.key) musicTargets[music.key] = MUSIC_VOLUME[music.key] * music.gain;

    const id = state.cue;
    const seg = state.segment;

    // 風只在需要的地方出現（2026-10-27 使用者：風聲再小，有些時候就不用有風）。
    // 第19節的安靜（cannot）：人群聲全停，只留橡樹葉微響
    if (id === 'cannot') {
      targets.oakLeaves = 0.24;
      return;
    }

    // 第六幕：石頭旁只有橡樹葉；終幕兩欄對照不放環境音，最後空無一人的石頭旁才有一點風
    if (seg === 'act-6') {
      targets.oakLeaves = 0.16;
      return;
    }
    if (seg === 'epilogue') {
      if (id === 'epilogue-stone') targets.valleyWind = 0.2;
      return;
    }

    // 第二幕：只有渡河、紅海、曠野幾站有環境音；飛行與其他站只有配樂
    if (seg === 'act-2') {
      if (sample?.station.id === 'redsea') targets.seaRoar = redseaRoar(sample.p, sample.flight);
      else if (sample && !sample.flight) Object.assign(targets, STATION_SOUND[sample.station.id] ?? {});
      return;
    }

    // 序幕：開場的山谷有一點風與橡樹葉
    if (seg === 'prologue') {
      targets.valleyWind = 0.24;
      targets.oakLeaves = 0.2;
      return;
    }

    // 第一、三、四、五幕：橡樹葉＋遠處低頻會眾背景，不放風
    targets.oakLeaves = 0.18;
    if (id !== 'dismiss' && state.pastBlend < 0.3) {
      targets.crowdMurmur = 0.13;
    }
  }

  function stepVolumes(): void {
    let anyActive = false;
    for (const k of Object.keys(targets) as LoopKey[]) {
      const el = loops[k];
      if (!el) continue;
      const goal = targets[k] * (WIND_LOOPS.has(k) ? WIND_SCALE : 1);
      if (goal > 0.005 && el.paused && state.soundOn && !document.hidden) {
        void el.play().catch(() => {});
      }
      const diff = goal - el.volume;
      if (Math.abs(diff) > 0.012) {
        // 換站、換幕時環境音約 2 秒慢慢交疊；第19節的安靜要快
        el.volume = Math.max(0, Math.min(1, el.volume + diff * (state.cue === 'cannot' ? 0.28 : 0.08)));
        anyActive = true;
      } else {
        el.volume = goal;
        if (goal <= 0.002 && !el.paused) {
          el.pause();
        }
      }
      if (goal > 0.002) anyActive = true;
    }

    // 配樂換曲的快慢由目前的段落決定（見 musicCue）；曲子要用到才載入。
    const musicRate = FADE_RATE[musicFade];
    for (const k of Object.keys(musicTargets) as MusicKey[]) {
      const goal = musicTargets[k];
      let el = musicEls[k];
      if (!el) {
        if (goal <= 0.005) continue;
        el = new Audio(MUSIC_URLS[k]);
        el.loop = true;
        el.preload = 'auto';
        el.volume = 0;
        musicEls[k] = el;
      }
      if (goal > 0.005 && (el.paused || el.volume <= 0.005)) {
        // 從安靜重新進來：有指定的話跳到那一秒（例如追擊曲直接從最緊的段落開始）
        if (musicStartAt !== undefined && el.volume <= 0.005) seekTo(el, musicStartAt);
        if (el.paused && state.soundOn && !document.hidden) void el.play().catch(() => {});
      }
      const diff = goal - el.volume;
      if (Math.abs(diff) > 0.004) {
        el.volume = Math.max(0, Math.min(1, el.volume + diff * musicRate));
        anyActive = true;
      } else {
        el.volume = goal;
        if (goal <= 0.002 && !el.paused) el.pause();
      }
      if (goal > 0.002) anyActive = true;
    }

    if (!anyActive && fadeTimer !== null) {
      window.clearInterval(fadeTimer);
      fadeTimer = null;
    }
  }

  function ensureFadeLoop(): void {
    if (fadeTimer === null) {
      fadeTimer = window.setInterval(stepVolumes, 90);
    }
  }

  document.addEventListener('visibilitychange', () => {
    computeTargets(false);
    ensureFadeLoop();
  });

  // 瀏覽器要讀者先操作過頁面才准出聲；在那之前不載入任何音檔，首屏不受影響。
  let lastInReviewZone = false;
  const activationEvents = ['pointerdown', 'keydown', 'touchend', 'click'];
  function activate(): void {
    if (state.audioReady) return;
    state.audioReady = true;
    for (const name of activationEvents) window.removeEventListener(name, activate, true);
    if (state.soundOn) ensureElements();
    computeTargets(lastInReviewZone);
    ensureFadeLoop();
    onActivated?.();
  }
  if (!state.audioReady && typeof window !== 'undefined') {
    for (const name of activationEvents) window.addEventListener(name, activate, { capture: true, passive: true });
  }

  return {
    sync(inReviewZone: boolean) {
      lastInReviewZone = inReviewZone;
      if (state.soundOn && state.audioReady) {
        ensureElements();
      }
      computeTargets(inReviewZone);
      ensureFadeLoop();

      const curId = state.cue;
      // 海水合上的一聲：紅海站的水牆開始合上時響一次（往回捲再往下會再響）
      const sample = state.segment === 'act-2' ? sampleStation(state.beat, state.beatProgress) : null;
      const closing = Boolean(sample && sample.station.id === 'redsea' && !sample.flight && sample.p >= REDSEA_WATER_CLOSES);
      if (closing && !seaClosing && state.soundOn && !inReviewZone) playOneShot(seaCloseShot, 0.9);
      seaClosing = closing;
      if (curId !== lastBeatId) {
        const prev = lastBeatId;
        lastBeatId = curId;
        if (state.soundOn && !inReviewZone && prev !== '') {
          if (curId === 'answer-1' || curId === 'answer-2' || curId === 'answer-3') {
            playOneShot(crowdSurgeShot, 0.22);
          }
        }
      }
    },
    playStoneThud() {
      if (!state.soundOn || !state.audioReady) return;
      ensureElements();
      playOneShot(stoneThudShot, 0.68);
    },
  };
}
