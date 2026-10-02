import { ch11Facts, ch11Voices } from './ch11';
import { REEL_12, ch12Facts, ch12Voices } from './ch12';
import { REEL_13, ch13Facts, ch13Voices } from './ch13';
import { REEL_14, ch14Facts, ch14Voices } from './ch14';
import { REEL_15, ch15Facts, ch15Voices } from './ch15';
import { overviewFacts, overviewVoices } from './overview';
import { topicFacts, topicVoices } from './topics';
import { REEL_11, reelFacts } from './reels';
import { NEAR_VOICE, storyFacts } from './story';
import type { Fact, Reel, Voice } from './types';

const REELS: Reel[] = [REEL_11, REEL_12, REEL_13, REEL_14, REEL_15];

/** 全站所有帶出處的句子：資料閘門逐條比對 */
export function allFacts(): Fact[] {
  return [...storyFacts(), ...ch11Facts(), ...reelFacts(), ...ch12Facts(), ...ch13Facts(), ...ch14Facts(), ...ch15Facts(), ...overviewFacts(), ...topicFacts()];
}

export function allVoices(): Voice[] {
  const inReels = REELS.flatMap((r) => r.beats.flatMap((b) => (b.voice ? [b.voice] : [])));
  return [...ch11Voices(), ...ch12Voices(), ...ch13Voices(), ...ch14Voices(), ...ch15Voices(), ...overviewVoices(), ...topicVoices(), ...inReels, NEAR_VOICE];
}
