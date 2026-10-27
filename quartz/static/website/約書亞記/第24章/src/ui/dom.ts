import type { CommentaryItem } from '../data/types';

export function h<K extends keyof HTMLElementTagNameMap>(
  tag: K,
  attrs?: Record<string, string | undefined> | null,
  ...children: (Node | string | null | undefined | false)[]
): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  if (attrs) {
    for (const [k, v] of Object.entries(attrs)) {
      if (v === undefined) continue;
      if (k === 'className') el.className = v;
      else el.setAttribute(k, v);
    }
  }
  for (const ch of children) {
    if (ch === null || ch === undefined || ch === false) continue;
    if (typeof ch === 'string') el.appendChild(document.createTextNode(ch));
    else el.appendChild(ch);
  }
  return el;
}

/** 將作者散文中的 ==高亮== 轉為 <mark class="jos-mark">，其餘維持純文字節點 */
export function renderRichText(text: string): DocumentFragment {
  const frag = document.createDocumentFragment();
  const re = /==([^=\n]+)==/g;
  let last = 0;
  let m: RegExpExecArray | null;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) {
      frag.appendChild(document.createTextNode(text.slice(last, m.index)));
    }
    const mark = h('mark', { className: 'jos-mark' }, m[1]);
    frag.appendChild(mark);
    last = m.index + m[0].length;
  }
  if (last < text.length) {
    frag.appendChild(document.createTextNode(text.slice(last)));
  }
  return frag;
}

/** 渲染單筆註釋卡片（嚴格遵守引號分工：英文引句「原句」（中譯），中文引句「原句」，轉述不加「」） */
export function renderCommentaryCard(item: CommentaryItem): HTMLElement {
  const body = h('p', { className: 'jos-comm-text' });

  if (item.quote) {
    if (item.source === 'KC' || item.source === 'BH') {
      body.appendChild(document.createTextNode(`「${item.quote}」（${item.quoteZh ?? ''}）`));
      if (item.paraphrase) {
        body.appendChild(document.createTextNode(` ${item.paraphrase}`));
      }
    } else {
      body.appendChild(document.createTextNode(`「${item.quote}」`));
      if (item.paraphrase) {
        body.appendChild(document.createTextNode(` ${item.paraphrase}`));
      }
    }
  } else if (item.paraphrase) {
    body.appendChild(renderRichText(item.paraphrase));
  }

  return h(
    'article',
    { className: 'jos-comm-card' },
    h(
      'div',
      { className: 'jos-comm-head' },
      h('span', { className: 'jos-comm-work' }, `${item.work}（${item.verse}）`),
      h(
        'a',
        {
          className: 'jos-comm-link',
          href: item.url,
          target: '_blank',
          rel: 'noopener noreferrer',
        },
        '來源網頁 ↗',
      ),
    ),
    body,
  );
}
