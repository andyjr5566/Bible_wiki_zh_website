import type { AppPort } from '../types/app';
import type { ExperienceMode } from '../types/ui';

const modes: Array<{ id: ExperienceMode; label: string; shortcut?: string }> = [
  { id: 'overview', label: '場景總覽' },
  { id: 'tour', label: '五站導覽' },
  { id: 'learning', label: '器物與經文' },
];

export class ModeNavigation {
  readonly #buttons = new Map<ExperienceMode, HTMLButtonElement>();
  #app: AppPort | null = null;

  constructor(readonly element: HTMLElement) {
    element.setAttribute('aria-label', '體驗模式');
    modes.forEach(({ id, label, shortcut }) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'mode-button';
      button.dataset.mode = id;
      button.setAttribute('aria-label', `${label}模式`);
      button.innerHTML = `<span>${label}</span>${shortcut ? `<kbd>${shortcut}</kbd>` : ''}`;
      button.addEventListener('click', this.#onClick);
      element.append(button);
      this.#buttons.set(id, button);
    });
  }

  bind(app: AppPort): void { this.#app = app; }
  render(mode: ExperienceMode): void {
    this.#buttons.forEach((button, id) => {
      button.classList.toggle('is-active', id === mode);
      button.setAttribute('aria-pressed', String(id === mode));
    });
  }
  dispose(): void { this.#buttons.forEach((button) => button.removeEventListener('click', this.#onClick)); }

  readonly #onClick = (event: Event): void => {
    const mode = (event.currentTarget as HTMLButtonElement).dataset.mode as ExperienceMode | undefined;
    if (mode) this.#app?.transitionTo(mode, `mode-navigation:${mode}`);
  };
}
