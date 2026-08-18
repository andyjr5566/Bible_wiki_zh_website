import { EventChannel, type Unsubscribe } from '../utils/EventChannel';
import type { Vector3Data } from '../types/core';
import type { DimensionUnit } from '../scene/DimensionVisualizer';

export interface CinematicAct {
  id: string;
  actNumber: number;
  totalActs: number;
  title: string;
  subtitle: string;
  scriptureReference: string;
  scriptureText: string;
  hebrewTerm?: string;
  durationSeconds: number;
  cameraStart: { position: Vector3Data; target: Vector3Data; fov: number };
  cameraEnd: { position: Vector3Data; target: Vector3Data; fov: number };
  dimensionTargetId?: string;
  peelRoof?: boolean;
}

export interface CinematicState {
  isPlaying: boolean;
  isPaused: boolean;
  currentActIndex: number;
  currentAct: CinematicAct;
  progressRatio: number; // 0 to 1 in current act
  playbackSpeed: number; // 1x or 1.5x
  showDimensions: boolean;
  dimensionUnit: DimensionUnit;
}

export const CINEMATIC_ACTS: CinematicAct[] = [
  {
    id: 'act-1-overview',
    actNumber: 1,
    totalActs: 8,
    title: '第一幕：曠野中的聖所與東門',
    subtitle: 'Outer Court & The East Gate',
    scriptureReference: '出埃及記 27:9–19',
    hebrewTerm: 'חֲצַר הַמִּשְׁכָּן (Chatzar HaMishkan · 會幕外院)',
    scriptureText:
      '你要做帳幕的院子。院子的南面當用撚的細麻做帷子... 院子的門當有簾子，長二十肘，要拿藍色、紫色、朱紅色線，和撚的細麻，用繡花的手工織成... 院子要長一百肘，寬五十肘，高五肘。',
    durationSeconds: 10,
    cameraStart: { position: { x: 18, y: 15, z: 32 }, target: { x: 0, y: 1.5, z: 0 }, fov: 52 },
    cameraEnd: { position: { x: 0, y: 3.2, z: 24 }, target: { x: 0, y: 1.4, z: 10 }, fov: 46 },
    dimensionTargetId: 'outer-court',
    peelRoof: false,
  },
  {
    id: 'act-2-burnt-altar',
    actNumber: 2,
    totalActs: 8,
    title: '第二幕：燔祭壇 · 代贖與奉獻之處',
    subtitle: 'Altar of Burnt Offering',
    scriptureReference: '出埃及記 27:1–8',
    hebrewTerm: 'מִזְבַּח הָעֹלָה (Mizbeach HaOlah · 燔祭壇)',
    scriptureText:
      '你要用皂莢木做壇。這壇要四方的，長五肘，寬五肘，高三肘。要在壇的四角上做四個角，與壇接連一塊，用銅把壇包裹... 要照著在山上指示你的樣式做。',
    durationSeconds: 11,
    cameraStart: { position: { x: 3.2, y: 2.6, z: 15.5 }, target: { x: 0, y: 1.1, z: 9.0 }, fov: 44 },
    cameraEnd: { position: { x: 1.5, y: 2.0, z: 12.0 }, target: { x: 0, y: 1.05, z: 9.0 }, fov: 40 },
    dimensionTargetId: 'burnt-altar',
    peelRoof: false,
  },
  {
    id: 'act-3-laver',
    actNumber: 3,
    totalActs: 8,
    title: '第三幕：銅洗濯盆 · 聖潔與洗淨',
    subtitle: 'The Bronze Laver',
    scriptureReference: '出埃及記 30:17–21',
    hebrewTerm: 'כִּיּוֹר נְחֹשֶׁת (Kiyor Nechoshet · 銅洗濯盆)',
    scriptureText:
      '你要用銅做洗濯盆和盆座，以便洗濯。要將盆放在會幕和壇的中間，在盆裡盛水。亞倫和他的兒子要在這盆裡洗手洗腳... 免得死亡。這要做他們世世代代永遠的定例。',
    durationSeconds: 9,
    cameraStart: { position: { x: -2.5, y: 2.2, z: 5.2 }, target: { x: 0, y: 0.85, z: 0.0 }, fov: 44 },
    cameraEnd: { position: { x: -1.1, y: 1.6, z: 2.6 }, target: { x: 0, y: 0.8, z: 0.0 }, fov: 40 },
    dimensionTargetId: 'laver',
    peelRoof: false,
  },
  {
    id: 'act-4-tent-entry',
    actNumber: 4,
    totalActs: 8,
    title: '第四幕：會幕覆蓋與進入聖所',
    subtitle: 'The Tabernacle Curtains & Entry',
    scriptureReference: '出埃及記 26:1–14, 36–37',
    hebrewTerm: 'הַמִּשְׁכָּן (HaMishkan · 帳幕／神聖居所)',
    scriptureText:
      '你要用十幅幔子做帳幕。這些幔子要用撚的細麻，和藍色、紫色、朱紅色線製造，並用巧匠的手工繡上基路伯... 又要用山羊毛織十一幅幔子，作為帳幕以上的罩棚... 又要做門簾。',
    durationSeconds: 11,
    cameraStart: { position: { x: 0.8, y: 2.8, z: 8.0 }, target: { x: 0, y: 1.8, z: -1.0 }, fov: 48 },
    cameraEnd: { position: { x: 0, y: 1.8, z: 1.8 }, target: { x: 0, y: 1.6, z: -3.5 }, fov: 45 },
    peelRoof: false,
  },
  {
    id: 'act-5-menorah',
    actNumber: 5,
    totalActs: 8,
    title: '第五幕：精金金燈臺 · 永恆的生命之光',
    subtitle: 'The Golden Lampstand / Menorah',
    scriptureReference: '出埃及記 25:31–40',
    hebrewTerm: 'מְנוֹרַת הַזָּהָב (Menorat HaZahav · 金燈臺)',
    scriptureText:
      '要用純金做一個燈臺。燈臺的座和幹與杯、球、花，都要接連一塊錘出來... 枝幹上有杯，形狀像杏花，有球，有花... 要做燈臺的七個燈盞... 製造這一切的器具要用精金一他連得。',
    durationSeconds: 12,
    cameraStart: { position: { x: 0.28, y: 1.5, z: -2.45 }, target: { x: -1.2, y: 0.82, z: -4.35 }, fov: 40 },
    cameraEnd: { position: { x: -0.45, y: 1.35, z: -3.6 }, target: { x: -1.2, y: 0.85, z: -4.35 }, fov: 36 },
    dimensionTargetId: 'menorah',
    peelRoof: false,
  },
  {
    id: 'act-6-shewbread',
    actNumber: 6,
    totalActs: 8,
    title: '第六幕：陳設餅桌 · 神人生命的同席',
    subtitle: 'Table of Showbread',
    scriptureReference: '出埃及記 25:23–30',
    hebrewTerm: 'שֻׁלְחָן לֶחֶם הַפָּנִים (Shulchan Lechem HaPanim · 陳設餅桌)',
    scriptureText:
      '要用皂莢木做一張桌子，長二肘，寬一肘，高一肘半。要包上純金，四圍鑲上金牙邊... 桌子的四圍各做一掌寬的邊... 又要在桌子上，在我面前，常擺陳設餅。',
    durationSeconds: 11,
    cameraStart: { position: { x: -0.28, y: 1.5, z: -2.45 }, target: { x: 1.2, y: 0.78, z: -4.35 }, fov: 40 },
    cameraEnd: { position: { x: 0.45, y: 1.35, z: -3.6 }, target: { x: 1.2, y: 0.8, z: -4.35 }, fov: 36 },
    dimensionTargetId: 'shewbread-table',
    peelRoof: false,
  },
  {
    id: 'act-7-incense-altar',
    actNumber: 7,
    totalActs: 8,
    title: '第七幕：金香壇與分隔至聖所的幔子',
    subtitle: 'Altar of Incense & The Veil',
    scriptureReference: '出埃及記 30:1–10; 26:31–35',
    hebrewTerm: 'מִזְבַּח הַקְּטֹרֶת (Mizbeach HaKetoret) ｜ פָּרֹכֶת (Parochet)',
    scriptureText:
      '你要用皂莢木做一座燒香的壇... 長一肘，寬一肘，高二肘。要把壇放在法櫃前的幔子外... 你要用藍色、紫色、朱紅色線織幔子... 使幔子成為你們聖所和至聖所的界限。',
    durationSeconds: 11,
    cameraStart: { position: { x: 0.35, y: 1.6, z: -3.6 }, target: { x: 0, y: 1.0, z: -5.85 }, fov: 41 },
    cameraEnd: { position: { x: 0.1, y: 1.4, z: -4.6 }, target: { x: 0, y: 1.05, z: -5.85 }, fov: 38 },
    dimensionTargetId: 'incense-altar',
    peelRoof: false,
  },
  {
    id: 'act-8-ark-of-covenant',
    actNumber: 8,
    totalActs: 8,
    title: '第八幕：至聖所 · 約櫃、施恩座與神聖榮光',
    subtitle: 'Ark of the Covenant & Shekinah Glory',
    scriptureReference: '出埃及記 25:10–22',
    hebrewTerm: 'אֲרוֹן הַבְּרִית (Aron HaBrit) ｜ כַּפֹּרֶת (Kapporet)',
    scriptureText:
      '要用皂莢木做一個櫃，長二肘半，寬一肘半，高一肘半。裡外都要包裹純金... 要用純金做施恩座... 要用金子錘出兩個基路伯來，安在施恩座的兩頭... 二基路伯要高張翅膀，遮掩施恩座... 我要在那裡與你相會。',
    durationSeconds: 14,
    cameraStart: { position: { x: -0.5, y: 1.35, z: -8.0 }, target: { x: 0, y: 0.72, z: -9.18 }, fov: 44 },
    cameraEnd: { position: { x: -1.1, y: 1.15, z: -8.3 }, target: { x: 0, y: 0.72, z: -9.18 }, fov: 40 },
    dimensionTargetId: 'ark',
    peelRoof: false,
  },
];

export class CinematicTourController {
  readonly #events = new EventChannel<Readonly<CinematicState>>();
  #actIndex = 0;
  #isPlaying = false;
  #isPaused = false;
  #actElapsed = 0;
  #speed = 1.0;
  #showDimensions = true;
  #dimensionUnit: DimensionUnit = 'cubit';

  constructor(readonly acts = CINEMATIC_ACTS) {}

  get snapshot(): Readonly<CinematicState> {
    const act = this.acts[this.#actIndex] ?? this.acts[0]!;
    return {
      isPlaying: this.#isPlaying,
      isPaused: this.#isPaused,
      currentActIndex: this.#actIndex,
      currentAct: act,
      progressRatio: Math.min(1.0, this.#actElapsed / act.durationSeconds),
      playbackSpeed: this.#speed,
      showDimensions: this.#showDimensions,
      dimensionUnit: this.#dimensionUnit,
    };
  }

  subscribe(listener: (state: Readonly<CinematicState>) => void): Unsubscribe {
    listener(this.snapshot);
    return this.#events.subscribe(listener);
  }

  start(fromIndex = 0): void {
    this.#actIndex = Math.max(0, Math.min(this.acts.length - 1, fromIndex));
    this.#isPlaying = true;
    this.#isPaused = false;
    this.#actElapsed = 0;
    this.#emit();
  }

  pause(): void {
    if (!this.#isPlaying) return;
    this.#isPaused = true;
    this.#emit();
  }

  resume(): void {
    if (!this.#isPlaying) {
      this.start(this.#actIndex);
      return;
    }
    this.#isPaused = false;
    this.#emit();
  }

  togglePlayPause(): void {
    if (this.#isPaused || !this.#isPlaying) this.resume();
    else this.pause();
  }

  stop(): void {
    this.#isPlaying = false;
    this.#isPaused = false;
    this.#actElapsed = 0;
    this.#emit();
  }

  next(): void {
    if (this.#actIndex < this.acts.length - 1) {
      this.#actIndex += 1;
      this.#actElapsed = 0;
      this.#emit();
    } else {
      this.stop();
    }
  }

  previous(): void {
    if (this.#actIndex > 0) {
      this.#actIndex -= 1;
      this.#actElapsed = 0;
      this.#emit();
    }
  }

  jumpTo(index: number): void {
    this.#actIndex = Math.max(0, Math.min(this.acts.length - 1, index));
    this.#actElapsed = 0;
    this.#emit();
  }

  setSpeed(speed: number): void {
    this.#speed = speed;
    this.#emit();
  }

  toggleDimensions(): void {
    this.#showDimensions = !this.#showDimensions;
    this.#emit();
  }

  setDimensionUnit(unit: DimensionUnit): void {
    this.#dimensionUnit = unit;
    this.#emit();
  }

  update(deltaSeconds: number): boolean {
    if (!this.#isPlaying || this.#isPaused) return false;

    const act = this.acts[this.#actIndex];
    if (!act) return false;

    this.#actElapsed += deltaSeconds * this.#speed;
    this.#emit();

    if (this.#actElapsed >= act.durationSeconds) {
      this.next();
      return true; // Scene changed
    }
    return false;
  }

  #emit(): void {
    this.#events.emit(this.snapshot);
  }
}
