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
      [{ t: 'sky', sky: 'day' }, { t: 'at', who: 'mother', to: 'yard' }, { t: 'at', who: 'father', to: 'home' }, { t: 'at', who: 'daughter', to: 'basin' },
        { t: 'prop', id: 'pot', state: 'whole' }, { t: 'prop', id: 'bowl', state: 'out' }, { t: 'prop', id: 'fire', state: 'on' }, { t: 'cam', view: 'yard' }]),
    B('下午', '她掀開瓦罐，看見一隻死了的蜥蜴掉在湯裡。',
      { text: '蜥蜴是地上不潔淨的爬物之一', status: 'explicit', refs: ['利11:29'], q: '蜥蜴與其類' },
      [{ t: 'walk', who: 'mother', to: 'pot' }, { t: 'prop', id: 'lizard', state: 'pot' }, { t: 'act', who: 'mother', act: 'look' }, { t: 'cam', view: 'pot' }]),
    B('下午', '整罐湯都不能吃了，瓦罐也要打破。',
      { text: '死的掉進瓦器，裡面的東西都不潔淨，瓦器要打破', status: 'explicit', refs: ['利11:33'], q: '你們要把這瓦器打破了' },
      [{ t: 'prop', id: 'pot', state: 'broken' }], VOICES_11.clay),
    B('下午', '旁邊的木碗也沾到了。木碗不必打破，泡在水裡，到晚上就潔淨了。',
      { text: '木器放在水中，到晚上才潔淨', status: 'explicit', refs: ['利11:32'], q: '須要放在水中，必不潔淨到晚上，到晚上才潔淨了' },
      [{ t: 'act', who: 'mother', act: 'dip' }, { t: 'prop', id: 'bowl', state: 'water' }, { t: 'cam', view: 'basin' }]),
    B('下午', '母親用手把死蜥蜴撿起來，丟到外面。她摸過牠，從這一刻起，她不潔淨到晚上。',
      { text: '摸了死的爬物，不潔淨到晚上', status: 'explicit', refs: ['利11:31'], q: '凡摸了的，必不潔淨到晚上' },
      [{ t: 'walk', who: 'mother', to: 'pot' }, { t: 'act', who: 'mother', act: 'pick' }, { t: 'act', who: 'mother', act: 'throw' }, { t: 'mark', who: 'mother', mark: 'evening' }, { t: 'cam', view: 'yard' }]),
    B('傍晚以前', '到晚上以前，有一件事她不能做：吃獻給耶和華的平安祭肉。',
      { text: '身上不潔淨的人，不可吃獻給耶和華的平安祭肉', status: 'explicit', refs: ['利7:20-21'], q: '吃了獻與耶和華平安祭的肉，這人必從民中剪除' },
      [{ t: 'bar', on: true }, { t: 'cam', view: 'reach' }]),
    B('晚上', '太陽下山，一天過去了。木碗從水裡拿出來，母親身上的不潔淨也過去了。',
      { text: '到晚上，人和器物都潔淨了', status: 'explicit', refs: ['利11:31-32'], q: '到晚上才潔淨了' },
      [{ t: 'sky', sky: 'night' }, { t: 'mark', who: 'mother', mark: 'clean' }, { t: 'prop', id: 'bowl', state: 'out' }, { t: 'bar', on: false }, { t: 'prop', id: 'fire', state: 'on' }, { t: 'cam', view: 'night' }],
      VOICES_11.evening),
    B('隔天早上', '女兒問：「那到底什麼可以吃，什麼不可以吃？」母親說：「經文都寫了，我們一樣一樣看。」',
      { text: '這份條例就是要把可吃的與不可吃的分別出來', status: 'explicit', refs: ['利11:47'], q: '要把潔淨的和不潔淨的，可吃的與不可吃的活物，都分別出來' },
      [{ t: 'sky', sky: 'dawn' }, { t: 'cam', view: 'talk' }, { t: 'walk', who: 'daughter', to: 'beside' },
        { t: 'say', who: 'daughter', text: '什麼可以吃？什麼不可以吃？', to: 'mother' },
        { t: 'say', who: 'mother', text: '經文都寫了，我們一樣一樣看。', to: 'daughter' }]),
  ],
};

export function reelFacts(): Fact[] {
  return [REEL_11].flatMap((r) => r.beats.map((b) => b.rule));
}
