import { AudioSynthesizer } from './AudioSynthesizer';
import type { Vector3Data } from '../types/core';

export class AudioManager {
  readonly synth = new AudioSynthesizer();
  #footstepTimer = 0;
  #lastPosition: Vector3Data = { x: 0, y: 0, z: 20 };

  async enableAudio(): Promise<void> {
    await this.synth.init();
  }

  get isMuted(): boolean {
    return this.synth.isMuted;
  }

  get volume(): number {
    return this.synth.volume;
  }

  setVolume(volume: number): void {
    this.synth.setVolume(volume);
  }

  toggleMute(): boolean {
    return this.synth.toggleMute();
  }

  updatePlayerState(position: Vector3Data, isMoving: boolean, deltaSeconds: number): void {
    if (!this.synth.isInitialized) return;

    this.synth.updateSpatialSounds(position);

    if (isMoving) {
      this.#footstepTimer += deltaSeconds;
      if (this.#footstepTimer >= 0.45) {
        this.#footstepTimer = 0;
        const isInsideTent = position.z <= 1.0 && position.z >= -10.0 && Math.abs(position.x) <= 4.5;
        this.synth.playFootstep(isInsideTent ? 'wood' : 'sand');
      }
    } else {
      this.#footstepTimer = 0.4;
    }

    this.#lastPosition = { ...position };
  }

  playClick(): void {
    this.synth.playChime('select');
  }

  playNav(): void {
    this.synth.playChime('nav');
  }

  playInspect(): void {
    this.synth.playChime('complete');
  }

  dispose(): void {
    this.synth.dispose();
  }
}
