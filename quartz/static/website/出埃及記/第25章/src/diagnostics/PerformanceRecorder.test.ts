import { describe, expect, it, vi } from 'vitest';
import * as THREE from 'three';
import { PerformanceRecorder } from './PerformanceRecorder';

function createRecorder() {
  const canvas = { clientWidth: 1440, clientHeight: 900 } as HTMLCanvasElement;
  const renderer = { info: { render: { calls: 4, triangles: 12, points: 0, lines: 0 }, memory: { geometries: 2, textures: 1 } }, getContext: () => ({ VERSION: 1, getParameter: () => 'WebGL test', getExtension: () => null }) } as unknown as THREE.WebGLRenderer;
  return new PerformanceRecorder(renderer, canvas, { profile: 'desktop-high', buildHash: 'index-test', assets: [{ id: 'hero', loadedUrl: 'models/hero.glb', sourceFile: 'source.glb', processedFile: 'processed.glb', runtimeFile: 'runtime.glb', sha256: 'a'.repeat(64) }], activeAssetIds: ['hero'] });
}

describe('PerformanceRecorder', () => {
  it('summarizes rAF intervals and keeps GPU timing explicitly unavailable', () => {
    vi.spyOn(performance, 'now').mockReturnValue(100);
    const recorder = createRecorder(); recorder.start('hero'); recorder.recordFrame(100); recorder.recordFrame(116); recorder.recordFrame(132); recorder.markLoadComplete(200); recorder.markUsefulFrame(201);
    vi.mocked(performance.now).mockReturnValue(300);
    const report = recorder.stop();
    expect(report?.frameIntervalsMs).toMatchObject({ count: 2, median: 16, p95: 16 });
    expect(report?.evidence.gpuTiming).toContain('unavailable');
    expect(report?.evidence.loadedUrlAndHashRecorded).toBe(true);
  });

  it('exports no data before an explicit measurement', () => {
    const recorder = createRecorder();
    expect(JSON.parse(recorder.exportJson()).measurement).toBeNull();
    expect(recorder.isRecording()).toBe(false);
  });
});
