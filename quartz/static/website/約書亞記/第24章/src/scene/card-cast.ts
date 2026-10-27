import * as THREE from 'three';
import sources from '../../scripts/figure-sources.json';
import { createFigureMaterials, createContactShadowMaterial, frameFor, fitCard, type FigureFrame } from './figure-cards';
import type { ActorId, ArmPose, CrowdMode } from './actors';
import { walkPaceCurve } from './actors';
import { ENTER_PX } from '../data/storytelling';

export interface CardActor {
  id: ActorId; labelZh?: string; group: THREE.Group; modelRoot: THREE.Group;
  armR: THREE.Group; armL: THREE.Group; heightM: number; speaking: boolean;
  headAnchor: THREE.Object3D; card: THREE.Mesh; role: string; pose: ArmPose | 'look-back';
  frame: FigureFrame;
  walkDistance: number;
}
interface CrowdMember {
  tribeIdx: number; isLeader: boolean; standX: number; standZ: number;
  entryX: number; entryZ: number; exitX: number; exitZ: number;
  mournX: number; mournZ: number; heightScale: number; phase: number;
}
const HEIGHTS: Record<ActorId, number> = {joshua:1.74, grandfather:1.66, father:1.72, mother:1.62, daughter:1.15, daughter_grown:1.56, jacob:1.72, jacob_kin:1.6, elder_1:1.7, elder_2:1.7, helper_1:1.72, helper_2:1.7, joshua_house_1:1.68, joshua_house_2:1.6};
const LABELS: Partial<Record<ActorId, string>> = {joshua:'約書亞',grandfather:'爺爺',father:'父親',daughter:'女兒',daughter_grown:'女兒',jacob:'雅各'};

export type CardCast = ReturnType<typeof createCardCast>;
export function createCardCast() {
  const root = new THREE.Group(); root.name='jos_figure_cast';
  const art=createFigureMaterials(), plane=new THREE.PlaneGeometry(1,1);
  const shadowGeo=new THREE.PlaneGeometry(1,1).rotateX(-Math.PI/2), shadowMat=createContactShadowMaterial();
  const actors={} as Record<ActorId,CardActor>;
  const actorMats: ReturnType<typeof art.make>[]=[], shadows: THREE.Mesh[]=[];
  for(const id of Object.keys(HEIGHTS) as ActorId[]){
    const group=new THREE.Group(), modelRoot=new THREE.Group(), material=art.make(false);
    actorMats.push(material);
    const card=new THREE.Mesh(plane,material.mat); modelRoot.add(card); group.add(modelRoot);
    const shadow=new THREE.Mesh(shadowGeo,shadowMat); shadow.scale.set(.85,1,.4); shadows.push(shadow); root.add(shadow);
    const headAnchor=new THREE.Object3D(); modelRoot.add(headAnchor); group.visible=false; root.add(group);
    actors[id]={id,labelZh:LABELS[id],group,modelRoot,armR:new THREE.Group(),armL:new THREE.Group(),heightM:HEIGHTS[id],speaking:false,headAnchor,card,role:sources.actors[id],pose:'idle',frame:frameFor(sources.actors[id],'stand'),walkDistance:0};
  }
  // ---- 建立十二支派群眾＋四類領袖（InstancedMesh） ----
  const members: CrowdMember[] = [];
  let seed = 2412;
  const rnd = () => ((seed = (seed * 16807) % 2147483647) / 2147483647);

  // 前排四群領袖：長老、族長、審判官、官長（第1節）
  const leaderCenters: [number, number][] = [
    [-4.8, 1.4],
    [-1.8, 1.6],
    [1.8, 1.6],
    [4.8, 1.4],
  ];
  leaderCenters.forEach(([cx, cz], gIdx) => {
    for (let k = 0; k < 5; k++) {
      const ox = (k - 2) * 0.62 + (rnd() - 0.5) * 0.18;
      const oz = (k % 2) * 0.55 + (rnd() - 0.5) * 0.15;
      const sx = cx + ox;
      const sz = cz + oz;
      members.push({
        tribeIdx: gIdx,
        isLeader: true,
        standX: sx,
        standZ: sz,
        entryX: sx * 1.15,
        entryZ: sz + 3.6,
        exitX: sx * 4.5 + (gIdx < 2 ? -22 : 22),
        exitZ: sz + 18 + rnd() * 10,
        mournX: -4 + gIdx * 2.5 + ox,
        mournZ: 4.5 + oz,
        heightScale: 0.96 + rnd() * 0.08,
        phase: rnd() * Math.PI * 2,
      });
    }
  });

  // 十二支派分區扇形（避開這一家在 (-2.8, 4.3) 的視線走廊）
  for (let t = 0; t < 12; t++) {
    const rowRing = t < 6 ? 0 : 1;
    const slotInRing = t % 6;
    const angle = t * Math.PI / 6;
    const radius = rowRing === 0 ? 8.2 : 13.8;
    const clusterX = Math.sin(angle) * radius;
    const clusterZ = -3.15 + Math.cos(angle) * radius;
    const fromEast = slotInRing >= 3;

    for (let k = 0; k < 15; k++) {
      const lx = ((k % 5) - 2) * 0.72 + (rnd() - 0.5) * 0.28;
      const lz = Math.floor(k / 5) * 0.85 + (rnd() - 0.5) * 0.25;
      let sx = clusterX + lx;
      let sz = clusterZ + lz;
      // 保留主角家庭 (-2.8, 4.3) 四周 2.2m 空位，避免遮擋對話斜拍鏡頭
      if (Math.hypot(sx - -2.8, sz - 4.3) < 2.3) {
        sx -= 2.6;
        sz += 1.4;
      }
      const dirSign = fromEast ? 1 : -1;
      members.push({
        tribeIdx: t,
        isLeader: false,
        standX: sx,
        standZ: sz,
        entryX: dirSign * (34 + rowRing * 12 + (k % 5) * 1.8),
        entryZ: 3.5 + (slotInRing - 2.5) * 2.4 + lz,
        exitX: 2.45 + Math.sin(angle) * 18,
        exitZ: -3.15 + Math.cos(angle) * 18,
        mournX: (t - 5.5) * 1.45 + lx * 0.5,
        mournZ: 6.5 + rowRing * 2.8 + lz * 0.6,
        heightScale: 0.9 + rnd() * 0.14,
        phase: rnd() * Math.PI * 2,
      });
    }
  }


  const crowdGeo=new THREE.PlaneGeometry(1,1);
  const rects=new THREE.InstancedBufferAttribute(new Float32Array(members.length*4),4);
  const fades=new THREE.InstancedBufferAttribute(new Float32Array(members.length).fill(1),1);
  crowdGeo.setAttribute('cardFade',fades);
  rects.setUsage(THREE.DynamicDrawUsage); crowdGeo.setAttribute('cardRect',rects);
  const crowdMaterial=art.make(true);
  const crowdInst=new THREE.InstancedMesh(crowdGeo,crowdMaterial.mat,members.length);
  crowdInst.instanceMatrix.setUsage(THREE.DynamicDrawUsage); crowdInst.frustumCulled=false;
  const crowdShadows=new THREE.InstancedMesh(shadowGeo,shadowMat,members.length);
  crowdShadows.instanceMatrix.setUsage(THREE.DynamicDrawUsage); crowdShadows.frustumCulled=false;
  root.add(crowdInst,crowdShadows);
  const dummy=new THREE.Object3D(), v=new THREE.Vector3(), up=new THREE.Vector3(0,1,0);
  let currentMode: CrowdMode='hidden', currentProgress=0, currentTime=0, currentMotionOff=false;
  let groundSample=(_x:number,_z:number)=>0;
  const actorList=Object.values(actors);
  let maxYawError=0, visibleCards=0;
  const visibleTribeIds = new Set<number>();
  const visibleWalkingTribeIds = new Set<number>();
  const crowdHeads: {id:string;head:THREE.Vector3;foot:THREE.Vector3}[]=[];
  function updateCrowd(mode:CrowdMode,progress:number,time:number,motionOff:boolean,ground:(x:number,z:number)=>number){
    currentMode=mode; currentProgress=progress; currentTime=time; currentMotionOff=motionOff; groundSample=ground;
  }
  const previousVisible = new Set<string>();
  const arriving = new Set<string>();
  let lastCue = '';
  let lastCrowdMode: CrowdMode = 'hidden';
  let crowdArriving = false;
  const crowdOpacity = new Float32Array(members.length);
  const opacitySamples: { id: string; opacity: number; entering: boolean }[] = [];
  function updateCards(camera:THREE.Camera,sun:THREE.Vector3,time:number,motionOff:boolean,cue:string,_progress:number,_dt:number){
    const section = document.querySelector<HTMLElement>(`section[data-cue="${cue}"]`);
    const distance = _progress * (section?.offsetHeight ?? 1400);
    const entrance = THREE.MathUtils.smoothstep(distance,0,ENTER_PX);
    if (cue !== lastCue) {
      arriving.clear();
      for (const actor of actorList) if(actor.group.visible && !previousVisible.has(actor.id)) arriving.add(actor.id);
      crowdArriving = currentMode !== 'hidden' && (lastCrowdMode === 'hidden' || currentMode === 'hillside-mourn');
      lastCue = cue;
    }
    for (const actor of actorList) if (actor.group.visible && !previousVisible.has(actor.id)) arriving.add(actor.id);
    if (currentMode !== 'hidden' && lastCrowdMode === 'hidden') crowdArriving = true;
    lastCrowdMode = currentMode;
    const returnStart = cue === 'put-away' && _progress >= .78 ? .78 : 0;
    const returnFade = THREE.MathUtils.smoothstep((_progress - returnStart) * (section?.offsetHeight ?? 1400), 0, ENTER_PX);
    previousVisible.clear();
    for (const actor of actorList) if(actor.group.visible) previousVisible.add(actor.id);
    maxYawError=0; visibleCards=0; opacitySamples.length=0;
    visibleTribeIds.clear();
    visibleWalkingTribeIds.clear();
    crowdHeads.length=0;
    camera.updateMatrixWorld(true);
    const yaw=camera.rotation.y;
    art.rimSide.value=(sun.x*Math.cos(yaw)-sun.z*Math.sin(yaw))>0?1:-1;
    art.tint.value.set(sun.x>0?'#c2a9a1':sun.y<25?'#dcb58e':'#b7b1b8');
    let actorIdx=0;
    for(const a of actorList){
      const shadow=shadows[actorIdx]; shadow.visible=a.group.visible;
      if(!a.group.visible){actorIdx++;continue;}
      const start = cue === 'elders' && a.id === 'daughter_grown' ? .48 : returnStart;
      const actorEntry = THREE.MathUtils.smoothstep((_progress - start) * (section?.offsetHeight ?? 1400), 0, ENTER_PX);
      const actorOpacity = cue === 'prologue' ? 1 : arriving.has(a.id) || start > 0 ? actorEntry : 1;
      actorMats[actorIdx].fade.value = actorOpacity;
      opacitySamples.push({ id: a.id, opacity: actorOpacity, entering: actorOpacity < 1 && (_progress - start) * (section?.offsetHeight ?? 1400) < ENTER_PX });
      let role=a.role;
      if(a.id==='daughter_grown'&&['family-6','eleazar','bones'].includes(cue))role='daughter-woman';
      const walking=a.pose==='walk';
      // Phase depends on the authored path, so reverse scroll reverses every step.
      const pathPhase=a.walkDistance/.42;
      const gait=((Math.floor(pathPhase)%2)+2)%2;
      let pose=walking?`walk-${gait+1}`:a.pose==='idle'?'stand':a.pose;
      if(cue==='family-5'&&a.id==='daughter')pose='look-back';
      const f=frameFor(role,pose); a.frame=f; actorMats[actorIdx].rect.value.fromArray(f.uv);
      const actorHeight=a.id==='daughter_grown'&&role==='daughter-teen'?HEIGHTS.daughter*1.15:a.heightM;
      const h=actorHeight*(pose==='write'?.78:1); fitCard(a.card,f,h);
      const yawToActor=Math.atan2(camera.position.x-a.group.position.x,camera.position.z-a.group.position.z);
      a.modelRoot.rotation.set(0,yawToActor-a.group.rotation.y,0);
      maxYawError=Math.max(maxYawError,Math.abs(Math.atan2(Math.sin(a.modelRoot.rotation.y+a.group.rotation.y-yawToActor),Math.cos(a.modelRoot.rotation.y+a.group.rotation.y-yawToActor)))*180/Math.PI);
      visibleCards++;
      const breath=motionOff?0:Math.sin(time*1.6+a.id.length)*.006;
      const bob=walking?Math.abs(Math.sin(pathPhase*Math.PI))*.028:breath;
      a.card.position.y+=bob;
      const sc=h/(f.foot[1]-f.head[1]); a.headAnchor.position.set((f.head[0]-f.foot[0])*sc,h+bob,0);
      shadow.position.copy(a.group.position); shadow.position.y+=.016;
      actorIdx++;
    }
    crowdInst.visible=currentMode!=='hidden' && !(currentMode==='dismiss' && currentProgress>=.84); crowdShadows.visible=crowdInst.visible;
    if(!crowdInst.visible){ crowdOpacity.fill(0); return; }
    const mode=currentMode,p=currentProgress;
    for(let i=0;i<members.length;i++){
      const m=members[i]; let x=m.standX,z=m.standZ,distance=0,walking=false,bob=0;
      const pace=walkPaceCurve(mode==='dismiss'?Math.min(1,p):p);
      if(mode==='gather'||mode==='leaders'){
        const moving=mode==='gather'?!m.isLeader:m.isLeader;
        if(moving){x=m.entryX+(m.standX-m.entryX)*pace.s;z=m.entryZ+(m.standZ-m.entryZ)*pace.s;distance=Math.hypot(m.standX-m.entryX,m.standZ-m.entryZ)*pace.s;walking=pace.stride>.05;}
        else if(mode==='gather'){x=m.entryX;z=m.entryZ;}
      }else if(mode==='dismiss'){
        const direction=m.tribeIdx*Math.PI/6;
        const exitX=2.45+Math.sin(direction)*18,exitZ=-3.15+Math.cos(direction)*18;
        x=m.standX+(exitX-m.standX)*pace.s;z=m.standZ+(exitZ-m.standZ)*pace.s;distance=Math.hypot(exitX-m.standX,exitZ-m.standZ)*pace.s;walking=pace.stride>.05;
      }else if(mode==='witness-step'&&m.isLeader){z-=Math.min(1,p*1.6)*.68;distance=Math.min(1,p*1.6)*.68;walking=p<.625;}
      else if(mode==='hillside-mourn'){x=m.mournX;z=42+m.mournZ;}
      // Keep solid silhouettes beside the camera-to-speaker corridor. Move cards
      // laterally in world space instead of leaving a translucent crowd over Joshua.
      const familyCue=cue.startsWith('family-');
      const j=familyCue?(actors.daughter.group.visible?actors.daughter:actors.daughter_grown):actors.joshua;
      const dx=j.group.position.x-camera.position.x,dz=j.group.position.z-camera.position.z;
      const rayLength=Math.hypot(dx,dz);
      if(j.group.visible && rayLength>0){
        const ux=dx/rayLength,uz=dz/rayLength;
        const along=(x-camera.position.x)*ux+(z-camera.position.z)*uz;
        const side=(x-camera.position.x)*uz-(z-camera.position.z)*ux;
        const width=familyCue?2.6:1.7;
        if(along>0 && along<rayLength*.94 && Math.abs(side)<width){
          const direction=side===0?(m.tribeIdx%2?1:-1):Math.sign(side);
          const shift=direction*(width-Math.abs(side));
          x+=uz*shift; z-=ux*shift;
        }
      }
      const cutoff=familyCue?6.2:3.5;
      const cameraDistance=Math.hypot(x-camera.position.x,z-camera.position.z);
      if(cameraDistance<cutoff){
        const angle=Math.atan2(z-camera.position.z,x-camera.position.x);
        x=camera.position.x+Math.cos(angle)*cutoff;
        z=camera.position.z+Math.sin(angle)*cutoff;
      }
      if(mode==='wave-answer')bob=Math.max(0,Math.sin(Math.max(0,p*1.4-(1-Math.min(1,(z-1)/14))*.5)*Math.PI))*.045;
      const step=Math.floor(distance/.42+m.phase)%2;
      if(walking)bob+=Math.abs(Math.sin(distance/.42*Math.PI+m.phase))*.028;
      else if(!currentMotionOff&&mode!=='cannot-hush')bob+=Math.sin(currentTime*1.4+m.phase)*.006;
      const role=walking?'crowd-walk':m.isLeader?'elders':'crowd-back';
      const reaction=mode==='cannot-hush'&&p>.42?1:0;
      const standPose=m.isLeader?`stand-${m.tribeIdx+1}`:`stand-${(i+reaction)%6+1}`;
      const f=frameFor(role,walking?`walk-${(i%2)*2+step+1}`:standPose);
      rects.setXYZW(i,...f.uv as [number,number,number,number]);
      const groupHeight=walking?sources.worldHeight['crowd-walk']:sources.worldHeight['crowd-back'];
      const h=groupHeight*m.heightScale*(mode==='dismiss'?1.28:1),sc=h/(f.foot[1]-f.head[1]),gy=groundSample(x,z);
      dummy.rotation.set(0,Math.atan2(camera.position.x-x,camera.position.z-z),0);
      dummy.position.set(x,gy,z); dummy.scale.set(1,1,1);
      v.set((f.width*.5-f.foot[0])*sc,(f.foot[1]-f.height*.5)*sc+bob,0).applyAxisAngle(up,dummy.rotation.y);
      dummy.position.add(v); dummy.scale.set(f.width*sc,f.height*sc,1);
      // Opacity depends only on the bounded entrance interval, never scroll history.
      crowdOpacity[i] = cue==='gather'?entrance:crowdArriving?returnFade:1;
      fades.setX(i,crowdOpacity[i]);
      if((mode==='hillside-mourn'&&i>48))dummy.scale.setScalar(0);
      else {
        opacitySamples.push({id:`tribe-${m.tribeIdx}-${i}`,opacity:crowdOpacity[i],entering:crowdOpacity[i]<1 && (_progress-returnStart)*(section?.offsetHeight??1400)<ENTER_PX});
        visibleCards++;
        const projected = new THREE.Vector3(x, gy + h * .5, z).project(camera);
        if (Math.abs(projected.x) <= 1 && Math.abs(projected.y) <= 1 && projected.z >= -1 && projected.z <= 1) {
          visibleTribeIds.add(m.tribeIdx);
          if (walking) visibleWalkingTribeIds.add(m.tribeIdx);
        }
        const headOffset=new THREE.Vector3((f.head[0]-f.foot[0])*sc,h+bob,0).applyAxisAngle(up,dummy.rotation.y);
        crowdHeads.push({id:`tribe-${m.tribeIdx}-${i}`,head:headOffset.add(new THREE.Vector3(x,gy,z)),foot:new THREE.Vector3(x,gy,z)});
      }
      dummy.updateMatrix(); crowdInst.setMatrixAt(i,dummy.matrix);
      dummy.position.set(x,gy+.018,z); dummy.rotation.set(0,0,0); dummy.scale.set(.72,1,.34);
      if(mode==='hillside-mourn'&&i>48)dummy.scale.setScalar(0);
      dummy.updateMatrix(); crowdShadows.setMatrixAt(i,dummy.matrix);
    }
    crowdInst.instanceMatrix.needsUpdate=true; crowdShadows.instanceMatrix.needsUpdate=true; rects.needsUpdate=true; fades.needsUpdate=true;
  }
  return {root,actors,setActorPose(id:ActorId,pose:ArmPose,_time:number,subProgress=0){actors[id].pose=pose;actors[id].walkDistance=subProgress;},updateCrowd,updateCards,
    figureAnchors(){
      if(!root.visible)return [];
      return [...actorList.filter(a=>a.group.visible).map(a=>({id:a.id,head:a.headAnchor.getWorldPosition(new THREE.Vector3()),foot:a.group.getWorldPosition(new THREE.Vector3())})),...crowdHeads];
    },
    diagnostics(){return {maxYawError,visibleCards,visibleTribes:visibleTribeIds.size,visibleWalkingTribes:visibleWalkingTribeIds.size,atlasTextures:1,crowdDrawCalls:currentMode==='hidden'?0:1,opacitySamples:root.visible?opacitySamples.map(s=>({...s})):[]};},
    async upgradeActorsFromGltf(_b64:string){},
    dispose(){plane.dispose();crowdGeo.dispose();shadowGeo.dispose();shadowMat.dispose();art.texture.dispose();for(const m of actorMats)m.mat.dispose();crowdMaterial.mat.dispose();}
  };
}
