import { AudioManager } from '../audio/AudioManager';
import { CharacterRegistry } from '../characters/CharacterRegistry';
import { CharacterSystem } from '../characters/CharacterSystem';
import { runtimeConfig } from '../config/runtime';
import { loadProjectData } from '../data/loadProjectData';
import { RitualPlaybackController } from '../rituals/RitualPlaybackController';
import { RitualRegistry } from '../rituals/RitualRegistry';
import { RitualVisualSystem } from '../rituals/RitualVisualSystem';
import { SceneBootstrap } from '../scene/SceneBootstrap';
import { ObjectRegistry } from '../scene/ObjectRegistry';
import type { AtmosphereMode } from '../types/atmosphere';
import { ScriptureMappingService } from '../scripture/ScriptureMappingService';
import { ScriptureRegistry } from '../scripture/ScriptureRegistry';
import { LearningModeManager } from '../systems/LearningModeManager';
import { TourManager, type TourStop } from '../systems/TourManager';
import { CinematicTourController, type CinematicState } from '../systems/CinematicTourController';
import { AssetManifest } from '../systems/assets/AssetManifest';
import { GLTFAssetLoader } from '../systems/assets/AssetLoader';
import { AssetRuntimeManager } from '../systems/assets/AssetRuntimeManager';
import type { DimensionUnit } from '../scene/DimensionVisualizer';
import type { AppPort, ArchitectureStats } from '../types/app';
import type { AssetProfile, AssetRuntimeState } from '../types/assets';
import type { AttributionView, ExperienceState, RitualCommand, TourCommand } from '../types/experience';
import type { ExperienceMode, UIState } from '../types/ui';
import { UIStateManager } from '../ui/UIStateManager';
import { EventChannel } from '../utils/EventChannel';

const tourStops: TourStop[] = [
  { id: 'tour-east-gate', locationId: 'east-gate', objectId: null, title: '由東門進入', scriptureReference: 'Exodus 27:9-19' },
  { id: 'tour-burnt-altar', locationId: 'burnt-altar-location', objectId: 'burnt-altar', title: '燔祭壇', scriptureReference: 'Exodus 27:1-8' },
  { id: 'tour-laver', locationId: 'laver-location', objectId: 'laver', title: '洗濯盆', scriptureReference: 'Exodus 30:17-21' },
  { id: 'tour-holy-place', locationId: 'holy-place', objectId: 'incense-altar', title: '聖所與香壇', scriptureReference: 'Exodus 30:1-10' },
  { id: 'tour-most-holy', locationId: 'most-holy-place', objectId: 'ark', title: '至聖所與約櫃', scriptureReference: 'Exodus 25:10-22' },
];

const confidenceDisclosure = '本版刻意不展示通用人物模型，避免把未經歷史驗證的服飾與外貌誤當成祭司造型。人物與聖衣研究仍以出埃及記 28、29、39 章為資料基線，待有足夠品質與考據的專用模型後再加入。';

export class AppKernel implements AppPort {
  readonly data = loadProjectData();
  readonly uiState = new UIStateManager();
  readonly scene: SceneBootstrap;
  readonly audio = new AudioManager();
  readonly objects = new ObjectRegistry(this.data.tabernacle.objects);
  readonly characters = new CharacterSystem(new CharacterRegistry(this.data.characters.characters));
  readonly rituals: RitualPlaybackController;
  readonly scriptures = new ScriptureMappingService(new ScriptureRegistry(this.data.scriptures.passages));
  readonly tour = new TourManager(tourStops);
  readonly learning = new LearningModeManager();
  readonly cinematic = new CinematicTourController();
  readonly assets = new AssetManifest(this.data.assets.assets);
  readonly assetLoader: GLTFAssetLoader;
  readonly assetRuntime: AssetRuntimeManager;
  readonly ritualVisuals: RitualVisualSystem;
  readonly stats: ArchitectureStats;
  readonly #experienceEvents = new EventChannel<Readonly<ExperienceState>>();
  #creditsOpen = false;
  #unsubscribe: (() => void) | null = null;
  #assetUnsubscribe: (() => void) | null = null;
  #cinematicUnsubscribe: (() => void) | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.scene = new SceneBootstrap(canvas);
    this.ritualVisuals = new RitualVisualSystem(this.scene.context.worldRoot);
    this.rituals = new RitualPlaybackController(new RitualRegistry(this.data.rituals.rituals), {
      onStepEnter: (ritual) => this.ritualVisuals.play(ritual.id),
      onStateChange: (state) => {
        if (state.status === 'paused') this.ritualVisuals.pause();
        if (state.status === 'idle' || state.status === 'complete') this.ritualVisuals.stop();
        this.publishExperience();
      },
    });
    const forcedFailureAssetId = import.meta.env.DEV ? new URLSearchParams(window.location.search).get('assetFailure') : null;
    this.assetLoader = forcedFailureAssetId ? new GLTFAssetLoader({ forceFailureAssetId: forcedFailureAssetId }) : new GLTFAssetLoader();
    this.assetRuntime = new AssetRuntimeManager(this.assets, this.assetLoader, this.scene.context.assetRoot, runtimeConfig.assetProfile);
    this.stats = {
      objects: this.objects.size,
      characters: this.characters.registry.size,
      rituals: this.rituals.registry.size,
      scriptures: this.scriptures.registry.size,
      locations: this.data.world.locations.length,
      assets: this.assets.size,
    };
    this.#unsubscribe = this.uiState.subscribe((state) => this.applyMode(state.mode));
    this.#assetUnsubscribe = this.assetRuntime.subscribe((state) => this.onAssetState(state));
    this.#cinematicUnsubscribe = this.cinematic.subscribe((state) => this.onCinematicState(state));
    this.scene.setUpdate((deltaSeconds) => this.update(deltaSeconds));

    // Listen to manual orbit dragging to pause cinematic tour cleanly
    this.scene.context.cameraManager.controls?.addEventListener('start', () => {
      if (this.cinematic.snapshot.isPlaying && !this.cinematic.snapshot.isPaused) {
        this.cinematic.pause();
        this.scene.context.cameraManager.stopFlyTo();
      }
    });
  }

  start(): void {
    window.addEventListener('resize', this.#onResize);
    this.scene.start();
    void this.startAssets();
  }

  setAtmosphere(mode: AtmosphereMode): void {
    this.scene.setAtmosphere(mode);
  }

  setQuality(preset: 'high' | 'medium' | 'low'): void {
    this.scene.setQuality(preset);
  }

  getState(): Readonly<UIState> { return this.uiState.snapshot; }
  subscribe(listener: (state: Readonly<UIState>) => void): () => void { return this.uiState.subscribe(listener); }
  transitionTo(mode: ExperienceMode, reason: string): void {
    if (this.cinematic.snapshot.isPlaying) this.stopCinematicTour();
    if (mode === 'tour' && !this.tour.current) return;
    const isCurrentMode = this.uiState.snapshot.mode === mode;
    this.uiState.transitionTo(mode, reason);
    this.audio.playNav();
    if (mode === 'tour') { this.tour.reset(); this.focusTourStop(); }
    if (mode === 'learning') this.openLearningObject(this.learning.context.objectId ?? 'burnt-altar');
    if (mode === 'overview' && isCurrentMode) this.scene.context.cameraManager.applyMode('overview');
    this.publishExperience();
  }

  // Cinematic Tour Implementation
  startCinematicTour(fromIndex = 0): void {
    void this.audio.enableAudio();
    this.audio.playNav();
    this.assetRuntime.setInteriorReveal(false);
    this.cinematic.start(fromIndex);
  }

  stopCinematicTour(): void {
    this.cinematic.stop();
    this.scene.context.dimensions.clear();
    this.scene.context.cameraManager.stopFlyTo();
    this.assetRuntime.setInteriorReveal(this.uiState.snapshot.mode === 'learning');
    this.publishExperience();
  }

  toggleCinematicPlayPause(): void {
    this.cinematic.togglePlayPause();
    this.audio.playClick();
  }

  nextCinematicAct(): void {
    this.cinematic.next();
    this.audio.playNav();
  }

  prevCinematicAct(): void {
    this.cinematic.previous();
    this.audio.playNav();
  }

  toggleCinematicDimensions(): void {
    this.cinematic.toggleDimensions();
    this.audio.playClick();
  }

  setCinematicDimensionUnit(unit: DimensionUnit): void {
    this.cinematic.setDimensionUnit(unit);
    this.scene.context.dimensions.setUnit(unit);
    this.audio.playClick();
  }

  setCinematicSpeed(speed: number): void {
    this.cinematic.setSpeed(speed);
    this.audio.playClick();
  }

  subscribeCinematic(listener: (state: Readonly<CinematicState>) => void): () => void {
    return this.cinematic.subscribe(listener);
  }

  getAssetState(): Readonly<AssetRuntimeState> { return this.assetRuntime.snapshot; }
  subscribeAssets(listener: (state: Readonly<AssetRuntimeState>) => void): () => void { return this.assetRuntime.subscribe(listener); }
  setAssetProfile(profile: AssetProfile): void { void this.assetRuntime.selectProfile(profile); }
  loadDetail(assetId: string): void { void this.assetRuntime.loadDetail(assetId); }

  getExperienceState(): Readonly<ExperienceState> {
    const object = this.learning.context.objectId ? this.objects.get(this.learning.context.objectId) : undefined;
    const location = object ? this.requireLocation(object.locationId) : null;
    const passages = object ? this.scriptures.threeDToBible({ kind: 'objectIds', entityId: object.id }) : [];
    const ritualIds = object ? this.rituals.registry.values().filter((ritual) => ritual.trigger.kind === 'interaction' && ritual.trigger.objectId === object.id).map((ritual) => ritual.id) : [];
    const characterIds = object ? [...new Set(this.rituals.registry.values().filter((ritual) => ritualIds.includes(ritual.id)).flatMap((ritual) => ritual.steps.flatMap((step) => step.characterIds)))] : [];
    const ritualState = this.rituals.state;
    const ritual = ritualState.ritualId ? this.rituals.registry.get(ritualState.ritualId) : undefined;
    const ritualStep = ritual?.steps[ritualState.stepIndex];
    const currentTour = this.tour.current;
    return {
      tour: {
        playing: this.tour.playing,
        index: this.tour.index,
        total: this.tour.stops.length,
        current: currentTour ? {
          ...currentTour,
          scriptureText: currentTour.scriptureReference ? this.scriptures.registry.get(currentTour.scriptureReference)?.originalText ?? null : null,
        } : null,
      },
      learning: {
        objectId: object?.id ?? null,
        objectName: object?.name ?? null,
        confidence: object?.confidence ?? null,
        locationName: location?.name ?? null,
        scriptureReferences: passages.map((passage) => ({
          id: passage.id,
          summary: passage.summary,
          annotation: passage.annotation,
          originalText: passage.originalText,
          context: passage.context,
          sourceUrl: passage.sourceUrl,
        })),
        ritualIds,
        characterIds,
      },
      ritual: {
        playback: ritualState,
        name: ritual?.name ?? null,
        stepTitle: ritualStep?.title ?? null,
        instruction: ritualStep?.instruction ?? null,
        confidence: ritualStep?.confidence ?? null,
        scriptureReferences: ritualStep ? [...ritualStep.scriptureReferences] : [],
      },
      character: {
        id: 'serving-priest',
        name: '供職祭司（教學重建）',
        status: 'omitted',
        position: null,
        disclosure: confidenceDisclosure,
      },
      creditsOpen: this.#creditsOpen,
      assetProfile: this.assetRuntime.snapshot.profile,
    };
  }

  subscribeExperience(listener: (state: Readonly<ExperienceState>) => void): () => void {
    listener(this.getExperienceState());
    return this.#experienceEvents.subscribe(listener);
  }

  commandTour(command: TourCommand): void {
    if (command === 'close') { this.tour.pause(); this.uiState.returnToPrevious('tour-close'); }
    if (command === 'previous') { this.tour.previous(); this.focusTourStop(); }
    if (command === 'next') { this.tour.next(); this.focusTourStop(); }
    this.audio.playClick();
    this.publishExperience();
  }

  selectLearningObject(objectId: string): void {
    if (this.uiState.snapshot.mode !== 'learning') this.uiState.transitionTo('learning', `interaction:${objectId}`);
    this.audio.playInspect();
    this.openLearningObject(objectId);
    this.publishExperience();
  }

  startRitual(ritualId: string): void {
    const ritual = this.rituals.registry.require(ritualId);
    if (ritual.type !== 'washing' && ritual.type !== 'incense') return;
    this.learning.open({ ritualId, locationId: ritual.locationId, characterId: ritual.steps[0]?.characterIds[0] ?? null });
    this.rituals.start(ritualId);
    const ritualLocation = this.requireLocation(ritual.locationId);
    this.scene.context.cameraManager.focus(ritualLocation.position, ritualLocation.position.z < -2 ? 3.4 : 5.8);
    this.audio.playClick();
    this.publishExperience();
  }

  commandRitual(command: RitualCommand): void {
    if (command === 'close') { this.rituals.reset(); this.ritualVisuals.stop(); this.learning.open({ ritualId: null, characterId: null }); }
    if (command === 'play-pause') {
      if (this.rituals.state.status === 'playing') this.rituals.pause();
      else if (this.rituals.state.status === 'paused') { this.rituals.resume(); if (this.rituals.state.ritualId) this.ritualVisuals.play(this.rituals.state.ritualId); }
    }
    if (command === 'next') this.rituals.next();
    this.audio.playClick();
    this.publishExperience();
  }

  setCreditsOpen(open: boolean): void { this.#creditsOpen = open; this.publishExperience(); }

  getAttributions(): AttributionView[] {
    return this.assets.values().map((asset) => ({
      id: asset.id,
      title: asset.attribution.split(' by ')[0] ?? asset.id,
      author: asset.author,
      sourceUrl: asset.sourceUrl,
      license: asset.license,
      attribution: asset.attribution,
    }));
  }

  dispose(): void {
    this.#unsubscribe?.();
    this.#assetUnsubscribe?.();
    this.#cinematicUnsubscribe?.();
    this.#experienceEvents.clear();
    this.audio.dispose();
    this.ritualVisuals.dispose();
    this.assetRuntime.dispose();
    this.scene.dispose();
    window.removeEventListener('resize', this.#onResize);
  }

  private async startAssets(): Promise<void> { await this.assetRuntime.selectProfile(runtimeConfig.assetProfile); }

  private applyMode(mode: ExperienceMode): void {
    this.assetRuntime.setProfileVisible(!(mode === 'learning' && this.assetRuntime.snapshot.profile === 'desktop-structural'));
    this.assetRuntime.setInteriorReveal(mode === 'learning' && this.assetRuntime.snapshot.profile !== 'desktop-structural');
    this.scene.context.cameraManager.applyMode(mode);
    if (mode !== 'tour') this.tour.pause();
    this.publishExperience();
  }

  private update(deltaSeconds: number): void {
    this.ritualVisuals.update(performance.now() / 1000);
    this.cinematic.update(deltaSeconds);

    const cameraPose = this.scene.context.cameraManager.pose;
    this.audio.updatePlayerState(cameraPose.position, false, deltaSeconds);
  }

  #lastHandledActId: string | null = null;
  private onCinematicState(state: Readonly<CinematicState>): void {
    if (!state.isPlaying) {
      this.#lastHandledActId = null;
      return;
    }

    const act = state.currentAct;
    if (act.id !== this.#lastHandledActId) {
      this.#lastHandledActId = act.id;

      // Keep tabernacle and curtains fully visible during cinematic walkthrough
      this.assetRuntime.setInteriorReveal(!!act.peelRoof);

      // Start camera smooth flight from act.cameraStart to act.cameraEnd
      this.scene.context.cameraManager.flyAlongPath(
        act.cameraStart,
        act.cameraEnd,
        act.durationSeconds / state.playbackSpeed
      );

      // Trigger 3D Dimensions
      if (state.showDimensions && act.dimensionTargetId) {
        this.scene.context.dimensions.setUnit(state.dimensionUnit);
        this.scene.context.dimensions.showObjectDimensions(act.dimensionTargetId);
      } else {
        this.scene.context.dimensions.clear();
      }
    } else {
      // Dynamic dimension toggle during the same act
      if (state.showDimensions && act.dimensionTargetId) {
        this.scene.context.dimensions.setUnit(state.dimensionUnit);
        this.scene.context.dimensions.showObjectDimensions(act.dimensionTargetId);
      } else if (!state.showDimensions) {
        this.scene.context.dimensions.clear();
      }
    }
  }

  private openLearningObject(objectId: string): void {
    const object = this.objects.require(objectId);
    this.learning.open({ objectId, locationId: object.locationId, scriptureReference: object.scriptureReferences[0] ?? null, ritualId: null, characterId: null });
    this.uiState.selectEntity(objectId, 'object');
    this.scene.context.cameraManager.focusObject(object.id, object.interactionPosition);
    this.assetRuntime.setInteriorReveal(this.uiState.snapshot.mode === 'learning' && this.assetRuntime.snapshot.profile !== 'desktop-structural');
    if (this.assetRuntime.snapshot.profile === 'desktop-structural' && object.assetId) this.loadDetail(object.assetId);
  }

  private focusTourStop(): void {
    const stop = this.tour.current;
    if (!stop) return;
    if (stop.objectId) {
      const object = this.objects.require(stop.objectId);
      this.scene.context.cameraManager.focusObject(object.id, object.interactionPosition);
      this.publishExperience();
      return;
    }
    this.scene.context.cameraManager.focus(this.requireLocation(stop.locationId).position, 9.5);
    this.publishExperience();
  }

  private requireLocation(locationId: string): (typeof this.data.world.locations)[number] {
    const location = this.data.world.locations.find((candidate) => candidate.id === locationId);
    if (!location) throw new Error(`Missing location: ${locationId}`);
    return location;
  }

  private publishExperience(): void { this.#experienceEvents.emit(this.getExperienceState()); }

  private onAssetState(state: Readonly<AssetRuntimeState>): void {
    this.assetRuntime.setProfileVisible(!(this.getState().mode === 'learning' && state.profile === 'desktop-structural'));
    this.assetRuntime.setInteriorReveal(this.getState().mode === 'learning' && state.profile !== 'desktop-structural');
    if (state.phase === 'ready') {
      const mode = this.getState().mode;
      if (mode === 'overview') {
        const profileAssetId = state.profile === 'desktop-high' ? 'tabernacle-main' : state.profile === 'desktop-structural' ? 'tabernacle-framework' : 'tabernacle-lowpoly';
        const bounds = state.boundsByAssetId[profileAssetId];
        if (bounds) this.scene.context.cameraManager.frameBounds(bounds);
      }
      if (mode === 'learning' && this.learning.context.objectId) {
        const object = this.objects.require(this.learning.context.objectId);
        if (state.profile === 'desktop-structural' && object.assetId && !state.activeAssetIds.includes(object.assetId)) {
          this.loadDetail(object.assetId);
        } else {
          const detailBounds = object.assetId ? state.boundsByAssetId[object.assetId] : undefined;
          if (detailBounds) this.scene.context.cameraManager.frameDetailBounds(detailBounds);
          else this.scene.context.cameraManager.focusObject(object.id, object.interactionPosition);
        }
      }
      if (mode === 'tour') this.focusTourStop();
    }
    this.publishExperience();
  }

  readonly #onResize = (): void => this.scene.resize();
}
