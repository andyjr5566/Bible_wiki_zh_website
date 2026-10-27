import * as THREE from 'three';
import { afterEach, expect, it, vi } from 'vitest';
import { deferredTexture } from './texture';

afterEach(() => { vi.restoreAllMocks(); vi.unstubAllGlobals(); });

it('貼圖晚到時保留既有材質參照，釋放1×1儲存空間並換上完整圖像', async () => {
  vi.stubGlobal('document', { createElement: () => ({ width: 1, height: 1, getContext: () => ({ fillRect() {}, fillStyle: '' }) }) });
  let finish!: (texture: THREE.Texture) => void;
  const loader = vi.spyOn(THREE.TextureLoader.prototype, 'loadAsync').mockImplementation(() => new Promise(resolve => { finish = resolve; }));
  const slot = deferredTexture('atlas.webp');
  const material = new THREE.MeshBasicMaterial({ map: slot.texture });
  const copy = material.clone();
  const originalSource = slot.texture.source;
  const disposed = vi.fn();
  slot.texture.addEventListener('dispose', disposed);
  slot.texture.repeat.set(2, 3);
  const pending = slot.load();
  expect(slot.load()).toBe(pending);
  expect(slot.ready).toBe(false);
  const decoded = new THREE.Texture({ width: 4096, height: 4096 } as HTMLImageElement);
  finish(decoded);
  await pending;
  expect(loader).toHaveBeenCalledTimes(1);
  expect(disposed).toHaveBeenCalledTimes(1);
  expect(slot.texture.source).not.toBe(originalSource);
  expect(slot.texture.image).toBe(decoded.image);
  expect(material.map).toBe(slot.texture);
  expect(copy.map).toBe(slot.texture);
  expect(slot.texture.repeat.toArray()).toEqual([2, 3]);
  expect(slot.ready).toBe(true);
});
