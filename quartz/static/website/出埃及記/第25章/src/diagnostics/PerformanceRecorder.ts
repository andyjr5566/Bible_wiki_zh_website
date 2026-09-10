import * as THREE from 'three';

export interface PerformanceAssetSource {
  id: string;
  loadedUrl: string;
  sourceFile: string;
  processedFile: string;
  runtimeFile: string;
  sha256: string;
  derivedHash?: string;
}

export interface PerformanceEnvironment {
  profile: string;
  buildHash: string | null;
  assets: readonly PerformanceAssetSource[];
  activeAssetIds: readonly string[];
  getProfile?: () => string;
  getActiveAssetIds?: () => readonly string[];
  getNetworkState?: () => string;
}

export interface RendererSnapshot {
  calls: number;
  triangles: number;
  points: number;
  lines: number;
  geometries: number;
  textures: number;
}

export interface PerformanceMeasurement {
  scenario: string;
  startedAt: string;
  endedAt: string;
  durationMs: number;
  firstUsefulFrameMs: number | null;
  loadMs: number | null;
  frameIntervalsMs: { count: number; median: number | null; p95: number | null };
  longTasks: { count: number; totalDurationMs: number; maxDurationMs: number };
  renderer: RendererSnapshot | null;
  environment: {
    browser: string;
    buildHash: string | null;
    viewport: { width: number; height: number };
    devicePixelRatio: number;
    profile: string;
    cache: string;
    network: string;
    webgl: { version: string | null; renderer: string | null; vendor: string | null };
  };
  assets: PerformanceAssetSource[];
  activeAssetIds: string[];
  evidence: {
    timingSource: 'requestAnimationFrame interval';
    gpuTiming: 'unavailable without EXT_disjoint_timer_query';
    loadedUrlAndHashRecorded: boolean;
  };
}

export interface PerformanceRecorderApi {
  start(scenario: string): void;
  recordFrame(time?: number): void;
  markLoadComplete(): void;
  markUsefulFrame(): void;
  stop(): PerformanceMeasurement | null;
  exportJson(): string;
  isRecording(): boolean;
}

interface ActiveMeasurement {
  scenario: string;
  startTime: number;
  firstUsefulFrameMs: number | null;
  loadMs: number | null;
  frameIntervalsMs: number[];
  previousFrameTime: number | null;
  longTasks: number[];
  renderer: RendererSnapshot | null;
}

export class PerformanceRecorder implements PerformanceRecorderApi {
  readonly #renderer: THREE.WebGLRenderer;
  readonly #canvas: HTMLCanvasElement;
  readonly #environment: PerformanceEnvironment;
  #active: ActiveMeasurement | null = null;
  #last: PerformanceMeasurement | null = null;
  #observer: PerformanceObserver | null = null;

  constructor(renderer: THREE.WebGLRenderer, canvas: HTMLCanvasElement, environment: PerformanceEnvironment) {
    this.#renderer = renderer;
    this.#canvas = canvas;
    this.#environment = environment;
  }

  start(scenario: string): void {
    if (!scenario.trim()) throw new Error('Performance scenario must have a name.');
    if (this.#active) this.stop();
    const active: ActiveMeasurement = {
      scenario: scenario.trim(), startTime: performance.now(), firstUsefulFrameMs: null,
      loadMs: null, frameIntervalsMs: [], previousFrameTime: null, longTasks: [], renderer: null,
    };
    this.#active = active;
    this.#observer?.disconnect();
    this.#observer = null;
    if (typeof PerformanceObserver !== 'undefined') {
      try {
        this.#observer = new PerformanceObserver((list) => {
          if (!this.#active) return;
          list.getEntries().forEach((entry) => this.#active?.longTasks.push(entry.duration));
        });
        this.#observer.observe({ type: 'longtask', buffered: true });
      } catch {
        // Long task entries are optional and unsupported in some browsers.
      }
    }
  }

  recordFrame(time = performance.now()): void {
    const active = this.#active;
    if (!active) return;
    if (active.previousFrameTime !== null) active.frameIntervalsMs.push(time - active.previousFrameTime);
    active.previousFrameTime = time;
    active.renderer = readRendererSnapshot(this.#renderer);
  }

  markLoadComplete(time = performance.now()): void {
    if (this.#active && this.#active.loadMs === null) this.#active.loadMs = Math.max(0, time - this.#active.startTime);
  }

  markUsefulFrame(time = performance.now()): void {
    if (this.#active && this.#active.firstUsefulFrameMs === null) this.#active.firstUsefulFrameMs = Math.max(0, time - this.#active.startTime);
  }

  stop(): PerformanceMeasurement | null {
    if (!this.#active) return this.#last;
    const active = this.#active;
    const endedAt = performance.now();
    this.#observer?.disconnect();
    this.#observer = null;
    this.#active = null;
    const browser = typeof navigator === 'undefined' ? 'unknown' : navigator.userAgent;
    const environment = readEnvironment(this.#canvas, this.#renderer, this.#environment, browser);
    this.#last = {
      scenario: active.scenario,
      startedAt: new Date(Date.now() - Math.max(0, endedAt - active.startTime)).toISOString(),
      endedAt: new Date().toISOString(),
      durationMs: Math.max(0, endedAt - active.startTime),
      firstUsefulFrameMs: active.firstUsefulFrameMs,
      loadMs: active.loadMs,
      frameIntervalsMs: summarize(active.frameIntervalsMs),
      longTasks: { count: active.longTasks.length, totalDurationMs: sum(active.longTasks), maxDurationMs: Math.max(0, ...active.longTasks) },
      renderer: active.renderer,
      environment,
      assets: this.#environment.assets.map((asset) => ({ ...asset })),
      activeAssetIds: [...(this.#environment.getActiveAssetIds?.() ?? this.#environment.activeAssetIds)],
      evidence: {
        timingSource: 'requestAnimationFrame interval',
        gpuTiming: 'unavailable without EXT_disjoint_timer_query',
        loadedUrlAndHashRecorded: this.#environment.assets.every((asset) => Boolean(asset.loadedUrl && asset.sha256)),
      },
    };
    return this.#last;
  }

  exportJson(): string {
    return JSON.stringify({ generatedAt: new Date().toISOString(), measurement: this.#active ? null : this.#last }, null, 2);
  }

  isRecording(): boolean { return this.#active !== null; }
}

function readRendererSnapshot(renderer: THREE.WebGLRenderer): RendererSnapshot {
  return {
    calls: renderer.info.render.calls,
    triangles: renderer.info.render.triangles,
    points: renderer.info.render.points,
    lines: renderer.info.render.lines,
    geometries: renderer.info.memory.geometries,
    textures: renderer.info.memory.textures,
  };
}

function readEnvironment(canvas: HTMLCanvasElement, renderer: THREE.WebGLRenderer, source: PerformanceEnvironment, browser: string): PerformanceMeasurement['environment'] {
  const gl = renderer.getContext();
  const debug = gl.getExtension('WEBGL_debug_renderer_info');
  return {
    browser,
    buildHash: source.buildHash,
    viewport: { width: canvas.clientWidth, height: canvas.clientHeight },
    devicePixelRatio: typeof window === 'undefined' ? 1 : window.devicePixelRatio,
    profile: source.getProfile?.() ?? source.profile,
    cache: typeof window !== 'undefined' && 'caches' in window ? 'browser cache API available; exact cache mode unverified' : 'unverified',
    network: source.getNetworkState?.() ?? 'unverified',
    webgl: {
      version: gl.getParameter(gl.VERSION) as string | null,
      renderer: debug ? gl.getParameter(debug.UNMASKED_RENDERER_WEBGL) as string | null : null,
      vendor: debug ? gl.getParameter(debug.UNMASKED_VENDOR_WEBGL) as string | null : null,
    },
  };
}

function summarize(values: readonly number[]): PerformanceMeasurement['frameIntervalsMs'] {
  if (!values.length) return { count: 0, median: null, p95: null };
  const sorted = [...values].sort((a, b) => a - b);
  return { count: values.length, median: percentile(sorted, 0.5), p95: percentile(sorted, 0.95) };
}

function percentile(sorted: readonly number[], fraction: number): number {
  const index = (sorted.length - 1) * fraction;
  const lower = Math.floor(index); const upper = Math.ceil(index);
  if (lower === upper) return round(sorted[lower] ?? 0);
  return round((sorted[lower] ?? 0) + ((sorted[upper] ?? 0) - (sorted[lower] ?? 0)) * (index - lower));
}

function sum(values: readonly number[]): number { return round(values.reduce((total, value) => total + value, 0)); }
function round(value: number): number { return Math.round(value * 100) / 100; }
