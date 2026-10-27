import type { SiteData } from '../data/types';
import { scrollToElement } from './scroll';
import type { StoryState } from './state';

const SEC_ALIASES: Record<string, string> = {
  shape: '01',
  shechem: '02',
  stones: '03',
  burials: '04',
  forget: '05',
  views: '06',
  map: '07',
};

export function applyHashRoute(
  data: SiteData,
  state: StoryState,
  openPlacePeek: (placeId: string) => void,
  onStateChange: () => void,
): void {
  const raw = window.location.hash.replace(/^#/, '').trim();
  if (!raw) return;

  const params = new URLSearchParams(raw.includes('=') ? raw : `sec=${raw}`);

  const act = params.get('act');
  if (act) {
    const el =
      document.getElementById(`jos-seg-${act}`) ??
      document.getElementById(`jos-seg-act-${act}`);
    scrollToElement(el, state, undefined, onStateChange);
    return;
  }

  const beat = params.get('beat');
  if (beat) {
    const el =
      document.getElementById(`jos-beat-${beat}`) ??
      document.querySelector<HTMLElement>(`[data-cue="${CSS.escape(beat)}"]`);
    scrollToElement(el, state, undefined, onStateChange);
    return;
  }

  const cue = params.get('cue');
  if (cue) {
    const el = document.querySelector<HTMLElement>(`[data-cue="${CSS.escape(cue)}"]`);
    scrollToElement(el, state, undefined, onStateChange);
    return;
  }

  const verseParam = params.get('v');
  if (verseParam) {
    const cleaned = verseParam.replace(/^書?24:/, '').trim();
    const targetV = Number(cleaned);
    if (Number.isFinite(targetV) && targetV >= 1 && targetV <= 33) {
      for (const seg of data.segments) {
        for (const b of seg.beats) {
          if (!b.verse) continue;
          const m = /^書24:(\d+)(?:-(\d+))?$/.exec(b.verse);
          if (!m) continue;
          const lo = Number(m[1]);
          const hi = m[2] ? Number(m[2]) : lo;
          if (targetV >= lo && targetV <= hi) {
            const el = document.getElementById(`jos-beat-${b.id}`);
            scrollToElement(el, state, undefined, onStateChange);
            return;
          }
        }
      }
    }
  }

  const card = params.get('card');
  if (card) {
    const el = document.getElementById(`jos-card-${card}`);
    scrollToElement(el, state, undefined, onStateChange);
    return;
  }

  const place = params.get('place');
  if (place && data.places[place]) {
    openPlacePeek(place);
    return;
  }

  const sec = params.get('sec');
  if (sec) {
    const mapped = SEC_ALIASES[sec] ?? sec;
    const el = document.getElementById(`jos-sec-${mapped}`) ?? document.getElementById(mapped);
    scrollToElement(el, state, undefined, onStateChange);
  }
}
