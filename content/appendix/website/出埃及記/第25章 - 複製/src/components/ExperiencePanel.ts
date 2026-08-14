import type { AppPort } from '../types/app';
import type { ExperienceState } from '../types/experience';
import type { ExperienceMode } from '../types/ui';

const confidenceLabels = {
  textual: '經文明載',
  'strong-inference': '強推論',
  reconstructed: '教學重建',
  illustrative: '示意呈現',
} as const;

const objectOrder = [
  ['burnt-altar', '燔祭壇'],
  ['laver', '洗濯盆'],
  ['incense-altar', '香壇'],
  ['menorah', '金燈臺'],
  ['shewbread-table', '陳設餅桌'],
  ['ark', '約櫃'],
] as const;

const ritualLabels: Record<string, string> = {
  'priestly-washing': '播放洗濯程序',
  'incense-service': '播放獻香程序',
};

const scriptureContextLabels = {
  design: '製作指示',
  construction: '實作記錄',
  placement: '空間配置',
  service: '事奉規範',
  reflection: '後世回顧',
} as const;

const tourDescriptions: Record<string, string> = {
  'tour-east-gate': '先確認入口與東西向；接著沿同一條中軸向內觀看。',
  'tour-burnt-altar': '外院首先遇見燔祭壇。經文描述它的材料、尺寸、器具與搬運方式。',
  'tour-laver': '洗濯盆位於壇與會幕之間，與祭司進入供職前的洗濯有關。',
  'tour-holy-place': '聖所內有燈臺、陳設餅桌與香壇；畫面屬依經文位置所作的視覺重建。',
  'tour-most-holy': '幔子分隔至聖所；約櫃與施恩座是這條空間軸線的終點。',
};

export class ExperiencePanel {
  #app: AppPort | null = null;
  #renderKey: string | null = null;
  constructor(readonly element: HTMLElement) { element.addEventListener('click', this.#onClick); }
  bind(app: AppPort): void { this.#app = app; }

  render(mode: ExperienceMode, state: Readonly<ExperienceState>): void {
    const renderKey = [
      mode,
      state.creditsOpen,
      state.assetProfile,
      state.tour.index,
      state.tour.total,
      state.tour.current?.id ?? '',
      state.tour.playing,
      state.learning.objectId ?? '',
      state.ritual.playback.ritualId ?? '',
      state.ritual.playback.stepIndex,
      state.ritual.playback.status,
    ].join('|');
    if (renderKey === this.#renderKey) return;
    this.#renderKey = renderKey;
    const main = mode === 'tour' ? renderTour(state) : mode === 'learning' ? renderLearning(state) : renderOverview(state);
    this.element.innerHTML = main + (state.creditsOpen ? renderCredits(this.#app?.getAttributions() ?? []) : '');
    this.syncMobileDrawers(state);
  }

  dispose(): void { this.element.removeEventListener('click', this.#onClick); }

  private syncMobileDrawers(state: Readonly<ExperienceState>): void {
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 620px)').matches;
    const ritualOpen = state.ritual.playback.status !== 'idle';
    this.element.querySelectorAll<HTMLDetailsElement>('.mobile-drawer').forEach((drawer) => {
      drawer.open = !isMobile || ritualOpen;
    });
  }

  readonly #onClick = (event: Event): void => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-mode-jump],[data-tour-command],[data-learning-object],[data-ritual-id],[data-ritual-command],[data-credits]');
    if (!target || !this.#app) return;
    if (target.dataset.modeJump) this.#app.transitionTo(target.dataset.modeJump as ExperienceMode, `quick-start:${target.dataset.modeJump}`);
    if (target.dataset.tourCommand) this.#app.commandTour(target.dataset.tourCommand as Parameters<AppPort['commandTour']>[0]);
    if (target.dataset.learningObject) this.#app.selectLearningObject(target.dataset.learningObject);
    if (target.dataset.ritualId) this.#app.startRitual(target.dataset.ritualId);
    if (target.dataset.ritualCommand) this.#app.commandRitual(target.dataset.ritualCommand as Parameters<AppPort['commandRitual']>[0]);
    if (target.dataset.credits) this.#app.setCreditsOpen(target.dataset.credits === 'open');
  };
}

function renderOverview(state: Readonly<ExperienceState>): string {
  return `<section class="panel-card intro-card" aria-labelledby="overview-title">
    <p class="section-kicker">3D 快速開始</p>
    <h2 id="overview-title">拖曳畫面，就能環視會幕</h2>
    <p class="intro-lede">按住滑鼠左鍵拖曳以旋轉，使用滾輪拉近或縮遠。第一次使用，建議先從五站導覽開始。</p>
    <ol class="quick-steps"><li><b>拖曳</b><span>旋轉 3D 視角</span></li><li><b>滾輪</b><span>拉近或縮遠</span></li><li><b>選器物</b><span>查看經文註解</span></li></ol>
    <div class="quick-actions"><button type="button" class="primary-button" data-mode-jump="tour">開始五站導覽</button><button type="button" data-mode-jump="learning">查看器物與經文</button></div>
    <p class="orientation-note"><strong>空間方向：</strong>從東門進入，依序經過燔祭壇、洗濯盆、聖所與至聖所。</p>
    <div class="route-line" aria-label="由東向西的空間順序"><span>東門</span><i></i><span>燔祭壇</span><i></i><span>洗濯盆</span><i></i><span>至聖所</span></div>
    <dl class="micro-stats"><div><dt>目前模型</dt><dd>${state.assetProfile === 'desktop-high' ? '完整會幕' : state.assetProfile === 'desktop-structural' ? '框架剖面' : '低模備援'}</dd></div><div><dt>使用性質</dt><dd>非商業 · 教學重建</dd></div></dl>
    <p class="reconstruction-note">遠山、沙丘與營帳群取自參考圖的空間氣氛，只作重建脈絡，不主張營位數量或配置是經文明載。</p>
  </section>`;
}

function renderTour(state: Readonly<ExperienceState>): string {
  const stop = state.tour.current;
  return `<section class="panel-card" aria-labelledby="tour-title" data-testid="tour-panel">
    <p class="section-kicker">五站導覽 · ${state.tour.index + 1}/${state.tour.total}</p>
    <h2 id="tour-title" data-testid="tour-step">${escapeHtml(stop?.title ?? '導覽')}</h2>
    <details class="mobile-drawer tour-context-drawer"><summary>本站說明</summary><p class="tour-description">${escapeHtml(stop ? tourDescriptions[stop.id] ?? '' : '')}</p><p class="tour-reference">經文起點：${escapeHtml(stop?.scriptureReference ?? '依據會幕空間順序')}</p>${stop?.scriptureText ? `<details class="scripture-quote tour-scripture-quote"><summary>展開和合本原文</summary><p class="scripture-quote-label">${escapeHtml(stop.scriptureReference ?? '')} · 和合本（UNV）</p><p class="scripture-quote-text">${escapeHtml(stop.scriptureText)}</p></details>` : ''}</details>
    <div class="tour-progress"><span style="width:${state.tour.total ? ((state.tour.index + 1) / state.tour.total) * 100 : 0}%"></span></div>
    <div class="control-row">
      <button type="button" data-tour-command="previous" ${state.tour.index === 0 ? 'disabled' : ''}>← 上一站</button>
      <button type="button" class="primary-button" data-tour-command="next" ${state.tour.index >= state.tour.total - 1 ? 'disabled' : ''}>${state.tour.index >= state.tour.total - 1 ? '已到最後一站' : '下一站 →'}</button>
      <button type="button" data-tour-command="close">結束導覽</button>
    </div>
  </section>`;
}

function renderLearning(state: Readonly<ExperienceState>): string {
  const learning = state.learning;
  const confidence = learning.confidence ? confidenceLabels[learning.confidence] : null;
  const objects = objectOrder.map(([id, label]) => `<button type="button" data-learning-object="${id}" class="object-chip ${learning.objectId === id ? 'is-active' : ''}">${label}</button>`).join('');
  const scriptures = learning.scriptureReferences.length
    ? learning.scriptureReferences.map(({ id, summary, annotation, originalText, context }) => `<li><div class="scripture-head"><span class="scripture-context">${scriptureContextLabels[context]}</span><strong>${escapeHtml(id)}</strong></div><b>${escapeHtml(summary)}</b><span>${escapeHtml(annotation)}</span><details class="scripture-quote"><summary>展開和合本原文</summary><p class="scripture-quote-label">${escapeHtml(id)} · 和合本（UNV）</p><p class="scripture-quote-text">${escapeHtml(originalText)}</p></details></li>`).join('')
    : '<li><span>請選擇器物查看經文註解。</span></li>';
  const rituals = learning.ritualIds.filter((id) => id in ritualLabels).map((id) => `<button type="button" class="primary-button" data-ritual-id="${id}">${ritualLabels[id]}</button>`).join('');
  return `<section class="panel-card learning-card" aria-labelledby="learning-title" data-testid="learning-panel">
    <p class="section-kicker">選擇器物 · 查看經文</p>
    <div class="title-with-badge"><h2 id="learning-title">${escapeHtml(learning.objectName ?? '器物研讀')}</h2>${confidence ? `<span class="confidence ${learning.confidence}">${confidence}</span>` : ''}</div>
    <p class="location-label">位置：${escapeHtml(learning.locationName ?? '—')}</p>
    <nav class="object-grid" aria-label="器物選擇">${objects}</nav>
    <details class="mobile-drawer learning-details"><summary>查看經文註解</summary>
      <p class="scripture-intro">下列註解分開標示製作指示、實作記錄、空間配置與事奉規範；摘要不是經文逐字翻譯。點「展開和合本原文」可查看對應段落。</p>
      <ul class="scripture-list">${scriptures}</ul>
      ${rituals ? `<div class="ritual-launchers">${rituals}</div>` : ''}
      ${renderRitual(state)}
      <details class="disclosure"><summary>人物與服飾的重建界線</summary><p>${escapeHtml(state.character.disclosure)}</p><p data-testid="character-status">人物視覺：本版不展示</p></details>
    </details>
  </section>`;
}

function renderRitual(state: Readonly<ExperienceState>): string {
  if (state.ritual.playback.status === 'idle') return '';
  return `<section class="ritual-player" data-testid="ritual-panel" aria-label="儀式程序播放">
    <div><span class="ritual-state">${state.ritual.playback.status}</span><h3>${escapeHtml(state.ritual.name ?? '')}</h3></div>
    <strong>${escapeHtml(state.ritual.stepTitle ?? '')}</strong>
    <p>${escapeHtml(state.ritual.instruction ?? '')}</p>
    <p class="reference-line">${state.ritual.scriptureReferences.map(escapeHtml).join(' · ')}</p>
    <div class="control-row">
      <button type="button" data-ritual-command="play-pause">${state.ritual.playback.status === 'playing' ? '暫停' : '繼續'}</button>
      <button type="button" data-ritual-command="next">完成步驟</button>
      <button type="button" data-ritual-command="close">關閉</button>
    </div>
  </section>`;
}

function renderCredits(attributions: ReturnType<AppPort['getAttributions']>): string {
  const rows = attributions.map((item) => `<li><a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.id)}</a><span>${escapeHtml(item.author)} · ${escapeHtml(item.license)}</span></li>`).join('');
  return `<section class="credits-sheet" data-testid="credits-panel" aria-label="資產授權與署名"><div class="credits-head"><div><p class="section-kicker">ATTRIBUTION REGISTER</p><h2>資產授權與來源</h2></div><button type="button" data-credits="close">關閉</button></div><p class="noncommercial-notice">本網站與其中 CC BY-NC 資產僅供非商業教育及研讀使用。各模型著作權與授權仍歸原作者。</p><ul>${rows}</ul></section>`;
}

function escapeHtml(value: string): string { return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character); }
