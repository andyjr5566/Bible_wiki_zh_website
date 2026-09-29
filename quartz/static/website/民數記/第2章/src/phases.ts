import { MARCHES } from './data/march';
import type { MarchMode, MarchStep } from './data/march';
import type { CampId, ClanId } from './data/types';

/**
 * 拔營的階段：
 *   0 住營（雲彩在帳幕上）
 *   1 雲彩收上去（民9:17、10:11）
 *   2… 每一批出發
 *   最後一階：全部已出發
 */
export type Phase =
  | { kind: 'rest' }
  | { kind: 'cloud' }
  | { kind: 'step'; index: number; step: MarchStep }
  | { kind: 'done' };

export function phasesOf(mode: MarchMode): Phase[] {
  const steps = MARCHES[mode].steps;
  return [
    { kind: 'rest' },
    { kind: 'cloud' },
    ...steps.map((step, index) => ({ kind: 'step' as const, index, step })),
    { kind: 'done' },
  ];
}

export interface MarchView {
  cloudLifted: boolean;
  /** 已經離開的營／族 */
  goneCamps: Set<CampId>;
  goneClans: Set<ClanId>;
  /** 帳幕（院子）已拆卸 */
  tabernacleGone: boolean;
  /** 這一步正在出發的營／族 */
  goingCamps: Set<CampId>;
  goingClans: Set<ClanId>;
  goingTabernacle: boolean;
  step: MarchStep | null;
}

const tabernacleStep = (s: MarchStep) => !!s.tabernacle || !!s.clans?.includes('gershon');

export function viewAt(mode: MarchMode, phase: number): MarchView {
  const steps = MARCHES[mode].steps;
  const p = Math.max(0, Math.min(phase, steps.length + 2));
  const k = p - 2; // 目前是第幾步（負數＝還沒開始）
  const v: MarchView = {
    cloudLifted: p >= 1,
    goneCamps: new Set(), goneClans: new Set(), tabernacleGone: false,
    goingCamps: new Set(), goingClans: new Set(), goingTabernacle: false,
    step: null,
  };
  steps.forEach((s, i) => {
    const gone = i < k || p === steps.length + 2;
    if (gone) {
      s.camps?.forEach((c) => v.goneCamps.add(c));
      s.clans?.forEach((c) => v.goneClans.add(c));
      if (tabernacleStep(s)) v.tabernacleGone = true;
    } else if (i === k) {
      s.camps?.forEach((c) => v.goingCamps.add(c));
      s.clans?.forEach((c) => v.goingClans.add(c));
      if (tabernacleStep(s)) v.goingTabernacle = true;
      v.step = s;
    }
  });
  return v;
}
