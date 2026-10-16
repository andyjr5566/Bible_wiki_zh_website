
import { afterEach, describe, expect, it, vi } from "vitest";
import { buildSpokenText, createSpeech, type Replacement } from "./speech";

type FakeEvent = Event & { charIndex?: number };
type FakeHandler = (event: FakeEvent) => void;

class FakeUtterance {
  readonly text: string;
  lang = "";
  voice: SpeechSynthesisVoice | null = null;
  rate = 1;
  onstart: FakeHandler | null = null;
  onboundary: FakeHandler | null = null;
  onend: FakeHandler | null = null;
  private readonly listeners = new Map<string, Set<EventListener>>();

  constructor(text: string) {
    this.text = text;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    const set = this.listeners.get(type) ?? new Set<EventListener>();
    set.add(typeof listener === "function" ? listener : (event) => listener.handleEvent(event));
    this.listeners.set(type, set);
  }

  emit(type: "start" | "boundary" | "end", detail: { charIndex?: number } = {}): void {
    const event = { type, ...detail } as FakeEvent;
    const propertyHandler = type === "start" ? this.onstart : type === "boundary" ? this.onboundary : this.onend;
    propertyHandler?.(event);
    for (const listener of this.listeners.get(type) ?? []) listener(event);
  }
}

class FakeSpeechSynthesis {
  voices: SpeechSynthesisVoice[] = [];
  readonly utterances: FakeUtterance[] = [];
  cancelCalls = 0;
  onvoiceschanged: ((event: Event) => void) | null = null;
  private readonly listeners = new Set<EventListener>();

  getVoices(): SpeechSynthesisVoice[] {
    return this.voices;
  }

  speak(utterance: SpeechSynthesisUtterance): void {
    this.utterances.push(utterance as unknown as FakeUtterance);
  }

  cancel(): void {
    this.cancelCalls += 1;
  }

  addEventListener(type: string, listener: EventListenerOrEventListenerObject): void {
    if (type === "voiceschanged") {
      this.listeners.add(typeof listener === "function" ? listener : (event) => listener.handleEvent(event));
    }
  }

  emitVoicesChanged(): void {
    const event = { type: "voiceschanged" } as Event;
    this.onvoiceschanged?.(event);
    for (const listener of this.listeners) listener(event);
  }
}

function makeVoice(name: string, lang: string): SpeechSynthesisVoice {
  return { name, lang } as SpeechSynthesisVoice;
}

function makeWindow(synthesis?: FakeSpeechSynthesis): Window & typeof globalThis {
  return {
    speechSynthesis: synthesis as unknown as SpeechSynthesis,
    SpeechSynthesisUtterance: FakeUtterance,
    Date: globalThis.Date,
    setTimeout: globalThis.setTimeout.bind(globalThis),
    clearTimeout: globalThis.clearTimeout.bind(globalThis),
    setInterval: globalThis.setInterval.bind(globalThis),
    clearInterval: globalThis.clearInterval.bind(globalThis),
  } as unknown as Window & typeof globalThis;
}

function callbacks() {
  return { onBoundary: vi.fn(), onEnd: vi.fn() };
}

afterEach(() => {
  vi.useRealTimers();
});

describe("createSpeech voice selection", () => {
  it("prefers zh-TW over zh-CN, including case and underscore variants", async () => {
    const synthesis = new FakeSpeechSynthesis();
    synthesis.voices = [makeVoice("Mandarin", "zh-CN"), makeVoice("Taiwan", "ZH_tw")];
    const controller = createSpeech({ win: makeWindow(synthesis) });

    await expect(controller.ready()).resolves.toBe(true);
    expect(controller.voiceName()).toBe("Taiwan");
  });

  it("prefers zh-HK over zh-CN when zh-TW is unavailable", async () => {
    const synthesis = new FakeSpeechSynthesis();
    synthesis.voices = [makeVoice("Mandarin", "zh-CN"), makeVoice("Hong Kong", "zh-HK")];
    const controller = createSpeech({ win: makeWindow(synthesis) });

    await expect(controller.ready()).resolves.toBe(true);
    expect(controller.voiceName()).toBe("Hong Kong");
  });

  it("notices voices loaded asynchronously", async () => {
    const synthesis = new FakeSpeechSynthesis();
    const controller = createSpeech({ win: makeWindow(synthesis) });
    const ready = controller.ready();

    synthesis.voices = [makeVoice("Taiwan", "zh-TW")];
    synthesis.emitVoicesChanged();

    await expect(ready).resolves.toBe(true);
  });

  it("returns false after 1500 ms when no Chinese voice appears", async () => {
    vi.useFakeTimers();
    const synthesis = new FakeSpeechSynthesis();
    const controller = createSpeech({ win: makeWindow(synthesis) });
    const ready = controller.ready();
    let settled = false;
    void ready.then(() => { settled = true; });

    await vi.advanceTimersByTimeAsync(1499);
    expect(settled).toBe(false);
    await vi.advanceTimersByTimeAsync(1);
    await expect(ready).resolves.toBe(false);
  });
});

describe("spoken text and boundaries", () => {
  it("maps length-changing replacements back to their original span", () => {
    const result = buildSpokenText("cabd", [["ab", "xyz"]]);

    expect(result).toEqual({ spoken: "cxyzd", toOriginal: [0, 1, 1, 1, 3, 4] });
  });

  it("maps real boundaries through replacements", () => {
    const synthesis = new FakeSpeechSynthesis();
    const controller = createSpeech({
      win: makeWindow(synthesis),
      replacements: [["ab", "xyz"]],
    });
    const calls = callbacks();
    controller.speak("cabd", { rate: 1, ...calls });

    const utterance = synthesis.utterances[0];
    expect(utterance.text).toBe("cxyzd");
    utterance.emit("boundary", { charIndex: 2 });

    expect(calls.onBoundary).toHaveBeenCalledWith(1, false);
  });

  it("adds startChar to a mapped boundary index", () => {
    const synthesis = new FakeSpeechSynthesis();
    const replacements: readonly Replacement[] = [["乙丙", "WXYZ"]];
    const controller = createSpeech({ win: makeWindow(synthesis), replacements });
    const calls = callbacks();
    controller.speak("甲乙丙丁", { rate: 1, startChar: 1, ...calls });

    const utterance = synthesis.utterances[0];
    expect(utterance.text).toBe("WXYZ丁");
    utterance.emit("boundary", { charIndex: 2 });

    expect(calls.onBoundary).toHaveBeenCalledWith(1, false);
  });
});

describe("utterance lifecycle and fallback", () => {
  it("ignores stale events after stop and does not call onEnd", () => {
    const synthesis = new FakeSpeechSynthesis();
    const controller = createSpeech({ win: makeWindow(synthesis) });
    const calls = callbacks();
    controller.speak("verse", { rate: 1, ...calls });
    const utterance = synthesis.utterances[0];

    controller.stop();
    utterance.emit("boundary", { charIndex: 2 });
    utterance.emit("end");

    expect(calls.onBoundary).not.toHaveBeenCalled();
    expect(calls.onEnd).not.toHaveBeenCalled();
    expect(controller.speaking()).toBe(false);
  });

  it("ignores events from an utterance replaced by a newer speak", () => {
    const synthesis = new FakeSpeechSynthesis();
    const controller = createSpeech({ win: makeWindow(synthesis) });
    const first = callbacks();
    const second = callbacks();
    controller.speak("first", { rate: 1, ...first });
    const stale = synthesis.utterances[0];
    controller.speak("second", { rate: 1, ...second });

    stale.emit("boundary", { charIndex: 1 });
    stale.emit("end");
    synthesis.utterances[1].emit("end");

    expect(first.onBoundary).not.toHaveBeenCalled();
    expect(first.onEnd).not.toHaveBeenCalled();
    expect(second.onEnd).toHaveBeenCalledTimes(1);
    expect(synthesis.cancelCalls).toBe(2);
  });

  it("estimates progress until a real boundary arrives, then stops and never decreases", () => {
    vi.useFakeTimers();
    const synthesis = new FakeSpeechSynthesis();
    const controller = createSpeech({ win: makeWindow(synthesis) });
    const calls = callbacks();
    controller.speak("a long verse", { rate: 1, ...calls });
    const utterance = synthesis.utterances[0];
    utterance.emit("start");

    vi.advanceTimersByTime(600);
    const estimates = calls.onBoundary.mock.calls.filter((call) => call[1] === true);
    expect(estimates.length).toBeGreaterThan(0);
    const estimatedIndices = estimates.map((call) => call[0] as number);
    expect(estimatedIndices).toEqual([...estimatedIndices].sort((a, b) => a - b));

    utterance.emit("boundary", { charIndex: 3 });
    const countAfterRealBoundary = calls.onBoundary.mock.calls.length;
    vi.advanceTimersByTime(600);

    expect(calls.onBoundary).toHaveBeenCalledTimes(countAfterRealBoundary);
    expect(calls.onBoundary).toHaveBeenLastCalledWith(3, false);
  });

  it("starts fallback when the start event does not arrive within 300 ms", () => {
    vi.useFakeTimers();
    const synthesis = new FakeSpeechSynthesis();
    const controller = createSpeech({ win: makeWindow(synthesis) });
    const calls = callbacks();
    controller.speak("verse", { rate: 1, ...calls });

    vi.advanceTimersByTime(540);
    expect(calls.onBoundary).toHaveBeenCalled();
    expect(calls.onBoundary).toHaveBeenLastCalledWith(1, true);
  });

  it("clamps rate and uses a fallback language when no Chinese voice is ready", () => {
    const synthesis = new FakeSpeechSynthesis();
    const controller = createSpeech({ win: makeWindow(synthesis) });
    controller.speak("verse", { rate: 3, onBoundary: vi.fn(), onEnd: vi.fn() });

    expect(synthesis.utterances[0].rate).toBe(2);
    expect(synthesis.utterances[0].lang).toBe("zh-TW");
  });

  it("calls onEnd asynchronously when speech synthesis is unsupported", () => {
    vi.useFakeTimers();
    const controller = createSpeech({ win: makeWindow() });
    const calls = callbacks();

    expect(controller.supported()).toBe(false);
    controller.speak("verse", { rate: 1, ...calls });
    expect(calls.onEnd).not.toHaveBeenCalled();

    vi.advanceTimersByTime(0);
    expect(calls.onEnd).toHaveBeenCalledTimes(1);
  });
});
