import * as THREE from 'three';

/** 解碼完成前使用透明或柔和底色，避免 Three 預設白色材質閃現。 */
export function deferredTexture(url: string, rgba = [0, 0, 0, 0]) {
  const pixel = document.createElement('canvas');
  pixel.width = pixel.height = 1;
  const context = pixel.getContext('2d')!;
  context.fillStyle = `rgba(${rgba[0]},${rgba[1]},${rgba[2]},${rgba[3] / 255})`;
  context.fillRect(0, 0, 1, 1);
  const texture = new THREE.Texture(pixel);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.needsUpdate = true;
  let ready = false;
  let pending: Promise<void> | undefined;
  return {
    texture,
    get ready() { return ready; },
    load() {
      return pending ??= new THREE.TextureLoader().loadAsync(url).then(loaded => {
        // WebGL2 texStorage2D is immutable: replacing a 1×1 image alone leaves
        // the old allocation in place. Keep the shared Texture identity (all
        // existing materials still reference it), but release its GPU storage
        // and give the decoded image a fresh Source before the next upload.
        texture.dispose();
        texture.source = new THREE.Source(loaded.image);
        texture.format = loaded.format;
        texture.type = loaded.type;
        texture.flipY = loaded.flipY;
        texture.generateMipmaps = true;
        texture.minFilter = THREE.LinearMipmapLinearFilter;
        texture.magFilter = THREE.LinearFilter;
        texture.needsUpdate = true;
        ready = true;
        loaded.dispose();
      }).catch(error => {
        // 失敗保留底色，重新整理可重試，避免逐幀重複請求。
        console.error('Texture could not be loaded', url, error);
      });
    },
  };
}
