import type { Replacement } from '../ui/speech';

/**
 * 朗讀用的多音字修正：只改送給語音的文字，畫面上的經文不變。
 * 左邊是經文裡的寫法，右邊是唸起來同音、語音引擎不會唸錯的字。
 */
export const SPEECH_FIXES: readonly Replacement[] = [
  // 尼 10:4、10:10、10:12：Microsoft Hanhan 把「示巴尼」唸得像「時巴尼」（shí）；「示」唸 shì，代入同音的「士」
  ['示巴尼', '士巴尼'],
];
