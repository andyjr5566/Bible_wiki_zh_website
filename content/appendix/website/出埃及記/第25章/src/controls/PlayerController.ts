import type { InputState } from '../types/input';
import type { Vector3Data } from '../types/core';

export interface PlayerPose {
  position: Vector3Data;
  yaw: number;
  pitch: number;
}

export interface PlayerController {
  spawn(pose: PlayerPose): void;
  update(deltaSeconds: number, input: Readonly<InputState>): void;
  teleport(pose: PlayerPose): void;
  getPose(): PlayerPose;
  isMoving(): boolean;
  setEnabled(enabled: boolean): void;
  dispose(): void;
}

export type MovementConstraint = (previous: Vector3Data, desired: Vector3Data) => Vector3Data;

export class BasicPlayerController implements PlayerController {
  #pose: PlayerPose = { position: { x: 0, y: 1.7, z: 0 }, yaw: 0, pitch: 0 };
  #enabled = false;
  #moving = false;

  constructor(readonly constrain: MovementConstraint = (_previous, desired) => desired) {}

  spawn(pose: PlayerPose): void {
    this.#pose = structuredClone(pose);
  }

  update(deltaSeconds: number, input: Readonly<InputState>): void {
    if (!this.#enabled) {
      this.#moving = false;
      return;
    }

    const speed = (input.sprint ? 5.2 : 3.0) * deltaSeconds;
    this.#pose.yaw -= input.lookX;
    this.#pose.pitch = Math.max(-1.25, Math.min(1.25, this.#pose.pitch - input.lookY));

    const inputMagnitude = Math.hypot(input.moveX, input.moveY);
    this.#moving = inputMagnitude > 0.05;

    if (!this.#moving) return;

    const magnitude = Math.max(1, inputMagnitude);
    const forwardX = Math.sin(this.#pose.yaw);
    const forwardZ = -Math.cos(this.#pose.yaw);
    const rightX = Math.cos(this.#pose.yaw);
    const rightZ = Math.sin(this.#pose.yaw);
    const previous = { ...this.#pose.position };
    const desired = {
      x: previous.x + (forwardX * input.moveY + rightX * input.moveX) * speed / magnitude,
      y: previous.y,
      z: previous.z + (forwardZ * input.moveY + rightZ * input.moveX) * speed / magnitude,
    };
    this.#pose.position = this.constrain(previous, desired);
  }

  isMoving(): boolean {
    return this.#enabled && this.#moving;
  }

  teleport(pose: PlayerPose): void {
    this.#pose = structuredClone(pose);
  }

  getPose(): PlayerPose {
    return structuredClone(this.#pose);
  }

  setEnabled(enabled: boolean): void {
    this.#enabled = enabled;
    if (!enabled) this.#moving = false;
  }

  dispose(): void {
    this.#enabled = false;
    this.#moving = false;
  }
}
