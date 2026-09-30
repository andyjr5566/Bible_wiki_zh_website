import * as store from '../store';
import * as playhead from './playhead';

/**
 * 把 store（使用者的操作）和播放頭（連續的移動）接起來：
 *   playing 開／關   → 播放頭開始／暫停
 *   at 被外部改變    → 走動的人沿路線滑過去（播放中的話，到了再接著播）
 *   播放頭到站       → 寫回 store 的 at（播放中也帶動 sel，讓卡片與清單跟著換）
 */
export function initPlayback() {
  let fromPlayhead = false;
  const write = (patch: Partial<store.State>) => {
    fromPlayhead = true;
    store.set(patch);
    fromPlayhead = false;
  };

  playhead.onArrive((n) => {
    const st = store.get();
    const patch: Partial<store.State> = {};
    if (st.at !== n) patch.at = n;
    if (st.playing && st.sel !== n) patch.sel = n;
    if (Object.keys(patch).length) write(patch);
  });
  playhead.onEnd(() => write({ playing: false }));

  store.subscribe((st, prev) => {
    if (fromPlayhead) return;
    if (st.pace !== prev.pace) playhead.setPace(st.pace);
    if (st.playing !== prev.playing) {
      if (st.playing) playhead.play(st.at); else playhead.pause();
      return;
    }
    if (st.at !== prev.at) playhead.glideTo(st.at);
  });
}
