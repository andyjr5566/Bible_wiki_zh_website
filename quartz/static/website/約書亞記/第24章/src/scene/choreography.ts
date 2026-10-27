import * as THREE from 'three';
import type { StoryState } from '../story/state';
import {
  type ActorId,
  type CastAndCrowdHandle,
  type CrowdMode,
  faceTargetYaw,
  walkPaceCurve,
} from './actors';
import { lonLatToMapXZ, type MemoryMapHandle } from './memory-map';
import {
  BONES_PLOT_POS,
  OAK_POS,
  SCROLL_TABLE_POS,
  type ScenePropsHandle,
  STONE_BASE_POS,
} from './props';
import type { ValleyTerrainHandle } from './terrain';

function smoothstep(a: number, b: number, x: number): number {
  const t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

export interface CameraShot {
  pos: THREE.Vector3;
  look: THREE.Vector3;
  fov: number;
  /** 太陽方位與高度（單日清晨→午後斜陽；第六幕穩定暖光不閃爍） */
  sunDir: THREE.Vector3;
  sunIntensity: number;
  hemiIntensity: number;
  windStrength: number;
}

export interface TagAnchorSpec {
  id: string;
  label: string;
  worldPos: THREE.Vector3;
  actorId?: ActorId;
}

const ALL_ACTOR_IDS: ActorId[] = [
  'joshua',
  'grandfather',
  'father',
  'mother',
  'daughter',
  'daughter_grown',
  'jacob',
  'jacob_kin',
  'elder_1',
  'elder_2',
  'helper_1',
  'helper_2',
  'joshua_house_1',
  'joshua_house_2',
];

const CUE_ORDER: string[] = [
  'prologue',
  'gather',
  'leaders',
  'before-god',
  'family-1',
  'beyond-river',
  'abraham',
  'egypt',
  'east',
  'jericho',
  'gifts',
  'family-2',
  'now',
  'three-gods',
  'my-house',
  'family-3',
  'answer-1',
  'cannot',
  'answer-2',
  'witness',
  'put-away',
  'answer-3',
  'family-4',
  'covenant',
  'write',
  'raise',
  'the-stone',
  'dismiss',
  'family-5',
  'joshua-dies',
  'elders',
  'bones',
  'eleazar',
  'family-6',
  'epilogue-diff',
  'epilogue-stone',
];

export function cueIndexOf(cue: string): number {
  const idx = CUE_ORDER.indexOf(cue);
  return idx >= 0 ? idx : 0;
}

export function createChoreographer(
  terrain: ValleyTerrainHandle,
  props: ScenePropsHandle,
  cast: CastAndCrowdHandle,
  memMap: MemoryMapHandle,
) {
  const shot: CameraShot = {
    pos: new THREE.Vector3(-3.2, 1.85, 6.2),
    look: new THREE.Vector3(0.4, 1.45, -2.5),
    fov: 42,
    sunDir: new THREE.Vector3(38, 28, 16),
    sunIntensity: 1.85,
    hemiIntensity: 0.95,
    windStrength: 1.0,
  };

  const activeTags: TagAnchorSpec[] = [];
  const tagPool: TagAnchorSpec[] = Array.from({ length: 12 }, () => ({
    id: '',
    label: '',
    worldPos: new THREE.Vector3(),
  }));
  let tagPoolUsed = 0;
  const tmpVecA = new THREE.Vector3();
  const tmpVecB = new THREE.Vector3();

  function pushTag(
    id: string,
    label: string,
    x: number,
    y: number,
    z: number,
    actorId?: ActorId,
  ): void {
    if (tagPoolUsed >= tagPool.length) {
      tagPool.push({ id: '', label: '', worldPos: new THREE.Vector3() });
    }
    const slot = tagPool[tagPoolUsed++];
    slot.id = id;
    slot.label = label;
    slot.worldPos.set(x, y, z);
    slot.actorId = actorId;
    activeTags.push(slot);
  }

  function hideAllActors(): void {
    for (const id of ALL_ACTOR_IDS) {
      const a = cast.actors[id];
      a.group.visible = false;
      a.speaking = false;
      a.group.rotation.set(0, 0, 0);
    }
  }

  function placeActor(
    id: ActorId,
    x: number,
    z: number,
    lookX: number,
    lookZ: number,
    speaking = false,
  ): void {
    const a = cast.actors[id];
    a.group.visible = true;
    a.speaking = speaking;
    const y = terrain.sampleHeight(x, z);
    a.group.position.set(x, y, z);
    faceTargetYaw(a.group, lookX, lookZ);
  }

  function placeStandardFamily(speakingWho?: 'grandfather' | 'father' | 'daughter'): void {
    placeActor('grandfather', -3.28, 4.12, -0.4, -2.0, speakingWho === 'grandfather');
    placeActor('daughter', -2.58, 4.04, -0.4, -2.0, speakingWho === 'daughter');
    placeActor('father', -1.92, 4.24, -0.4, -2.0, speakingWho === 'father');
    placeActor('mother', -3.62, 4.88, -0.4, -2.0, false);
  }

  function pushActorTag(id: ActorId): void {
    const a = cast.actors[id];
    if (!a.group.visible || a.speaking || !a.labelZh) return;
    pushTag(
      `actor-${id}`,
      a.labelZh,
      a.group.position.x,
      a.group.position.y + a.heightM + 0.18,
      a.group.position.z,
      id,
    );
  }

  function evaluate(state: StoryState, time: number): { shot: CameraShot; tags: TagAnchorSpec[] } {
    const cue = state.cue;
    const p = state.beatProgress;
    const cIdx = cueIndexOf(cue);
    const raiseIdx = cueIndexOf('raise');

    activeTags.length = 0;
    tagPoolUsed = 0;
    hideAllActors();
    props.prologueGroup.visible = false;
    props.scrollGroup.visible = false;
    props.pastPit.visible = false;
    props.pastBundle.visible = false;
    props.coffinFull.visible = false;

    // 1. 大石頭直立狀態（規則 1 前因後果：第 0..24 拍平躺在地；第 25 拍 raise 抬起；第 26..35 拍直立）
    let stoneU = 0;
    if (cIdx < raiseIdx) {
      stoneU = 0;
    } else if (cIdx === raiseIdx) {
      stoneU = state.raiseStone.done ? 1 : state.raiseStone.progress;
    } else {
      if (!state.raiseStone.done) {
        state.raiseStone.done = true;
        state.raiseStone.progress = 1;
        state.raiseStone.auto = true;
      }
      stoneU = 1;
    }
    props.setStoneUpright(stoneU);

    // 2. 光線：清晨東光 → 正午 → 第五幕午後偏西金光 → 第六幕穩定暖光（規則 5 不閃爍）
    if (cIdx <= 4) {
      shot.sunDir.set(45, 24, 14);
      shot.sunIntensity = 1.85;
      shot.hemiIntensity = 0.95;
    } else if (cIdx >= 23 && cIdx <= 28) {
      // 第五幕「當日」太陽偏西
      shot.sunDir.set(-46, 17, 18);
      shot.sunIntensity = 1.95;
      shot.hemiIntensity = 0.88;
    } else {
      shot.sunDir.set(-18, 34, 24);
      shot.sunIntensity = 1.75;
      shot.hemiIntensity = 0.98;
    }
    shot.fov = 42;
    shot.windStrength = cue === 'cannot' ? 1.35 : 0.9;

    // 3. 第六幕日月天穹繞圈（只在 elders / family-6 顯示）
    const showOrbit = cue === 'elders' || cue === 'family-6';
    const orbitTurns =
      cue === 'elders'
        ? p * 3.2 + (state.motionOff ? 0 : time * 0.04)
        : 3.2 + (state.motionOff ? 0 : time * 0.03);
    props.setOrbitPhase(orbitTurns, showOrbit);

    // 4. 第二幕記憶地圖 vs 示劍山谷空間切換
    const isMapSpace = state.space === 'map' && cue !== 'family-2';
    if (isMapSpace) {
      // 升起轉場：beyond-river 開頭由山谷平滑升空至記憶地圖
      const riseT = cue === 'beyond-river' ? Math.min(1, 0.28 + p * 0.72) : 1;
      state.mapElevation = riseT;
      memMap.setVisibility(riseT);
      props.root.visible = riseT < 0.85;
      cast.updateCrowd('hidden', p, time, state.motionOff, terrain.sampleHeight);

      memMap.update(cue, p, state.onlyI, state.sameGive, state.dark, time, state.motionOff);

      // 依第二幕各拍聚焦不同地理區域
      const mapFocus: Record<string, { lon: number; lat: number; h: number; zTilt: number }> = {
        'beyond-river': { lon: 41.8, lat: 33.8, h: 38, zTilt: 14 },
        abraham: { lon: 36.8, lat: 32.5, h: 36, zTilt: 13 },
        egypt: { lon: 32.9, lat: 30.3, h: 28, zTilt: 11 },
        east: { lon: 35.6, lat: 31.3, h: 22, zTilt: 9 },
        jericho: { lon: 35.35, lat: 32.0, h: 18, zTilt: 8 },
        gifts: { lon: 35.25, lat: 32.15, h: 20, zTilt: 8.5 },
      };
      const mf = mapFocus[cue] ?? mapFocus.gifts;
      const [fx, fz] = lonLatToMapXZ(mf.lon, mf.lat);

      if (cue === 'beyond-river' && riseT < 0.99) {
        // 從約書亞身後升起，示劍山谷縮成地圖原點
        tmpVecA.set(-0.6, 1.85, 3.8);
        tmpVecB.set(fx, mf.h, fz + mf.zTilt);
        shot.pos.lerpVectors(tmpVecA, tmpVecB, riseT);

        tmpVecA.set(-0.2, 1.5, -2.2);
        tmpVecB.set(fx, 0.2, fz);
        shot.look.lerpVectors(tmpVecA, tmpVecB, riseT);
      } else {
        shot.pos.set(fx, mf.h, fz + mf.zTilt);
        shot.look.set(fx, 0.2, fz);
      }

      if (memMap.coffinVisible) {
        pushTag(
          'coffin-map',
          '約瑟的棺材（創50:26；出13:19）',
          memMap.coffinWorldPos.x,
          memMap.coffinWorldPos.y + 0.9,
          memMap.coffinWorldPos.z,
        );
      }
      return { shot, tags: activeTags };
    }

    // 非地圖拍：收起記憶地圖（第14節 now 開頭帶一個從高處落回人群的平滑降落）
    props.root.visible = true;
    if (cue === 'now' && p < 0.35) {
      const landT = p / 0.35;
      state.mapElevation = 1 - landT;
      memMap.setVisibility((1 - landT) * 0.55);
    } else if (cue === 'three-gods') {
      state.mapElevation = 0;
      memMap.setVisibility(0);
    } else {
      state.mapElevation = 0;
      memMap.setVisibility(0);
    }

    let crowdMode: CrowdMode = 'standing';

    switch (cue) {
      case 'prologue': {
        // 序幕：一眼看見示劍山谷（以巴路山、基利心山）、泰博橡樹、平躺的大石頭與前景 6+1 石頭長條
        props.prologueGroup.visible = true;
        crowdMode = 'hidden';
        placeActor('joshua', -0.45, -2.05, 0, 4.0, false);
        cast.setActorPose('joshua', 'idle', time);

        const zoomIn = Math.min(1, p * 1.15);
        shot.pos.set(0.4 - zoomIn * 0.2, 2.25 - zoomIn * 0.45, 7.2 - zoomIn * 2.1);
        shot.look.set(1.15 + zoomIn * 0.65, 1.35 - zoomIn * 0.35, -3.1);

        pushTag('landmark-oak', '示劍的橡樹', OAK_POS.x, 5.9, OAK_POS.z);
        pushTag('landmark-stone', '大石頭（未立起）', STONE_BASE_POS.x - 1.0, 0.95, STONE_BASE_POS.z);
        break;
      }

      case 'gather': {
        // 第一幕開場：眾支派從東西谷口走入（規則 9 頭尾正常步速、中段快轉），桌機微視差
        crowdMode = 'gather';
        placeActor('joshua', -0.45, -2.05, 0, 5.0, false);
        cast.setActorPose('joshua', 'idle', time);
        placeStandardFamily();
        for (const fid of ['grandfather', 'father', 'mother', 'daughter'] as ActorId[]) {
          cast.setActorPose(fid, 'idle', time);
        }

        const px = state.motionOff ? 0 : state.pointerParallax.x * 0.55;
        const py = state.motionOff ? 0 : state.pointerParallax.y * 0.22;
        shot.pos.set(-3.4 + px, 2.05 + py, 8.2 - p * 1.4);
        shot.look.set(0.3, 1.65, -2.6);

        pushActorTag('joshua');
        pushActorTag('grandfather');
        pushActorTag('daughter');
        pushTag('landmark-stone', '橡樹旁的大石頭', STONE_BASE_POS.x - 0.9, 0.9, STONE_BASE_POS.z);
        break;
      }

      case 'leaders': {
        // 四類領袖往前走到橡樹前空地（走路跟拍）
        crowdMode = 'leaders';
        placeActor('joshua', -0.45, -2.05, 0, 3.0, false);
        cast.setActorPose('joshua', 'idle', time);
        placeStandardFamily();
        for (const fid of ['grandfather', 'father', 'mother', 'daughter'] as ActorId[]) {
          cast.setActorPose(fid, 'idle', time);
        }

        const { s, stride } = walkPaceCurve(p);
        placeActor('elder_1', -1.25, 3.6 - s * 2.2, -0.45, -2.05, false);
        placeActor('elder_2', 1.15, 3.6 - s * 2.2, -0.45, -2.05, false);
        cast.setActorPose('elder_1', stride > 0.05 ? 'walk' : 'idle', time, s * 2.2);
        cast.setActorPose('elder_2', stride > 0.05 ? 'walk' : 'idle', time, s * 2.2);

        shot.pos.set(-3.8, 1.85, 6.2 - s * 1.1);
        shot.look.set(0.0, 1.5, -1.2);
        pushActorTag('joshua');
        break;
      }

      case 'before-god': {
        // 鏡頭的家 1：從這一家站的位置看整個會眾與橡樹前的空地（不畫約櫃，一角可見躺著的大石頭）
        crowdMode = 'standing';
        placeActor('joshua', -0.45, -2.05, -0.8, 4.2, false);
        cast.setActorPose('joshua', 'idle', time);
        placeStandardFamily();
        for (const fid of ['grandfather', 'father', 'mother', 'daughter'] as ActorId[]) {
          cast.setActorPose(fid, 'idle', time);
        }

        shot.pos.set(-3.35, 1.68, 5.55);
        shot.look.set(0.35, 1.48, -2.2);
        break;
      }

      case 'family-1':
      case 'family-2': {
        // 第一幕結尾女兒拉爺爺袖子問：側面斜拍，爺爺與女兒的臉都看得到，說話者收起名牌
        crowdMode = 'standing';
        if (cue === 'family-1') {
          placeActor('joshua', -0.45, -2.05, 0, 4.0, false);
          cast.setActorPose('joshua', 'idle', time);
        }

        placeActor('grandfather', -3.25, 4.12, -2.55, 4.05, true);
        placeActor('daughter', -2.52, 4.05, -3.25, 4.12, true);
        placeActor('father', -1.82, 4.35, -2.8, 4.1, false);
        placeActor('mother', -3.72, 4.95, -2.8, 4.1, false);

        cast.setActorPose('daughter', cue === 'family-1' ? 'pull-sleeve' : 'speak', time);
        cast.setActorPose('grandfather', 'point', time);
        cast.setActorPose('father', 'idle', time);
        cast.setActorPose('mother', 'idle', time);

        shot.pos.set(-2.85, 1.68, 7.65);
        shot.look.set(-2.75, 1.05, 4.08);
          if (cue === 'family-2') {
            shot.pos.set(-4.2, 2.0, 7.5);
            shot.look.set(-2.88, 1.28, 4.08);
          }
        pushActorTag('father');
        break;
      }

      case 'now': {
        // 第三幕第14節：從高處記憶地圖落回人群前（人的高度）
        crowdMode = 'standing';
        placeActor('joshua', -0.45, -2.05, -1.2, 4.2, true);
        cast.setActorPose('joshua', 'speak', time);
        placeStandardFamily();
        for (const fid of ['grandfather', 'father', 'mother', 'daughter'] as ActorId[]) {
          cast.setActorPose(fid, 'idle', time);
        }

        const landT = Math.min(1, p / 0.35);
        tmpVecA.set(0, 16.5, 9.5);
        tmpVecB.set(-2.95, 1.68, 5.1);
        shot.pos.lerpVectors(tmpVecA, tmpVecB, landT);

        tmpVecA.set(0, 0.8, -1.5);
        tmpVecB.set(-0.35, 1.5, -2.0);
        shot.look.lerpVectors(tmpVecA, tmpVecB, landT);
        break;
      }

      case 'three-gods': {
        crowdMode = 'standing';
        placeActor('joshua', -0.45, -2.05, -0.5, 4.5, true);
        cast.setActorPose('joshua', 'speak', time);
        placeStandardFamily();
        for (const fid of ['grandfather', 'father', 'mother', 'daughter'] as ActorId[]) {
          cast.setActorPose(fid, 'idle', time);
        }
        shot.pos.set(-3.4, 1.72, 4.6);
        shot.look.set(-0.2, 1.55, -2.2);
        break;
      }

      case 'my-house': {
        // 第15節「至於我和我家」：約書亞的家人走到他身邊面向會眾
        crowdMode = 'standing';
        placeActor('joshua', -0.45, -2.05, -0.4, 4.5, true);
        cast.setActorPose('joshua', 'speak', time);

        const stepIn = Math.min(1, p * 1.4);
        placeActor('joshua_house_1', -1.85 + stepIn * 0.55, -2.55 + stepIn * 0.35, 0, 4.5, false);
        placeActor('joshua_house_2', -2.35 + stepIn * 0.55, -2.45 + stepIn * 0.35, 0, 4.5, false);
        cast.setActorPose('joshua_house_1', stepIn < 0.95 ? 'walk' : 'idle', time, stepIn * Math.hypot(.55, .35));
        cast.setActorPose('joshua_house_2', stepIn < 0.95 ? 'walk' : 'idle', time, stepIn * Math.hypot(.55, .35));

        placeStandardFamily();
        for (const fid of ['grandfather', 'father', 'mother', 'daughter'] as ActorId[]) {
          cast.setActorPose(fid, 'idle', time);
        }

        shot.pos.set(-4.4, 2.9, 7.4);
        shot.look.set(-0.85, 1.05, -1.1);
        break;
      }

      case 'family-3': {
        crowdMode = 'standing';
        placeActor('joshua', -0.45, -2.05, 0, 4.5, false);
        cast.setActorPose('joshua', 'idle', time);

        placeActor('grandfather', -3.32, 4.18, -2.2, 4.15, false);
        placeActor('daughter', -2.58, 4.05, -1.92, 4.24, true);
        placeActor('father', -1.92, 4.24, -2.58, 4.05, true);
        placeActor('mother', -3.65, 4.9, -2.3, 4.2, false);

        cast.setActorPose('daughter', 'speak', time);
        cast.setActorPose('father', 'speak', time);
        cast.setActorPose('grandfather', 'idle', time);
        cast.setActorPose('mother', 'idle', time);

        shot.pos.set(-2.25, 1.68, 7.65);
        shot.look.set(-2.25, 1.05, 4.12);
        pushActorTag('grandfather');
        break;
      }

      case 'answer-1':
      case 'answer-2':
      case 'answer-3': {
        // 第四幕百姓回答：側面斜拍，約書亞與前排／這一家的臉同時可見，聲浪由後推前
        crowdMode = 'wave-answer';
        placeActor('joshua', -0.45, -2.05, -1.2, 3.5, false);
        cast.setActorPose('joshua', 'idle', time);
        placeStandardFamily('father');
        cast.setActorPose('father', 'speak', time);
        cast.setActorPose('grandfather', 'speak', time);
        cast.setActorPose('daughter', 'idle', time);
        cast.setActorPose('mother', 'idle', time);

        shot.pos.set(-4.65, 1.72, 2.35);
        shot.look.set(-0.25, 1.48, 0.35);
        pushActorTag('joshua');
        break;
      }

      case 'cannot': {
        // ★招牌高潮：第19節的安靜——鏡頭推進約書亞，人群靜止後轉頭互看
        crowdMode = 'cannot-hush';
        placeActor('joshua', -0.45, -2.05, -1.1, 1.8, true);
        cast.setActorPose('joshua', 'speak', time);
        placeStandardFamily();
        for (const fid of ['grandfather', 'father', 'mother', 'daughter'] as ActorId[]) {
          cast.setActorPose(fid, 'idle', time);
        }

        const push = Math.min(1, p / 0.52);
        const smoothPush = push * push * (3 - 2 * push);
        shot.pos.set(-3.4 + smoothPush * 0.5, 2.2, 5.0 - smoothPush * 0.8);
        shot.look.set(-0.45, 1.0, -2.02);
        shot.fov = 39;
        break;
      }

      case 'witness': {
        // 第22節：前排長老往前踏一步作見證（不舉手宣誓）
        crowdMode = 'witness-step';
        placeActor('joshua', -0.45, -2.05, 0, 2.0, true);
        cast.setActorPose('joshua', 'speak', time);

        const step = Math.min(1, p * 1.5);
        placeActor('elder_1', -1.35, 1.35 - step * 0.65, -0.45, -2.05, true);
        placeActor('elder_2', 0.85, 1.35 - step * 0.65, -0.45, -2.05, true);
        cast.setActorPose('elder_1', 'idle', time);
        cast.setActorPose('elder_2', 'idle', time);

        placeStandardFamily();
        for (const fid of ['grandfather', 'father', 'mother', 'daughter'] as ActorId[]) {
          cast.setActorPose(fid, 'idle', time);
        }

        shot.pos.set(-3.9, 1.66, 1.65);
        shot.look.set(-0.2, 1.46, -0.55);
        break;
      }

      case 'put-away': {
        // 第23節「從前」（創35:2,4）：暖棕回憶色，同一棵橡樹下雙手遞交神像包裹與耳環並埋入土中
        // 前 75% 為創35「從前」，最後 25% 轉回書24「現在」（現在無人交出或偷藏任何東西）
        if (p < 0.78) {
          const sub = p / 0.78;
          state.pastBlend = 1;
          crowdMode = 'hidden';
          props.pastPit.visible = true;
          props.pastBundle.visible = true;

          placeActor('jacob', -0.35, -2.55, -1.35, -1.45, false);
          placeActor('jacob_kin', -1.42, -1.38, -0.35, -2.55, false);

          if (sub < 0.5) {
            // 雙手遞交（規則 10：交東西要看得見雙手遞交）
            const handT = sub / 0.5;
            cast.setActorPose('jacob_kin', 'hand-over', time);
            cast.setActorPose('jacob', 'hand-over', time);
            props.pastBundle.position.set(
              -1.12 + handT * 0.44,
              1.06 + Math.sin(handT * Math.PI) * 0.05,
              -1.68 - handT * 0.48,
            );
          } else {
            // 雅各轉向橡樹根部土坑，蹲身埋下（規則 4：動作正面清楚可見）
            const buryT = (sub - 0.5) / 0.5;
            faceTargetYaw(cast.actors.jacob.group, props.pastPit.position.x, props.pastPit.position.z);
            cast.actors.jacob.group.position.y = terrain.sampleHeight(-0.35, -2.55) - buryT * 0.26;
            cast.setActorPose('jacob', 'receive-bury', time, 0.5 + buryT * 0.5);
            cast.setActorPose('jacob_kin', 'idle', time);
            props.pastBundle.position.set(
              -0.68 - buryT * 0.16,
              1.02 - buryT * 0.92,
              -2.16 - buryT * 0.46,
            );
          }

          shot.pos.set(1.65, 1.46, -0.15);
          shot.look.set(-0.85, 1.05, -2.15);
          pushActorTag('jacob');
        } else {
          state.pastBlend = Math.max(0, 1 - (p - 0.78) / 0.22);
          crowdMode = 'standing';
          placeActor('joshua', -0.45, -2.05, -0.8, 3.8, true);
          cast.setActorPose('joshua', 'speak', time);
          placeStandardFamily();
          for (const fid of ['grandfather', 'father', 'mother', 'daughter'] as ActorId[]) {
            cast.setActorPose(fid, 'idle', time);
          }
          shot.pos.set(-3.2, 1.65, 3.8);
          shot.look.set(-0.45, 1.48, -2.05);
        }
        break;
      }

      case 'family-4': {
        state.pastBlend = 0;
        crowdMode = 'standing';
        placeActor('joshua', -0.45, -2.05, 0, 4.5, false);
        cast.setActorPose('joshua', 'idle', time);

        placeActor('grandfather', -3.32, 4.18, -2.2, 4.15, false);
        placeActor('daughter', -2.58, 4.05, -1.92, 4.24, true);
        placeActor('father', -1.92, 4.24, -2.58, 4.05, true);
        placeActor('mother', -3.65, 4.9, -2.3, 4.2, false);

        cast.setActorPose('daughter', 'speak', time);
        cast.setActorPose('father', 'speak', time);
        cast.setActorPose('grandfather', 'idle', time);
        cast.setActorPose('mother', 'idle', time);

        shot.pos.set(-2.25, 1.68, 9.0);
        shot.look.set(-2.25, 1.05, 4.12);
        break;
      }

      case 'covenant': {
        // 第五幕第25節：「當日」太陽偏西，在示劍立約
        crowdMode = 'standing';
        placeActor('joshua', -0.45, -2.05, 0, 4.0, true);
        cast.setActorPose('joshua', 'speak', time);
        placeStandardFamily();
        for (const fid of ['grandfather', 'father', 'mother', 'daughter'] as ActorId[]) {
          cast.setActorPose(fid, 'idle', time);
        }

        shot.pos.set(-4.8, 2.8, 7.0);
        shot.look.set(0.05, 1.0, -1.25);
        break;
      }

      case 'write': {
        // 第26節上：使用約書亞持筆書寫的坐姿剪影；隱藏獨立木案，避免遮住手和紙卷。
        crowdMode = 'standing';
        props.scrollGroup.visible = false;
        placeActor('joshua', SCROLL_TABLE_POS.x, SCROLL_TABLE_POS.z - 0.62, SCROLL_TABLE_POS.x, 1.0, false);
        cast.setActorPose('joshua', 'write', time, p);

        // 蘆葦筆隨右手橫移，墨跡逐行出現
        const activeRow = Math.floor(p * 4.99);
        const rowSweep = ((p * 5) % 1) * 0.44 - 0.22;
        props.reedPen.position.set(rowSweep, 1.08, -0.14 + activeRow * 0.07);
        props.scrollGroup.children.forEach((ch) => {
          if (typeof ch.userData.inkRow === 'number') {
            ch.visible = ch.userData.inkRow <= activeRow;
          }
        });

        shot.pos.set(SCROLL_TABLE_POS.x + 0.85, 1.62, SCROLL_TABLE_POS.z + 1.52);
        shot.look.set(SCROLL_TABLE_POS.x, 1.1, SCROLL_TABLE_POS.z - 0.05);
        shot.fov = 38;
        pushActorTag('joshua');
        break;
      }

      case 'raise': {
        // ★招牌互動：按住把大石頭立在橡樹下（約書亞在前指引，兩人雙手托推大石頭，無「壯丁」字樣與台詞）
        crowdMode = 'standing';
        placeActor('joshua', 0.68, -2.25, STONE_BASE_POS.x, STONE_BASE_POS.z, false);
        cast.setActorPose('joshua', 'point', time);

        const liftX = STONE_BASE_POS.x - 1.35 + stoneU * 0.68;
        placeActor('helper_1', liftX, STONE_BASE_POS.z + 0.36, STONE_BASE_POS.x, STONE_BASE_POS.z, false);
        placeActor('helper_2', STONE_BASE_POS.x + 0.95 - stoneU * 0.3, STONE_BASE_POS.z - 0.36, STONE_BASE_POS.x, STONE_BASE_POS.z, false);
        cast.setActorPose('helper_1', stoneU < 0.99 ? 'push-stone' : 'idle', time, stoneU);
        cast.setActorPose('helper_2', stoneU < 0.99 ? 'push-stone' : 'idle', time, stoneU);

        shot.pos.set(5.7, 2.8, 4.8);
        shot.look.set(1.15, 1.0, -2.65);
        pushActorTag('joshua');
        break;
      }

      case 'the-stone': {
        // 鏡頭的家 2（石頭旁）：第27節約書亞指著立好的大石頭說話（石頭不發光、無刻字）
        crowdMode = 'standing';
        placeActor('joshua', 0.72, -2.35, STONE_BASE_POS.x, STONE_BASE_POS.z, true);
        cast.setActorPose('joshua', 'point', time);
        placeStandardFamily();
        for (const fid of ['grandfather', 'father', 'mother', 'daughter'] as ActorId[]) {
          cast.setActorPose(fid, 'idle', time);
        }

        shot.pos.set(4.35, 1.58, -0.55);
        shot.look.set(1.55, 1.38, -2.85);
        pushTag('landmark-stone-up', '見證的大石頭', STONE_BASE_POS.x, 2.65, STONE_BASE_POS.z);
        break;
      }

      case 'dismiss': {
        // 第28節：鏡頭留在石頭旁，看眾人四散歸回地業；約書亞等眾人先走，最後才離開
        crowdMode = 'dismiss';
        if (p < 0.84) {
          placeActor('joshua', 0.45, -2.15, 0, 5.0, false);
          cast.setActorPose('joshua', 'idle', time);
        } else {
          const jWalk = (p - 0.84) / 0.16;
          const { s, stride } = walkPaceCurve(jWalk);
          placeActor('joshua', 0.45 - s * 12, -2.15 - s * 9, -18, -15, false);
          cast.setActorPose('joshua', stride > 0.05 ? 'walk' : 'idle', time, s * 15);
        }

        // 稍高的斜俯角把十二群人與散場方向留在同一畫面裡。
        shot.pos.set(STONE_BASE_POS.x, 20, STONE_BASE_POS.z + 14);
        shot.look.set(STONE_BASE_POS.x, 1.3, STONE_BASE_POS.z);
        shot.fov = 76;
        break;
      }

      case 'family-5': {
        // 鏡頭留在石頭旁：這一家走在回家路上，女兒轉身回頭看石頭提問
        crowdMode = 'hidden';
        const walkT = Math.min(1, p * 0.65);
        const fx = -2.6 - walkT * 2.2;
        const fz = 3.2 + walkT * 2.1;

        placeActor('grandfather', fx - 0.85, fz + 0.35, fx - 3, fz + 2, false);
        placeActor('mother', fx - 0.45, fz + 0.85, fx - 3, fz + 2, false);
        placeActor('father', fx + 0.35, fz + 0.1, STONE_BASE_POS.x, STONE_BASE_POS.z, true);
        placeActor('daughter', fx + 0.95, fz - 0.25, STONE_BASE_POS.x, STONE_BASE_POS.z, true);

        cast.setActorPose('grandfather', 'walk', time, walkT * Math.hypot(2.2, 2.1));
        cast.setActorPose('mother', 'walk', time, walkT * Math.hypot(2.2, 2.1));
        cast.setActorPose('father', 'point', time);
        cast.setActorPose('daughter', 'walk', time, walkT * Math.hypot(2.2, 2.1));

        shot.pos.set(3.85, 1.56, -1.35);
        shot.look.set(-1.2, 1.32, 1.8);
        break;
      }

      case 'joshua-dies': {
        // 第29-30節：剪接（不飛越場景）至以法蓮山地的亭拿西拉山坡（不畫墓的樣式）
        crowdMode = 'hillside-mourn';
        const hx = -1.2;
        const hz = 43.5;
        // 前四成：送葬的人沿山坡走上來；之後站定。鏡頭整拍從遠處慢慢推近，畫面一直有變化。
        const climb = smoothstep(0, 0.4, p);
        const up = (1 - climb) * 3.2;
        const mourners: [ActorId, number, number][] = [
          ['elder_1', hx - 0.9, hz], ['elder_2', hx + 0.9, hz + 0.2], ['grandfather', hx - 2.1, hz + 0.9],
          ['father', hx - 1.35, hz + 1.1], ['daughter', hx - 0.65, hz + 1.0],
        ];
        for (const [id, x, z] of mourners) {
          placeActor(id, x, z - up, x, z + 4, false);
          cast.setActorPose(id, climb < 0.98 ? 'walk' : 'idle', time, climb * 3.2);
        }

        const dolly = smoothstep(0, 1, p);
        const camX = -9.6 + dolly * 3.8;
        const camZ = 34.6 + dolly * 4.6;
        const camY = terrain.sampleHeight(camX, camZ) + 2.6 - dolly * 0.92;
        const lookY = terrain.sampleHeight(hx, hz + 2) + 1.35;
        shot.pos.set(camX, camY, camZ);
        shot.look.set(hx + 0.4, lookY, hz + 2.2);
        pushTag('hill-timnath', '以法蓮山地・亭拿西拉（示意山坡）', hx, lookY + 1.2, hz + 1.5);
        break;
      }

      case 'elders': {
        // 第31節：回到石頭旁的家，太陽月亮在天上繞圈（畫面明暗穩定不閃爍）；幾輪後爺爺不再出現，女兒長高
        crowdMode = 'hidden';
        if (p < 0.48) {
          placeActor('grandfather', 0.45, -1.25, STONE_BASE_POS.x, STONE_BASE_POS.z, false);
          placeActor('father', -0.35, -1.05, STONE_BASE_POS.x, STONE_BASE_POS.z, false);
          placeActor('mother', -1.05, -1.35, STONE_BASE_POS.x, STONE_BASE_POS.z, false);
          placeActor('daughter', 0.15, -0.75, STONE_BASE_POS.x, STONE_BASE_POS.z, false);
          for (const id of ['grandfather', 'father', 'mother', 'daughter'] as ActorId[]) {
            cast.setActorPose(id, 'idle', time);
          }
          pushActorTag('grandfather');
        } else {
          // 爺爺不再出現（不演死亡），長大的女兒與父母站在石頭前
          placeActor('father', -0.25, -1.1, STONE_BASE_POS.x, STONE_BASE_POS.z, false);
          placeActor('mother', -0.98, -1.35, STONE_BASE_POS.x, STONE_BASE_POS.z, false);
          placeActor('daughter_grown', 0.42, -0.92, STONE_BASE_POS.x, STONE_BASE_POS.z, false);
          cast.setActorPose('father', 'idle', time);
          cast.setActorPose('mother', 'idle', time);
          cast.setActorPose('daughter_grown', 'idle', time);
        }

        // 放低視角，石頭、橡樹、家人與天上繞圈的日月同框，且 look.y 維持在人的高度區間
        shot.pos.set(4.15, 1.44, 1.25);
        shot.look.set(0.65, 2.35, -4.2);
        break;
      }

      case 'bones': {
        // 第32節：從第二幕一路同行的約瑟棺材安葬在示劍雅各所買的那塊地
        crowdMode = 'hidden';
        props.coffinFull.visible = true;
        const approach = Math.min(1, p * 1.4);
        const cx = BONES_PLOT_POS.x - (1 - approach) * 1.6;
        const cy = terrain.sampleHeight(cx, BONES_PLOT_POS.z) + (1 - approach) * 0.42;
        props.coffinFull.position.set(cx, cy, BONES_PLOT_POS.z);

        placeActor('father', cx - 1.25, BONES_PLOT_POS.z + 0.1, STONE_BASE_POS.x, STONE_BASE_POS.z, false);
        placeActor('elder_1', cx + 1.25, BONES_PLOT_POS.z + 0.1, BONES_PLOT_POS.x, BONES_PLOT_POS.z, false);
        placeActor('daughter_grown', BONES_PLOT_POS.x + 1.5, BONES_PLOT_POS.z + 1.35, cx, BONES_PLOT_POS.z, false);
        cast.setActorPose('father', approach < 0.95 ? 'carry-pole' : 'idle', time);
        cast.setActorPose('elder_1', approach < 0.95 ? 'carry-pole' : 'idle', time);
        cast.setActorPose('daughter_grown', 'idle', time);

        shot.pos.set(-0.65, 1.62, 2.25);
        shot.look.set(BONES_PLOT_POS.x + 0.4, 1.05, BONES_PLOT_POS.z - 0.2);
        pushTag('coffin-burial', '約瑟的骸骨（創50:25；書24:32）', cx, cy + 0.95, BONES_PLOT_POS.z);
        break;
      }

      case 'eleazar': {
        // 第33節：剪接至非尼哈在以法蓮山地所得的小山（不畫墳墓樣式）
        crowdMode = 'hidden';
        const ex = 14.5;
        const ez = 41.0;
        placeActor('elder_1', ex - 0.8, ez, ex, ez - 5, false);
        placeActor('elder_2', ex + 0.8, ez + 0.25, ex, ez - 5, false);
        placeActor('father', ex - 1.6, ez + 1.1, ex, ez - 5, false);
        placeActor('daughter_grown', ex - 0.9, ez + 1.2, ex, ez - 5, false);
        for (const id of ['elder_1', 'elder_2', 'father', 'daughter_grown'] as ActorId[]) {
          cast.setActorPose(id, 'idle', time);
        }

        // 鏡頭從小山下方慢慢升上來，畫面整拍都在移動
        const rise = smoothstep(0, 1, p);
        const cx = ex + 7.2 - rise * 2.4;
        const cz = ez - 7.4 + rise * 3.2;
        const camY = terrain.sampleHeight(cx, cz) + 1.2 + rise * 0.5;
        const lookY = terrain.sampleHeight(ex, ez) + 1.35;
        shot.pos.set(cx, camY, cz);
        shot.look.set(ex - 0.3, lookY, ez + 0.5);
        pushTag('hill-phinehas', '非尼哈所得的小山（示意山坡）', ex, lookY + 1.2, ez);
        break;
      }

      case 'family-6': {
        // 第六幕結尾：長大的女兒與父親站在石頭旁問答（爺爺不再出現）
        crowdMode = 'hidden';
        placeActor('father', 0.35, -1.25, 1.15, -0.85, true);
        placeActor('daughter_grown', 1.15, -0.85, 0.35, -1.25, true);
        placeActor('mother', -0.45, -1.55, 0.75, -1.05, false);

        cast.setActorPose('father', 'speak', time);
        cast.setActorPose('daughter_grown', 'speak', time);
        cast.setActorPose('mother', 'idle', time);

        shot.pos.set(3.85, 1.54, 0.95);
        shot.look.set(0.95, 1.38, -1.55);
        break;
      }

      case 'epilogue-diff':
      case 'epilogue-stone':
      default: {
        // 終幕收尾：橡樹下的石頭，沒有人
        crowdMode = 'hidden';
        const pullBack = cue === 'epilogue-stone' ? 0.85 : 0;
        shot.pos.set(4.15 + pullBack * 0.6, 1.56 + pullBack * 0.12, 0.55 + pullBack * 0.9);
        shot.look.set(1.15, 1.42, -3.45);
        break;
      }
    }

    if (cue !== 'put-away') {
      state.pastBlend = 0;
    }

    // 橫向短畫面從前排左側的空地看向對話雙方，避開低機位前景人群。
    // 保留每拍人物與動作；不把約書亞背後補成另一排聽眾。
    if (window.innerHeight <= 520 && window.innerWidth > window.innerHeight &&
      ['three-gods', 'my-house', 'answer-1', 'answer-2', 'witness', 'answer-3', 'covenant'].includes(cue)) {
      shot.pos.set(-3.4, terrain.sampleHeight(-3.4, 2.2) + 2.45, 2.2);
      shot.look.set(-0.7, terrain.sampleHeight(-0.7, -1.3) + 1.05, -1.3);
      shot.fov = 48;
    }

    cast.updateCrowd(crowdMode, p, time, state.motionOff, terrain.sampleHeight);
    return { shot, tags: activeTags };
  }

  return { evaluate };
}
