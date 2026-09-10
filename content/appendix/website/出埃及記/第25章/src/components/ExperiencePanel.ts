import type { AppPort } from '../types/app';
import type { EvidenceClaimView, EvidenceSourceView, ExperienceState, ObjectDetailView } from '../types/experience';
import type { OfferingComparisonDefinition } from '../types/offerings';
import type { ExperienceMode } from '../types/ui';

const confidenceLabels = {
  textual: '經文明載',
  'strong-inference': '強推論',
  reconstructed: '教學重建',
  illustrative: '示意呈現',
} as const;

const scriptureContextLabels = {
  design: '製作指示',
  construction: '實作記錄',
  placement: '空間配置',
  service: '事奉規範',
  reflection: '後世回顧',
} as const;
const evidenceKindLabels = {
  scripture: '經文', commentary: '註釋', archaeology: '考古比較', asset: '資產', engineering: '工程假設',
} as const;
const profileLabels = { 'desktop-high': '完整會幕', 'desktop-structural': '框架剖面', 'fallback-low': '低模備援' } as const;

export class ExperiencePanel {
  #app: AppPort | null = null;
  #renderKey: string | null = null;
  constructor(readonly element: HTMLElement) { element.addEventListener('click', this.#onClick); }
  bind(app: AppPort): void { this.#app = app; }

  setMobileDrawerState(state: 'collapsed' | 'half' | 'reading'): void {
    if (typeof window === 'undefined' || !window.matchMedia('(max-width: 620px)').matches) return;
    this.element.querySelectorAll<HTMLDetailsElement>('.mobile-drawer').forEach((drawer) => {
      drawer.open = state === 'reading';
    });
  }

  render(mode: ExperienceMode, state: Readonly<ExperienceState>): void {
    const renderKey = [mode, state.creditsOpen, state.assetProfile, state.tour.index, state.tour.total, state.tour.current?.id ?? '', state.tour.current?.activeHotspotId ?? '', state.tour.current?.hotspots.map(({ id }) => id).join(',') ?? '', state.tour.playing, state.learning.objectId ?? '', state.learning.selectedPartId ?? '', state.learning.evidence.map(({ id }) => id).join(','), state.ritual.playback.ritualId ?? '', state.ritual.playback.stepIndex, state.ritual.playback.status, state.character.id, state.character.garmentState].join('|');
    if (renderKey === this.#renderKey) return;
    this.#renderKey = renderKey;
    const main = mode === 'tour' ? renderTour(state) : mode === 'learning' || mode === 'ritual' ? renderLearning(state) : renderOverview(state);
    this.element.innerHTML = main + (state.creditsOpen ? renderCredits(this.#app?.getAttributions() ?? [], this.#app?.getEvidenceSources?.() ?? []) : '');
    this.syncMobileDrawers(state);
  }

  dispose(): void { this.element.removeEventListener('click', this.#onClick); }

  private syncMobileDrawers(state: Readonly<ExperienceState>): void {
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 620px)').matches;
    const ritualOpen = state.ritual.playback.status !== 'idle';
    this.element.querySelectorAll<HTMLDetailsElement>('.mobile-drawer').forEach((drawer) => { drawer.open = !isMobile || ritualOpen; });
  }

  readonly #onClick = (event: Event): void => {
    const target = (event.target as HTMLElement).closest<HTMLElement>('[data-start-cinematic],[data-mode-jump],[data-tour-command],[data-tour-hotspot],[data-learning-object],[data-learning-part],[data-learning-part-clear],[data-ritual-id],[data-ritual-command],[data-credits]');
    if (!target || !this.#app) return;
    if (target.dataset.startCinematic) this.#app.startCinematicTour();
    if (target.dataset.modeJump) this.#app.transitionTo(target.dataset.modeJump as ExperienceMode, `quick-start:${target.dataset.modeJump}`);
    if (target.dataset.tourCommand) this.#app.commandTour(target.dataset.tourCommand as Parameters<AppPort['commandTour']>[0]);
    if (target.dataset.tourHotspot) this.#app.selectTourHotspot(target.dataset.tourHotspot);
    if (target.dataset.learningObject) this.#app.selectLearningObject(target.dataset.learningObject);
    if (target.dataset.learningPart) this.#app.selectLearningPart?.(target.dataset.learningPart);
    if (target.dataset.learningPartClear !== undefined) this.#app.selectLearningPart?.(null);
    if (target.dataset.ritualId) this.#app.startRitual(target.dataset.ritualId);
    if (target.dataset.ritualCommand) this.#app.commandRitual(target.dataset.ritualCommand as Parameters<AppPort['commandRitual']>[0]);
    if (target.dataset.credits) this.#app.setCreditsOpen(target.dataset.credits === 'open');
  };
}

function renderOverview(state: Readonly<ExperienceState>): string {
  return `<section class="panel-card intro-card" aria-labelledby="overview-title">
    <p class="section-kicker">3D 探索指南</p>
    <h2 id="overview-title">拖曳畫面，探索聖所空間</h2>
    <p class="intro-lede">按住滑鼠左鍵拖曳環視，滾輪縮放；可以啟動逐幕導覽，或點選器物查看考據。</p>
    <button type="button" class="cinema-launch-banner" data-start-cinematic="true"><span class="banner-play-icon">▶</span><div><strong>啟動逐幕 3D 導覽</strong><p>自動運鏡 · 逐段經文字幕 · 3D 尺寸標尺</p></div></button>
    <ol class="quick-steps"><li><b>拖曳</b><span>旋轉 3D 視角</span></li><li><b>滾輪</b><span>拉近或縮遠</span></li><li><b>選器物</b><span>查看考據註解</span></li></ol>
    <div class="quick-actions"><button type="button" class="primary-button" data-mode-jump="tour">五站導覽</button><button type="button" data-mode-jump="learning">查看器物與經文</button></div>
    <p class="orientation-note"><strong>空間方向：</strong>由東門進入，依序經過燔祭壇、洗濯盆、聖所與至聖所。</p>
    <div class="route-line" aria-label="由東向西的空間順序"><span>東門入口</span><i></i><span>燔祭壇</span><i></i><span>洗濯盆</span><i></i><span>聖所</span><i></i><span>至聖所約櫃</span></div>
    <dl class="micro-stats"><div><dt>目前模型方案</dt><dd>${state.assetProfile === 'desktop-high' ? '完整會幕' : state.assetProfile === 'desktop-structural' ? '框架剖面' : '低模備援'}</dd></div><div><dt>使用性質</dt><dd>非商業 · 聖經研讀</dd></div></dl>
    <p class="reconstruction-note">環境光影、沙丘與營帳群是教學重建參考；尺寸與材質的依據可在器物面板查閱。</p>
  </section>`;
}

function renderTour(state: Readonly<ExperienceState>): string {
  const stop = state.tour.current;
  const hotspots = stop?.hotspots?.length ? `<nav class="tour-hotspots" aria-label="${escapeHtml(stop.title)}熱點">${stop.hotspots.map((hotspot) => `<button type="button" data-tour-hotspot="${escapeHtml(hotspot.id)}" class="${stop.activeHotspotId === hotspot.id ? 'is-active' : ''}" aria-pressed="${String(stop.activeHotspotId === hotspot.id)}">${escapeHtml(hotspot.label)}</button>`).join('')}</nav>` : '';
  return `<section class="panel-card" aria-labelledby="tour-title" data-testid="tour-panel">
    <p class="section-kicker">五站導覽 · ${state.tour.index + 1}/${state.tour.total}</p><h2 id="tour-title" data-testid="tour-step">${escapeHtml(stop?.title ?? '導覽')}</h2>
    <details class="mobile-drawer tour-context-drawer" open><summary>本站說明</summary><p class="tour-description">${escapeHtml(stop?.summary ?? '')}</p><p class="tour-reference">經文起點：${escapeHtml(stop?.scriptureReference ?? '依據會幕空間順序')}</p>${hotspots}${stop?.scriptureText ? `<details class="scripture-quote tour-scripture-quote"><summary>展開和合本原文</summary><p class="scripture-quote-label">${escapeHtml(stop.scriptureReference ?? '')} · 和合本（UNV）</p><p class="scripture-quote-text">${escapeHtml(stop.scriptureText)}</p></details>` : ''}</details>
    <div class="tour-progress"><span style="width:${state.tour.total ? ((state.tour.index + 1) / state.tour.total) * 100 : 0}%"></span></div><div class="control-row"><button type="button" data-tour-command="previous" ${state.tour.index === 0 ? 'disabled' : ''}>← 上一站</button><button type="button" class="primary-button" data-tour-command="next" ${state.tour.index >= state.tour.total - 1 ? 'disabled' : ''}>${state.tour.index >= state.tour.total - 1 ? '已到最後一站' : '下一站 →'}</button><button type="button" data-tour-command="close">結束導覽</button></div>
  </section>`;
}

function renderLearning(state: Readonly<ExperienceState>): string {
  const learning = state.learning;
  const detail = learning.detail;
  const objects = learning.availableObjects.map(({ id, name }) => `<button type="button" data-learning-object="${escapeHtml(id)}" class="object-chip ${learning.objectId === id ? 'is-active' : ''}" aria-pressed="${String(learning.objectId === id)}">${escapeHtml(name)}</button>`).join('');
  const scriptures = learning.scriptureReferences.map(({ id, summary, annotation, originalText }) => `<li><strong>${escapeHtml(id)}</strong><b>${escapeHtml(summary)}</b><span>${escapeHtml(annotation)}</span><details class="scripture-quote"><summary>展開和合本原文</summary><p class="scripture-quote-text">${escapeHtml(originalText)}</p></details></li>`).join('');
  return `<section class="panel-card learning-card" aria-labelledby="learning-title" data-testid="learning-panel">
    <p class="section-kicker">器物與經文</p><h2 id="learning-title">${escapeHtml(learning.objectName ?? '選擇器物')}</h2>
    <nav class="object-grid" aria-label="器物選擇">${objects}</nav>
    <p class="location-label">位置：${escapeHtml(learning.locationName ?? '—')}</p>
    ${detail ? `<div class="object-facts"><p>${escapeHtml(detail.summary)}</p><div class="meta-row"><span>尺寸：</span><strong>${escapeHtml(formatDimensions(detail.dimensions))}</strong></div><div class="meta-row"><span>材料：</span><strong>${escapeHtml(detail.materials.join('、'))}</strong></div></div>` : ''}
    <p class="reconstruction-note">拖曳旋轉、滾輪縮放。模型為教學重建。</p>
    <details class="learning-scriptures" open><summary>相關經文</summary><ul class="scripture-list">${scriptures}</ul></details>
    <details class="learning-evidence"><summary>尺寸說明與資料來源</summary>${detail ? `<p>${escapeHtml(detail.dimensions.displayNote)}</p><p>部件：${detail.parts.map(({ label }) => escapeHtml(label)).join('、')}</p>` : ''}${learning.evidence.map(renderEvidenceClaim).join('')}</details>
  </section>`;
}

function renderParts(detail: ObjectDetailView, selectedPartId: string | null): string {
  return `<ul class="part-list">${detail.parts.map((part) => `<li><button type="button" class="part-chip ${selectedPartId === part.id ? 'is-active' : ''}" data-learning-part="${escapeHtml(part.id)}" aria-pressed="${String(selectedPartId === part.id)}"><strong>${escapeHtml(part.label)}</strong><span class="part-status ${part.mappingStatus}">${part.mappingStatus === 'verified' && part.nodeNames.length ? '3D 對應' : '重建／未詳'}</span></button></li>`).join('')}</ul>`;
}

export function renderEvidenceClaim(claim: EvidenceClaimView): string {
  const status = claim.status === 'verified' ? '已核准' : claim.status === 'unresolved' ? '未詳' : '已排除';
  const references = claim.references.map((reference) => {
    const source = reference.source;
    if (!source) return `<li><span>${escapeHtml(reference.sourceId)} · ${escapeHtml(reference.locator)}</span><em>來源未建檔，無法提供連結</em></li>`;
    const sourceLabel = `${source.title} · ${evidenceKindLabels[source.sourceType]} · ${source.date} · ${source.scope}`;
    const safeUrl = getSafeExternalUrl(source.url);
    const link = safeUrl ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">查閱來源</a>` : '<span class="source-no-link">離線來源摘要</span>';
    return `<li><div><strong>${escapeHtml(sourceLabel)}</strong><span>${escapeHtml(reference.locator)}</span></div>${link}<small>${escapeHtml(source.attribution)}</small></li>`;
  }).join('');
  const limits = claim.limits.length ? `<div class="evidence-limits"><b>限制：</b>${claim.limits.map(escapeHtml).join('；')}</div>` : '';
  return `<details class="evidence-card" data-claim-id="${escapeHtml(claim.id)}"><summary><span class="evidence-kind">${escapeHtml(evidenceKindLabels[claim.kind])}</span><strong>${escapeHtml(claim.id)}</strong><span class="evidence-status ${claim.status}">${status}</span></summary><p class="evidence-claim">${escapeHtml(claim.statement)}</p><ul class="evidence-references">${references}</ul>${limits}</details>`;
}

function renderOfferingComparison(comparisons: OfferingComparisonDefinition[]): string {
  const actorLabels = { 'offering-person': '獻祭者', priest: '祭司', both: '獻祭者／祭司' } as const;
  const rows = comparisons.map((comparison) => `<details class="offering-row" data-offering-id="${escapeHtml(comparison.id)}" open><summary class="offering-row-head"><h3>${escapeHtml(comparison.label)}</h3><span class="scripture-context">${escapeHtml(actorLabels[comparison.actorRole])}</span></summary><dl class="offering-facts"><div><dt>材料</dt><dd>${escapeHtml(comparison.materials)}</dd></div><div><dt>目的</dt><dd>${escapeHtml(comparison.purpose)}</dd></div><div><dt>地點</dt><dd>${escapeHtml(comparison.location)}</dd></div><div><dt>處理／可食</dt><dd>${escapeHtml(comparison.handling)}</dd></div></dl><p class="reference-line">${comparison.scriptureReferences.map(escapeHtml).join(' · ')}</p></details>`).join('');
  return `<section class="offering-comparison" data-testid="offering-comparison" aria-labelledby="offering-comparison-title"><div class="title-with-badge"><h3 id="offering-comparison-title">五祭比較</h3><span class="confidence">來源分支</span></div><p class="offering-intro">每一行保留材料、目的、行動者、地點與處理／可食界線；燔祭提供牛、羊／山羊、鳥三條核心回放分支。</p>${rows}</section>`;
}

function renderCharacter(state: Readonly<ExperienceState>): string {
  const character = state.character;
  const responsibilities = character.responsibilities.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
  const parts = character.parts.length
    ? `<ul class="character-parts">${character.parts.map((part) => `<li><strong>${escapeHtml(part.label)}</strong><span>${escapeHtml(part.claimedMaterials.join('、'))} · ${escapeHtml(part.quantity)}</span></li>`).join('')}</ul>`
    : '<p class="character-empty">這個服裝狀態沒有可核准的外觀部件，使用角色位置示意。</p>';
  const notes = character.validationNotes.map((note) => `<p class="character-warning">${escapeHtml(note)}</p>`).join('');
  const base = character.baseAssetId ? `技術基底：${character.baseAssetId}` : '技術基底：未指定';
  return `<details class="disclosure character-disclosure" open><summary>人物與服飾考據</summary><div class="character-card" data-testid="character-card" data-character-id="${escapeHtml(character.id)}" data-garment-state="${escapeHtml(character.garmentState)}"><div class="title-with-badge"><h3>${escapeHtml(character.name)}</h3><span class="confidence reconstructed">${escapeHtml(character.roleLabel)}</span></div><p class="character-meta">服裝狀態：${escapeHtml(character.garmentLabel)} · ${escapeHtml(base)}</p><p class="character-policy">${character.visualPolicy === 'technical-base-with-label' ? '技術基底＋經文部件標籤，屬教學重建。' : '角色位置示意，沒有核准的服裝外觀。'}</p><ul class="character-responsibilities">${responsibilities}</ul>${parts}${notes}<p data-testid="character-status">${escapeHtml(character.disclosure)}</p></div></details>`;
}

function formatDimensions(dimensions: ObjectDetailView['dimensions']): string {
  if (dimensions.status === 'unresolved') return '未詳（經文未載數值，不作換算）';
  return `長 ${dimensions.lengthCubits} 肘 × 寬 ${dimensions.widthCubits} 肘 × 高 ${dimensions.heightCubits} 肘（長度單位：肘）`;
}

function renderRitual(state: Readonly<ExperienceState>): string {
  if (state.ritual.playback.status === 'idle') return '';
  const progress = state.ritual.stepCount ? `步驟 ${state.ritual.stepIndex + 1}/${state.ritual.stepCount}` : '程序步驟';
  const unresolved = state.ritual.unresolved.length ? `<p class="ritual-unresolved">未詳：${state.ritual.unresolved.map(escapeHtml).join('、')}</p>` : '';
  return `<section class="ritual-player" data-testid="ritual-panel" aria-label="儀式程序播放"><div><span class="ritual-state">${escapeHtml(state.ritual.playback.status)} · ${progress}</span><h3>${escapeHtml(state.ritual.name ?? '')}</h3></div><strong>${escapeHtml(state.ritual.stepTitle ?? '')}</strong><p>${escapeHtml(state.ritual.instruction ?? '')}</p><p class="ritual-cue">${escapeHtml(state.ritual.displayCue ?? '')}</p><p class="reference-line">${state.ritual.scriptureReferences.map(escapeHtml).join(' · ')}</p>${unresolved}<div class="control-row"><button type="button" data-ritual-command="previous" ${state.ritual.stepIndex === 0 ? 'disabled' : ''}>← 上一步</button><button type="button" data-ritual-command="play-pause">${state.ritual.playback.status === 'playing' ? '暫停' : '繼續'}</button><button type="button" data-ritual-command="next" ${state.ritual.playback.status === 'complete' ? 'disabled' : ''}>${state.ritual.playback.status === 'complete' ? '已完成' : '下一步 →'}</button><button type="button" data-ritual-command="replay">重播</button><button type="button" data-ritual-command="close">退出</button></div></section>`;
}

function renderCredits(attributions: ReturnType<AppPort['getAttributions']>, sources: EvidenceSourceView[]): string {
  const rows = attributions.map((item) => `<li><a href="${escapeHtml(item.sourceUrl)}" target="_blank" rel="noreferrer">${escapeHtml(item.id)}</a><span>${escapeHtml(item.author)} · ${escapeHtml(item.license)}</span></li>`).join('');
  const sourceRows = sources.map((source) => { const safeUrl = getSafeExternalUrl(source.url); return `<li>${safeUrl ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noreferrer">${escapeHtml(source.id)}</a>` : `<span>${escapeHtml(source.id)}</span>`}<span>${escapeHtml(source.title)} · ${escapeHtml(source.attribution)}</span></li>`; }).join('');
  return `<section class="credits-sheet" data-testid="credits-panel" aria-label="資產授權與內容來源"><div class="credits-head"><div><p class="section-kicker">ATTRIBUTION REGISTER</p><h2>資產授權與內容來源</h2></div><button type="button" data-credits="close">關閉</button></div><section class="credits-group"><h3>3D 資產署名</h3><p class="noncommercial-notice">模型著作權與授權歸原作者；本站依各資產標示使用。</p><ul>${rows || '<li><span>目前沒有資產署名資料。</span></li>'}</ul></section><section class="credits-group"><h3>內容來源</h3><p class="noncommercial-notice">經文與研究來源和模型授權分開列示；外鏈失敗時仍保留離線摘要。</p><ul>${sourceRows || '<li><span>目前沒有內容來源資料。</span></li>'}</ul></section></section>`;
}

function getSafeExternalUrl(url: string | null): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    return parsed.protocol === 'https:' || parsed.protocol === 'http:' ? parsed.toString() : null;
  } catch {
    return null;
  }
}

function escapeHtml(value: string): string { return value.replace(/[&<>'"]/g, (character) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', "'": '&#39;', '"': '&quot;' })[character] ?? character); }
