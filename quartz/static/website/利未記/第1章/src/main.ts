import './styles.css';
import './story.css';
import { SCENE_BY_ID, type SceneId } from './data/story';
import type { OfferingId } from './data/types';
import { emit, on } from './ui/dom';
import { buildIntro } from './ui/scene-intro';
import { buildAbout, buildPlaceholder, buildVoices } from './ui/scene-misc';
import { buildEighth, buildManual, buildOrdination, buildReview } from './ui/scene-later';
import { buildOffering } from './ui/scene-offering';
import { currentScene, mountShell, sceneHref } from './ui/shell';

/**
 * 照利未記 1–9 章的順序，一幕一頁（網址 #/burnt 這樣切換）。
 * 每一幕上層是重點、下層是可展開的細節；註釋分歧集中在最後一幕。
 */
function build(id: SceneId | 'about'): HTMLElement {
  if (id === 'about') return buildAbout();
  const s = SCENE_BY_ID[id];
  if (!s.ready) return buildPlaceholder(s);
  if (id === 'intro') return buildIntro();
  if (id === 'voices') return buildVoices();
  if (id === 'manual') return buildManual();
  if (id === 'ordination') return buildOrdination();
  if (id === 'eighth') return buildEighth();
  if (id === 'review') return buildReview();
  return buildOffering(id as OfferingId);
}

mountShell(build);

// 器具說明裡的「走一次某祭」：換到那一幕，打開一步一步看
on('choose-offering', (d: { offering: OfferingId }) => {
  if (currentScene() !== d.offering) location.hash = sceneHref(d.offering);
  setTimeout(() => emit('open-steps'), 50);
});
