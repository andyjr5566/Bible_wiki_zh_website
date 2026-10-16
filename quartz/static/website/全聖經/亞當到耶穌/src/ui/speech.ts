
export interface SpeakOptions {
  /** 0.5–2; maps to SpeechSynthesisUtterance.rate */
  rate: number;
  /** start speaking from this character index of text (default 0) */
  startChar?: number;
  /** called with an index into the ORIGINAL text; estimated=true when it comes from the timer fallback */
  onBoundary(charIndex: number, estimated: boolean): void;
  /** called once when the utterance finishes normally (not after stop()) */
  onEnd(): void;
}

export interface SpeechController {
  /** speechSynthesis exists in this browser */
  supported(): boolean;
  /** a Chinese voice is available (resolves after voices load; false if none within 1500 ms) */
  ready(): Promise<boolean>;
  /** the chosen voice name, or null */
  voiceName(): string | null;
  speak(text: string, options: SpeakOptions): void;
  stop(): void;
  speaking(): boolean;
}

/** Pronunciation fixes: only change the text sent to the speech engine; never what is displayed. */
export type Replacement = readonly [from: string, to: string];

/** Pure helper for tests: apply replacements and return spoken text plus a spoken-index to original-index map. */
export function buildSpokenText(
  original: string,
  replacements: readonly Replacement[],
): { spoken: string; toOriginal: number[] } {
  const ordered = replacements
    .map((replacement, order) => ({ replacement, order }))
    .filter(({ replacement }) => replacement[0].length > 0)
    .sort((a, b) => b.replacement[0].length - a.replacement[0].length || a.order - b.order);
  const spokenParts: string[] = [];
  const toOriginal: number[] = [];

  for (let index = 0; index < original.length;) {
    const match = ordered.find(({ replacement }) => original.startsWith(replacement[0], index));
    if (!match) {
      spokenParts.push(original[index]);
      toOriginal.push(index);
      index += 1;
      continue;
    }

    const [from, to] = match.replacement;
    spokenParts.push(to);
    for (let spokenIndex = 0; spokenIndex < to.length; spokenIndex += 1) {
      toOriginal.push(index);
    }
    index += from.length;
  }

  const spoken = spokenParts.join("");
  toOriginal.push(original.length);
  return { spoken, toOriginal };
}

type SpeechWindow = Window & typeof globalThis;
type SpeechEventHandler = (event: Event) => void;

interface EventTargetLike {
  addEventListener?: (type: string, listener: EventListenerOrEventListenerObject) => void;
  [key: string]: unknown;
}

interface ActiveUtterance {
  token: number;
  startChar: number;
  originalLength: number;
  toOriginal: number[];
  rate: number;
  onBoundary: SpeakOptions["onBoundary"];
  onEnd: SpeakOptions["onEnd"];
  startWatchId?: number;
  fallbackIntervalId?: number;
  fallbackStartedAt?: number;
  fallbackStopped: boolean;
  lastEstimate: number;
  ended: boolean;
}

function listen(target: object, eventName: string, handler: SpeechEventHandler): void {
  const eventTarget = target as EventTargetLike;
  if (typeof eventTarget.addEventListener === "function") {
    eventTarget.addEventListener(eventName, handler as EventListener);
    return;
  }
  eventTarget["on" + eventName] = handler;
}

function normalizedLang(lang: string): string {
  return lang.replace(/_/g, "-").toLowerCase();
}

function chooseChineseVoice(voices: readonly SpeechSynthesisVoice[]): SpeechSynthesisVoice | null {
  const normalized = voices.map((voice) => ({ voice, lang: normalizedLang(voice.lang) }));
  return normalized.find(({ lang }) => lang === "zh-tw")?.voice
    ?? normalized.find(({ lang }) => lang === "zh-hk")?.voice
    ?? normalized.find(({ lang }) => lang.startsWith("zh"))?.voice
    ?? null;
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

export function createSpeech(options?: {
  win?: Window & typeof globalThis;
  replacements?: readonly Replacement[];
}): SpeechController {
  const win: SpeechWindow = options?.win ?? window;
  const replacements = options?.replacements ?? [];
  const synthesis = win.speechSynthesis ?? null;
  let chosenVoice: SpeechSynthesisVoice | null = null;
  let generation = 0;
  let active: ActiveUtterance | null = null;
  const readyWaiters = new Set<(available: boolean) => void>();

  const refreshVoice = (): SpeechSynthesisVoice | null => {
    chosenVoice = synthesis ? chooseChineseVoice(synthesis.getVoices()) : null;
    return chosenVoice;
  };

  const onVoicesChanged = (): void => {
    if (refreshVoice()) {
      for (const waiter of [...readyWaiters]) waiter(true);
    }
  };

  if (synthesis) listen(synthesis, "voiceschanged", onVoicesChanged);

  const isCurrent = (state: ActiveUtterance): boolean =>
    active === state && state.token === generation && !state.ended;

  const clearTimers = (state: ActiveUtterance): void => {
    if (state.startWatchId !== undefined) {
      win.clearTimeout(state.startWatchId);
      state.startWatchId = undefined;
    }
    if (state.fallbackIntervalId !== undefined) {
      win.clearInterval(state.fallbackIntervalId);
      state.fallbackIntervalId = undefined;
    }
  };

  const beginFallback = (state: ActiveUtterance): void => {
    if (!isCurrent(state) || state.fallbackStopped || state.fallbackIntervalId !== undefined) return;
    state.fallbackStartedAt = win.Date.now();
    state.fallbackIntervalId = win.setInterval(() => {
      if (!isCurrent(state) || state.fallbackStopped) return;
      const elapsedSeconds = Math.max(0, (win.Date.now() - (state.fallbackStartedAt ?? win.Date.now())) / 1000);
      const estimate = clamp(
        Math.floor(state.startChar + elapsedSeconds * 4.2 * state.rate),
        state.startChar,
        state.originalLength,
      );
      state.lastEstimate = Math.max(state.lastEstimate, estimate);
      state.onBoundary(state.lastEstimate, true);
    }, 120);
  };

  const invalidateActive = (): void => {
    if (!active) return;
    clearTimers(active);
    active.ended = true;
    active = null;
  };

  const controller: SpeechController = {
    supported(): boolean {
      return synthesis !== null;
    },

    ready(): Promise<boolean> {
      if (!synthesis) return Promise.resolve(false);
      if (refreshVoice()) return Promise.resolve(true);

      return new Promise<boolean>((resolve) => {
        let settled = false;
        let timeoutId: number | undefined;
        const settle = (available: boolean): void => {
          if (settled) return;
          settled = true;
          readyWaiters.delete(settle);
          if (timeoutId !== undefined) win.clearTimeout(timeoutId);
          resolve(available);
        };

        readyWaiters.add(settle);
        timeoutId = win.setTimeout(() => settle(false), 1500);
        if (refreshVoice()) settle(true);
      });
    },

    voiceName(): string | null {
      return refreshVoice()?.name ?? null;
    },

    speak(text: string, speakOptions: SpeakOptions): void {
      if (!synthesis) {
        win.setTimeout(() => speakOptions.onEnd(), 0);
        return;
      }

      const token = ++generation;
      invalidateActive();
      synthesis.cancel();
      const voice = refreshVoice();
      const requestedStart = speakOptions.startChar ?? 0;
      const startChar = Number.isFinite(requestedStart)
        ? clamp(Math.trunc(requestedStart), 0, text.length)
        : 0;
      const { spoken, toOriginal } = buildSpokenText(text.slice(startChar), replacements);
      const rawRate = Number.isFinite(speakOptions.rate) ? speakOptions.rate : 1;
      const rate = clamp(rawRate, 0.5, 2);
      const utterance = new win.SpeechSynthesisUtterance(spoken);
      utterance.lang = voice?.lang ?? "zh-TW";
      if (voice) utterance.voice = voice;
      utterance.rate = rate;

      const state: ActiveUtterance = {
        token,
        startChar,
        originalLength: text.length,
        toOriginal,
        rate,
        onBoundary: speakOptions.onBoundary,
        onEnd: speakOptions.onEnd,
        fallbackStopped: false,
        lastEstimate: startChar,
        ended: false,
      };
      active = state;

      listen(utterance, "start", () => {
        if (!isCurrent(state) || state.fallbackStopped) return;
        if (state.startWatchId !== undefined) {
          win.clearTimeout(state.startWatchId);
          state.startWatchId = undefined;
        }
        beginFallback(state);
      });

      listen(utterance, "boundary", (event) => {
        if (!isCurrent(state)) return;
        state.fallbackStopped = true;
        clearTimers(state);
        const rawIndex = (event as Event & { charIndex?: number }).charIndex ?? 0;
        const spokenIndex = clamp(
          Number.isFinite(rawIndex) ? Math.trunc(rawIndex) : 0,
          0,
          state.toOriginal.length - 1,
        );
        const mapped = clamp(
          state.startChar + state.toOriginal[spokenIndex],
          0,
          state.originalLength,
        );
        state.onBoundary(mapped, false);
      });

      listen(utterance, "end", () => {
        if (!isCurrent(state)) return;
        clearTimers(state);
        state.ended = true;
        active = null;
        state.onEnd();
      });

      state.startWatchId = win.setTimeout(() => {
        state.startWatchId = undefined;
        beginFallback(state);
      }, 300);
      synthesis.speak(utterance);
    },

    stop(): void {
      generation += 1;
      invalidateActive();
      synthesis?.cancel();
    },

    speaking(): boolean {
      return active !== null && !active.ended;
    },
  };

  return controller;
}
