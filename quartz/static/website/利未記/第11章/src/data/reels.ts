import type { Beat, Fact, Reel } from './types';
import { VOICES_11 } from './ch11';

/**
 * 每一章的 3D 故事。`story` 是示意情境（人物虛構），`rule` 才是經文。
 * cues 只決定畫面怎麼演，不是經文內容。
 */

const B = (time: string, story: string, rule: Fact, cues: Beat['cues'], voice?: Beat['voice']): Beat => ({ time, story, rule, cues, voice });

export const REEL_11: Reel = {
  id: 'c11',
  title: '傍晚的一隻死蜥蜴',
  color: 'var(--c11)',
  next: '母親的回答，接在下面',
  beats: [
    B('下午', '營中的一戶人家：父親、母親和女兒。母親在帳棚前生火，準備晚飯。',
      { text: '這一章的條例是傳給全體以色列人的', status: 'explicit', refs: ['利11:1-2'], q: '你們曉諭以色列人說' },
      [{ t: 'sky', sky: 'day' }, { t: 'at', who: 'mother', to: 'cook' }, { t: 'at', who: 'father', to: 'home' }, { t: 'at', who: 'daughter', to: 'basin' },
        { t: 'prop', id: 'pot', state: 'whole' }, { t: 'prop', id: 'bowl', state: 'out' }, { t: 'prop', id: 'fire', state: 'on' }, { t: 'cam', view: 'yardOpen' },
        { t: 'act', who: 'mother', act: 'stir' }]),
    B('下午', '她掀開瓦罐的蓋子，看見湯裡浮著一隻死了的蜥蜴。',
      { text: '蜥蜴是地上不潔淨的爬物之一', status: 'explicit', refs: ['利11:29'], q: '蜥蜴與其類' },
      [{ t: 'prop', id: 'lizard', state: 'pot' }, { t: 'walk', who: 'mother', to: 'pot' }, { t: 'cam', view: 'lidFront' }, { t: 'act', who: 'mother', act: 'lift' },
        { t: 'cam', view: 'potPov' }, { t: 'wait', ms: 1700 }, { t: 'cam', view: 'lidFront' },
        { t: 'together', cues: [{ t: 'act', who: 'mother', act: 'recoil' }, { t: 'say', who: 'mother', text: '湯裡有死蜥蜴！' }] },
        { t: 'together', cues: [{ t: 'walk', who: 'father', to: 'beside' }, { t: 'walk', who: 'daughter', to: 'peek' }] },
        { t: 'act', who: 'daughter', act: 'look', to: 'mother' }]),
    B('下午', '整罐湯都不能吃了，瓦罐也要打破。父親把瓦罐抱起來，摔在地上。',
      { text: '死的掉進瓦器，裡面的東西都不潔淨，瓦器要打破', status: 'explicit', refs: ['利11:33'], q: '你們要把這瓦器打破了' },
      [{ t: 'say', who: 'father', text: '這罐不能要了。', to: 'mother' }, { t: 'walk', who: 'father', to: 'potF' }, { t: 'cam', view: 'smash' },
        { t: 'act', who: 'father', act: 'smash' }, { t: 'wait', ms: 500 }], VOICES_11.clay),
    B('下午', '死蜥蜴被甩了出來，正好掉進桌上的木碗。木碗不必打破，泡在水裡，到晚上就潔淨了。',
      { text: '木器放在水中，到晚上才潔淨', status: 'explicit', refs: ['利11:32'], q: '須要放在水中，必不潔淨到晚上，到晚上才潔淨了' },
      [{ t: 'walk', who: 'father', to: 'beside' }, { t: 'cam', view: 'bowlClose' }, { t: 'wait', ms: 1500 }]),
    B('下午', '母親用手把死蜥蜴撿出來，丟到外面，再把木碗泡進水盆。她摸過牠，從這一刻起，她不潔淨到晚上。',
      { text: '摸了死的爬物，不潔淨到晚上', status: 'explicit', refs: ['利11:31'], q: '凡摸了的，必不潔淨到晚上' },
      [{ t: 'walk', who: 'mother', to: 'bowlBy' }, { t: 'act', who: 'mother', act: 'pick' }, { t: 'mark', who: 'mother', mark: 'evening' }, { t: 'wait', ms: 500 },
        { t: 'cam', view: 'dump' }, { t: 'walk', who: 'mother', to: 'edge' }, { t: 'act', who: 'mother', act: 'throw' },
        { t: 'walk', who: 'mother', to: 'bowlBy' }, { t: 'prop', id: 'bowl', state: 'carry:mother' }, { t: 'cam', view: 'basinDip' },
        { t: 'walk', who: 'mother', to: 'basinM' }, { t: 'act', who: 'mother', act: 'dip' }, { t: 'prop', id: 'bowl', state: 'water' }]),
    B('傍晚以前', '到晚上以前，有一件事她不能做：吃獻給耶和華的平安祭肉。',
      { text: '身上不潔淨的人，不可吃獻給耶和華的平安祭肉', status: 'explicit', refs: ['利7:20-21'], q: '吃了獻與耶和華平安祭的肉，這人必從民中剪除' },
      [{ t: 'sky', sky: 'dusk' }, { t: 'cam', view: 'reachLook' }, { t: 'act', who: 'mother', act: 'look', toward: 'gate' }, { t: 'wait', ms: 600 },
        { t: 'bar', on: true }, { t: 'cam', view: 'reach' }, { t: 'wait', ms: 1600 }]),
    B('晚上', '太陽下山，一天過去了。母親身上的不潔淨過去了，她把木碗從水裡拿出來。',
      { text: '到晚上，人和器物都潔淨了', status: 'explicit', refs: ['利11:31-32'], q: '到晚上才潔淨了' },
      [{ t: 'bar', on: false }, { t: 'prop', id: 'pot', state: 'gone' }, { t: 'cam', view: 'sunsetW', cut: true },
        { t: 'together', cues: [{ t: 'sunset' }, { t: 'walk', who: 'father', to: 'fireF' }, { t: 'walk', who: 'daughter', to: 'fireD' }] },
        { t: 'cam', view: 'basinDip', cut: true }, { t: 'mark', who: 'mother', mark: 'clean' },
        { t: 'prop', id: 'bowl', state: 'carry:mother' }, { t: 'walk', who: 'mother', to: 'bowlBy' }, { t: 'prop', id: 'bowl', state: 'out' },
        { t: 'cam', view: 'fireNight' }, { t: 'walk', who: 'mother', to: 'fireM' }],
      VOICES_11.evening),
    B('晚上', '一家人圍著火。女兒問：「要是死蜥蜴掉在爐子上、種子上呢？」母親說：「經文都寫了，我們一樣一樣看。」',
      { text: '死的掉在不同的東西上，經文分別交代怎麼處理', status: 'synthesis', refs: ['利11:32-38'] },
      [{ t: 'act', who: 'mother', act: 'look', to: 'daughter' }, { t: 'cam', view: 'askD', cut: true },
        { t: 'say', who: 'daughter', text: '要是牠掉在爐子上、種子上呢？', to: 'mother' }, { t: 'wait', ms: 900 },
        { t: 'cam', view: 'askM' },
        { t: 'say', who: 'mother', text: '經文都寫了，我們一樣一樣看。', to: 'daughter' }]),
  ],
};

export function reelFacts(): Fact[] {
  return [REEL_11].flatMap((r) => r.beats.map((b) => b.rule));
}
