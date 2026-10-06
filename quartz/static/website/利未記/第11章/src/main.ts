import './styles.css';
import './story.css';
import './purity.css';
import './edition.css';
import { SCENE_BY_ID, type SceneId } from './data/story';
import { buildC11 } from './ui/scene-11';
import { buildC12 } from './ui/scene-12';
import { buildC13 } from './ui/scene-13';
import { buildC14 } from './ui/scene-14';
import { buildC15 } from './ui/scene-15';
import { buildOverview } from './ui/scene-overview';
import { buildVoices } from './ui/scene-voices';
import { buildIntro } from './ui/scene-intro';
import { buildAbout, buildPlaceholder } from './ui/scene-misc';
import { mountShell } from './ui/shell';

/**
 * 照利未記 11–15 章的順序，一幕一頁（網址 #/c11 這樣切換）。
 * 每一章跟著同一家人（虛構）走一遍；規矩一律附經節，註釋分歧集中在最後一幕。
 */
function build(id: SceneId | 'about'): HTMLElement {
  if (id === 'about') return buildAbout();
  const s = SCENE_BY_ID[id];
  if (!s.ready) return buildPlaceholder(s);
  if (id === 'intro') return buildIntro();
  if (id === 'c11') return buildC11();
  if (id === 'c12') return buildC12();
  if (id === 'c13') return buildC13();
  if (id === 'c14') return buildC14();
  if (id === 'c15') return buildC15();
  if (id === 'overview') return buildOverview();
  if (id === 'voices') return buildVoices();
  return buildPlaceholder(s);
}

mountShell(build);
