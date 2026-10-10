// 日後的屋子（OX）：no-leaven 的室內（剖開的鄰屋，一個人把空摶麵盆擦過一遍、翻過來倒扣）與 remember 的桌邊（父親坐著說話、孩子點頭）。
// 加進 world.day 這個 Group（原點在 OX）。
import { BoxGeometry, CylinderGeometry, DoubleSide, Group, Mesh, PlaneGeometry } from 'three';
import { basinGeo, mergeParts, tableGeo, T, type Part } from './geo';
import { flatBreadGeo, shelfGeo } from './geo2';
import { FIXED, glowMat, litMat, solid } from './materials';
import { CUT, lp } from './tracks';
import { robeMat } from './props';
import { RigPerson } from './rig';
import { lerp, smooth } from './util';

const box = (w: number, h: number, d: number, x = 0, y = 0, z = 0): Part => ({ g: new BoxGeometry(w, h, d), m: T(x, y, z) });

const D = 4.6;
const SHELF_X = -1.5;
const BOWL_Y = 1.335;
const PX = -0.3;
const PZ = -3.85;

export class Home {
  group = new Group();
  /** 剖開的鄰屋（前牆拿掉，看得到裡面） */
  kitchen = new Group();
  /** remember 的桌邊 */
  table = new Group();
  private bowlG = new Group();
  private cook!: RigPerson;
  private cloth!: Mesh;
  private father!: RigPerson;
  private child!: RigPerson;
  private people: RigPerson[] = [];

  constructor() {
    this.buildKitchen();
    this.buildTable();
    this.group.add(this.kitchen, this.table);
    this.kitchen.visible = false;
    this.table.visible = false;
  }

  private buildKitchen(): void {
    const k = this.kitchen;
    k.position.set(-7.4, 0, -0.4);
    const mWall = litMat({ base: FIXED.ochre, angle: 88, angle2: 10, space: 4.8, seed: 31, cross: true });
    const mFloor = litMat({ base: '#8a6a45', angle: 4, angle2: 4, space: 5, seed: 32 });
    const mWood = litMat({ base: '#6e5433', angle: 74, angle2: 10, space: 4.4, seed: 33 });
    const W = 6;
    const H = 2.9;
    // 牆、地、頂
    k.add(solid(mergeParts([box(W + 0.6, H, 0.3, 0, H / 2, -D - 0.15), box(0.3, H, D, -W / 2 - 0.15, H / 2, -D / 2), box(0.3, H, D, W / 2 + 0.15, H / 2, -D / 2), box(W + 0.9, 0.24, D + 0.3, 0, H + 0.12, -D / 2)]), mWall, 2.6));
    const floor = new Mesh(new BoxGeometry(W, 0.1, D), mFloor);
    floor.position.set(0, -0.045, -D / 2);
    k.add(floor);
    // 屋樑
    const beams: Part[] = [];
    for (let i = 0; i < 4; i++) beams.push({ g: new CylinderGeometry(0.075, 0.075, W, 6), m: T(0, H - 0.08, -0.6 - i * 1.15, 0, 0, Math.PI / 2) });
    k.add(solid(mergeParts(beams), mWood, 1.8));

    // 後牆的窗：白天的光
    const winMat = glowMat({ hatch: 0.55, edge: '#a07a30' });
    const win = new Mesh(new PlaneGeometry(0.95, 1.05), winMat);
    win.position.set(1.65, 1.75, -D + 0.012);
    k.add(win);
    const wf = solid(mergeParts([box(1.15, 0.1, 0.12, 0, 0.58, 0), box(1.15, 0.1, 0.12, 0, -0.58, 0), box(0.1, 1.25, 0.12, -0.52, 0, 0), box(0.1, 1.25, 0.12, 0.52, 0, 0)]), mWood, 1.6);
    wf.position.set(1.65, 1.75, -D + 0.05);
    k.add(wf);
    // 窗光落在地上
    const pool = new Mesh(new PlaneGeometry(3.2, 3.2), glowMat({ pool: true }));
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(1.0, 0.03, -D + 1.7);
    pool.renderOrder = 4;
    k.add(pool);

    // 架板與摶麵盆（擦乾淨後倒扣）
    const shelf = solid(shelfGeo(2.1), mWood, 2.0);
    shelf.position.set(SHELF_X, 1.3, -D + 0.22);
    k.add(shelf);
    const bs = basinGeo();
    const mBowl = litMat({ base: '#7b5a39', angle: 20, space: 4.4, seed: 13 });
    const bowl = solid(bs.bowl, mBowl, 2.2);
    bowl.scale.setScalar(1.5);
    bowl.position.y = -0.225;
    this.bowlG.add(bowl);
    this.bowlG.position.set(SHELF_X, BOWL_Y + 0.225, -D + 0.22);
    k.add(this.bowlG);
    // 釘子上掛著擦盆的布
    const peg = new Mesh(new CylinderGeometry(0.03, 0.03, 0.2, 5), mWood);
    peg.rotation.x = Math.PI / 2;
    peg.position.set(0.9, 1.6, -D + 0.12);
    k.add(peg);
    const mCloth = litMat({ base: '#dcd2bb', angle: 10, space: 4.4, seed: 54, side: DoubleSide });
    const hang = solid(new BoxGeometry(0.3, 0.55, 0.025), mCloth, 1.5);
    hang.position.set(0.9, 1.3, -D + 0.17);
    hang.rotation.z = 0.04;
    k.add(hang);

    // 擦盆的人（背對鏡頭）：手裡握著布
    this.cook = new RigPerson({ slim: true, belt: true, armL: [0.2, 0.1], armR: [0.1, 0.12], seed: 51 }, robeMat('#8f7550', 51));
    this.cook.group.position.set(PX, 0, PZ);
    this.cook.group.rotation.y = Math.PI;
    k.add(this.cook.group);
    this.cloth = new Mesh(new BoxGeometry(0.16, 0.025, 0.12), mCloth);
    this.cook.handL.add(this.cloth);
    this.people.push(this.cook);
  }

  private buildTable(): void {
    const t = this.table;
    const mWood = litMat({ base: '#6e5433', angle: 74, angle2: 10, space: 4.4, seed: 5 });
    const tbl = solid(tableGeo(), mWood, 2.0);
    tbl.scale.setScalar(0.85);
    tbl.position.set(1.7, 0, 2.6);
    t.add(tbl);
    const mBread = litMat({ base: '#d9c690', angle: 20, space: 3.8, seed: 34, bias: 0.12 });
    const b1 = solid(flatBreadGeo(3, 0.19), mBread, 1.3);
    b1.position.set(1.35, 0.54, 2.55);
    const b2 = solid(flatBreadGeo(2, 0.18), mBread, 1.3);
    b2.position.set(1.95, 0.54, 2.7);
    b2.rotation.y = 0.7;
    t.add(b1, b2);
    // 坐墊
    const mCush = litMat({ base: '#a85b3a', angle: 40, space: 4.4, seed: 90 });
    const cush = new Mesh(new CylinderGeometry(0.4, 0.42, 0.07, 10), mCush);
    cush.position.set(0.55, 0.035, 2.65);
    t.add(cush);
    // 父親坐著，孩子站在桌的另一邊
    this.father = new RigPerson({ sit: true, slim: true, belt: true, armL: [0.9, 0.14], armR: [0.7, 0.14], seed: 61, outline: 2.4 }, robeMat('#a88758', 17));
    this.father.group.position.set(0.55, 0.07, 2.65);
    this.father.group.rotation.y = Math.PI / 2 - 0.1;
    this.child = new RigPerson({ scale: 0.58, wrap: true, armL: [0.2, 0.2], armR: [0.95, 0.3], kid: true, seed: 62 }, robeMat('#cdbf9e', 18, '#14110e', '#3a2e22'));
    this.child.group.position.set(2.85, 0, 2.75);
    this.child.group.rotation.y = -Math.PI / 2 + 0.15;
    t.add(this.father.group, this.child.group);
    this.people.push(this.father, this.child);
  }

  update(s: number, t: number, mo: boolean): void {
    const inside = s >= CUT['no-leaven'];
    this.kitchen.visible = inside;
    this.table.visible = inside;
    if (!inside) return;
    // ---- no-leaven：擦過一遍，翻過來倒扣（隨捲動）
    const p = lp(s, 'no-leaven');
    const wipe = smooth(0.04, 0.12, p) * (1 - smooth(0.46, 0.52, p));
    const flip = smooth(0.52, 0.8, p);
    const ph = p * 15;
    // 手的位置：碗口上方繞圈；翻盆時跟著碗的右緣
    const lift = Math.sin(Math.PI * flip) * 0.35;
    this.bowlG.rotation.x = Math.PI * flip;
    this.bowlG.position.y = BOWL_Y + 0.225 + lift;
    const rimX = SHELF_X + 0.45;
    const fk = smooth(0.48, 0.56, p);
    const hx = lerp(SHELF_X + Math.cos(ph) * 0.28, rimX, fk);
    const hz = -D + 0.22 + Math.sin(ph) * 0.1 * wipe;
    const hy = lerp(BOWL_Y + 0.75 + Math.sin(ph * 2) * 0.03, BOWL_Y + 0.25 + lift, fk);
    // 人的左手（+x 邊）；人轉了 π，所以世界座標的 x、z 要取反
    const sx = PX - 0.235;
    const dx = hx - (sx + 0.0);
    const dy = hy - 1.38;
    const dz = hz - PZ;
    this.cook.aim('L', -dx, dy, -dz);
    // 手不在碗上時垂下
    const useArm = smooth(0.0, 0.05, p) * (1 - smooth(0.88, 0.96, p));
    if (useArm < 0.99) {
      this.cook.swingL *= useArm;
      this.cook.splayL = lerp(0.1, this.cook.splayL, useArm);
    }
    this.cloth.visible = p < 0.5;
    this.cook.bow = 0.12 + 0.12 * Math.sin(ph) * wipe;
    this.cook.twist = 0.1 * Math.sin(ph * 0.5) * wipe;
    // ---- remember：父親說話時一隻手抬起比劃，孩子點頭
    const pr = lp(s, 'remember');
    const g1 = smooth(0.12, 0.22, pr) * (1 - smooth(0.4, 0.5, pr));
    const g2 = smooth(0.58, 0.66, pr) * (1 - smooth(0.82, 0.9, pr));
    const g = Math.max(g1, g2);
    this.father.swingR = 0.7 + g * (0.9 + 0.2 * Math.sin(pr * 40));
    this.father.splayR = 0.14 + g * 0.35;
    this.father.headYaw = 0;
    this.father.bow = 0.04 * g;
    const nod = Math.max(0, Math.sin(pr * 30)) * (smooth(0.2, 0.3, pr) * (1 - smooth(0.5, 0.58, pr)) + smooth(0.62, 0.7, pr) * (1 - smooth(0.88, 0.95, pr)));
    this.child.headPitch = 0.22 * nod;
    for (const r of this.people) r.update(t, mo);
  }
}
