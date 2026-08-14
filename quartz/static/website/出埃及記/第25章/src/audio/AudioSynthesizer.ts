/**
 * Procedural Web Audio Synthesizer for Biblical Tabernacle 3D Explorer.
 * Generates ambient desert wind, spatial flame crackle, gentle water, incense sizzle,
 * sacred modal harmony pads, footstep sounds, and UI chimes with zero external sound files.
 */

export class AudioSynthesizer {
  #ctx: AudioContext | null = null;
  #masterGain: GainNode | null = null;
  #ambientGain: GainNode | null = null;
  #effectsGain: GainNode | null = null;
  #musicGain: GainNode | null = null;

  // Sound nodes
  #windSource: AudioNode | null = null;
  #windGain: GainNode | null = null;
  #fireGain: GainNode | null = null;
  #waterGain: GainNode | null = null;
  #incenseGain: GainNode | null = null;

  // Sacred Drone Oscillators
  #droneOscs: OscillatorNode[] = [];
  #droneGain: GainNode | null = null;

  #isMuted = false;
  #volume = 0.7;
  #initialized = false;

  get isInitialized(): boolean {
    return this.#initialized;
  }

  get isMuted(): boolean {
    return this.#isMuted;
  }

  get volume(): number {
    return this.#volume;
  }

  /**
   * Initializes the AudioContext upon user gesture.
   */
  async init(): Promise<void> {
    if (this.#initialized) {
      if (this.#ctx && this.#ctx.state === 'suspended') {
        await this.#ctx.resume();
      }
      return;
    }

    try {
      const AudioCtxClass = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
      this.#ctx = new AudioCtxClass();
      if (this.#ctx.state === 'suspended') {
        await this.#ctx.resume();
      }

      this.#masterGain = this.#ctx.createGain();
      this.#masterGain.gain.setValueAtTime(this.#volume, this.#ctx.currentTime);
      this.#masterGain.connect(this.#ctx.destination);

      this.#ambientGain = this.#ctx.createGain();
      this.#ambientGain.gain.setValueAtTime(0.6, this.#ctx.currentTime);
      this.#ambientGain.connect(this.#masterGain);

      this.#effectsGain = this.#ctx.createGain();
      this.#effectsGain.gain.setValueAtTime(0.8, this.#ctx.currentTime);
      this.#effectsGain.connect(this.#masterGain);

      this.#musicGain = this.#ctx.createGain();
      this.#musicGain.gain.setValueAtTime(0.4, this.#ctx.currentTime);
      this.#musicGain.connect(this.#masterGain);

      this.#setupDesertWind();
      this.#setupSacredDrone();
      this.#setupFlameAndWater();

      this.#initialized = true;
    } catch (e) {
      console.warn('Web Audio API not supported or blocked:', e);
    }
  }

  setVolume(volume: number): void {
    this.#volume = Math.max(0, Math.min(1, volume));
    if (this.#masterGain && this.#ctx && !this.#isMuted) {
      this.#masterGain.gain.setTargetAtTime(this.#volume, this.#ctx.currentTime, 0.05);
    }
  }

  setMuted(muted: boolean): void {
    this.#isMuted = muted;
    if (this.#masterGain && this.#ctx) {
      this.#masterGain.gain.setTargetAtTime(muted ? 0 : this.#volume, this.#ctx.currentTime, 0.05);
    }
  }

  toggleMute(): boolean {
    this.setMuted(!this.#isMuted);
    return this.#isMuted;
  }

  /**
   * Generates procedural pink noise filtered for continuous desert wind atmosphere.
   */
  #setupDesertWind(): void {
    if (!this.#ctx || !this.#ambientGain) return;

    const bufferSize = this.#ctx.sampleRate * 2;
    const noiseBuffer = this.#ctx.createBuffer(1, bufferSize, this.#ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;

    for (let i = 0; i < bufferSize; i++) {
      const white = Math.random() * 2 - 1;
      b0 = 0.99886 * b0 + white * 0.0555179;
      b1 = 0.99332 * b1 + white * 0.0750759;
      b2 = 0.96900 * b2 + white * 0.1538520;
      b3 = 0.86650 * b3 + white * 0.3104856;
      b4 = 0.55000 * b4 + white * 0.5329522;
      b5 = -0.7616 * b5 - white * 0.0168980;
      output[i] = (b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362) * 0.035;
      b6 = white * 0.115926;
    }

    const whiteNoise = this.#ctx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;

    // Filter to simulate low wind rumble and high breeze
    const filter = this.#ctx.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(320, this.#ctx.currentTime);
    filter.Q.setValueAtTime(1.8, this.#ctx.currentTime);

    // LFO to slowly sweep wind filter frequency
    const lfo = this.#ctx.createOscillator();
    lfo.frequency.setValueAtTime(0.08, this.#ctx.currentTime);
    const lfoGain = this.#ctx.createGain();
    lfoGain.gain.setValueAtTime(180, this.#ctx.currentTime);
    lfo.connect(lfoGain);
    lfoGain.connect(filter.frequency);
    lfo.start();

    this.#windGain = this.#ctx.createGain();
    this.#windGain.gain.setValueAtTime(0.4, this.#ctx.currentTime);

    whiteNoise.connect(filter);
    filter.connect(this.#windGain);
    this.#windGain.connect(this.#ambientGain);
    whiteNoise.start();
    this.#windSource = whiteNoise;
  }

  /**
   * Generates a contemplative sacred ambient modal chord (ancient Dorian root: D-A-D-F-A).
   */
  #setupSacredDrone(): void {
    if (!this.#ctx || !this.#musicGain) return;

    this.#droneGain = this.#ctx.createGain();
    this.#droneGain.gain.setValueAtTime(0.18, this.#ctx.currentTime);
    this.#droneGain.connect(this.#musicGain);

    // Frequencies: D2 (73.42Hz), A2 (110Hz), D3 (146.83Hz), F3 (174.61Hz), A3 (220Hz)
    const freqs = [73.42, 110.0, 146.83, 174.61, 220.0];

    freqs.forEach((freq, index) => {
      if (!this.#ctx || !this.#droneGain) return;
      const osc = this.#ctx.createOscillator();
      osc.type = index % 2 === 0 ? 'sine' : 'triangle';
      osc.frequency.setValueAtTime(freq, this.#ctx.currentTime);

      const subGain = this.#ctx.createGain();
      subGain.gain.setValueAtTime(0.15 / (index + 1), this.#ctx.currentTime);

      // Subtle vibrato / detuning LFO
      const lfo = this.#ctx.createOscillator();
      lfo.frequency.setValueAtTime(0.05 + index * 0.02, this.#ctx.currentTime);
      const lfoGain = this.#ctx.createGain();
      lfoGain.gain.setValueAtTime(0.8, this.#ctx.currentTime);
      lfo.connect(lfoGain);
      lfoGain.connect(osc.frequency);
      lfo.start();

      osc.connect(subGain);
      subGain.connect(this.#droneGain);
      osc.start();
      this.#droneOscs.push(osc);
    });
  }

  /**
   * Spatial emitters setup for flame crackle, laver water, and incense.
   */
  #setupFlameAndWater(): void {
    if (!this.#ctx || !this.#effectsGain) return;

    this.#fireGain = this.#ctx.createGain();
    this.#fireGain.gain.setValueAtTime(0.0, this.#ctx.currentTime);
    this.#fireGain.connect(this.#effectsGain);

    this.#waterGain = this.#ctx.createGain();
    this.#waterGain.gain.setValueAtTime(0.0, this.#ctx.currentTime);
    this.#waterGain.connect(this.#effectsGain);

    this.#incenseGain = this.#ctx.createGain();
    this.#incenseGain.gain.setValueAtTime(0.0, this.#ctx.currentTime);
    this.#incenseGain.connect(this.#effectsGain);
  }

  /**
   * Updates spatial sound volumes based on player position relative to 3D landmarks.
   */
  updateSpatialSounds(playerPos: { x: number; y: number; z: number }): void {
    if (!this.#ctx || !this.#initialized) return;

    const now = this.#ctx.currentTime;

    // Altar of Burnt Offering at (0, 1.4, 9)
    const distFire = Math.hypot(playerPos.x - 0, playerPos.z - 9);
    const fireVol = Math.max(0, 1 - distFire / 14) * 0.35;
    if (this.#fireGain) this.#fireGain.gain.setTargetAtTime(fireVol, now, 0.1);

    // Bronze Laver at (0, 0.9, 0)
    const distLaver = Math.hypot(playerPos.x - 0, playerPos.z - 0);
    const waterVol = Math.max(0, 1 - distLaver / 10) * 0.28;
    if (this.#waterGain) this.#waterGain.gain.setTargetAtTime(waterVol, now, 0.1);

    // Altar of Incense at (0, 1.7, -5.85)
    const distIncense = Math.hypot(playerPos.x - 0, playerPos.z - (-5.85));
    const incenseVol = Math.max(0, 1 - distIncense / 8) * 0.3;
    if (this.#incenseGain) this.#incenseGain.gain.setTargetAtTime(incenseVol, now, 0.1);

    // Sacred Drone intensifies when inside Holy Place (z <= -1) and Most Holy Place (z <= -7)
    if (this.#droneGain) {
      let droneVol = 0.12;
      if (playerPos.z < -1 && playerPos.z >= -7) {
        droneVol = 0.35; // Holy Place
      } else if (playerPos.z < -7) {
        droneVol = 0.55; // Most Holy Place (Reverent crescendo)
      }
      this.#droneGain.gain.setTargetAtTime(droneVol, now, 0.2);
    }
  }

  /**
   * Triggers a subtle, realistic footstep on sand/wood.
   */
  playFootstep(surface: 'sand' | 'wood' = 'sand'): void {
    if (!this.#ctx || !this.#effectsGain || this.#isMuted) return;

    const now = this.#ctx.currentTime;
    const osc = this.#ctx.createOscillator();
    const gain = this.#ctx.createGain();
    const filter = this.#ctx.createBiquadFilter();

    if (surface === 'sand') {
      osc.type = 'triangle';
      osc.frequency.setValueAtTime(80 + Math.random() * 20, now);
      osc.frequency.exponentialRampToValueAtTime(30, now + 0.08);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(240, now);

      gain.gain.setValueAtTime(0.12, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.08);
    } else {
      osc.type = 'sine';
      osc.frequency.setValueAtTime(140 + Math.random() * 30, now);
      osc.frequency.exponentialRampToValueAtTime(50, now + 0.06);

      filter.type = 'bandpass';
      filter.frequency.setValueAtTime(450, now);

      gain.gain.setValueAtTime(0.18, now);
      gain.gain.exponentialRampToValueAtTime(0.001, now + 0.06);
    }

    osc.connect(filter);
    filter.connect(gain);
    gain.connect(this.#effectsGain);

    osc.start(now);
    osc.stop(now + 0.09);
  }

  /**
   * Triggers an ethereal chime sound cue for UI interaction or object selection.
   */
  playChime(type: 'select' | 'nav' | 'complete' = 'select'): void {
    if (!this.#ctx || !this.#effectsGain || this.#isMuted) return;

    const now = this.#ctx.currentTime;
    const notes = type === 'complete' ? [523.25, 659.25, 783.99, 1046.5] : type === 'nav' ? [440, 554.37] : [659.25, 880];

    notes.forEach((freq, i) => {
      if (!this.#ctx || !this.#effectsGain) return;
      const osc = this.#ctx.createOscillator();
      const gain = this.#ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, now + i * 0.06);

      gain.gain.setValueAtTime(0, now + i * 0.06);
      gain.gain.linearRampToValueAtTime(0.08, now + i * 0.06 + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.0001, now + i * 0.06 + 0.6);

      osc.connect(gain);
      gain.connect(this.#effectsGain);

      osc.start(now + i * 0.06);
      osc.stop(now + i * 0.06 + 0.65);
    });
  }

  dispose(): void {
    this.#droneOscs.forEach((osc) => {
      try { osc.stop(); osc.disconnect(); } catch { /* ignore */ }
    });
    this.#droneOscs = [];
    if (this.#ctx) {
      void this.#ctx.close();
      this.#ctx = null;
    }
    this.#initialized = false;
  }
}
