import type { GenealogyData, Person, Relation } from '../data/types';
import { buildGraph, childrenOf, firstReference, personQualifier, WIKI_BASE } from '../data/model';
import { button, h, linkButton } from './dom';

export interface CardActions {
  select(id: string): void;
  tree(id: string): void;
  verse(ref: string): void;
  trace(id: string): void;
  family(id: string): void;
  note(id: string): void;
}

export interface PersonCard {
  el: HTMLElement;
  show(person: Person | null, treeTargetId?: string | null): void;
  setTraceMessage(message: string, unknownGenerations?: boolean, showFamilyLink?: boolean): void;
}

export function createPersonCard(data: GenealogyData, actions: CardActions): PersonCard {
  const graph = buildGraph(data);
  const body = h('div', { className: 'ag-card-body' });
  const el = h('aside', { className: 'ag-info-card', 'aria-label': '人物資訊' },
    h('div', { className: 'ag-card-grip', 'aria-hidden': 'true' }),
    h('button', { className: 'ag-card-close', type: 'button', 'aria-label': '關閉人物資訊' }, '×'), body);
  let current: Person | null = null;
  let traceMessage = '';
  let unknownGenerations = false;
  let showFamilyLink = false;
  const close = el.querySelector<HTMLButtonElement>('.ag-card-close')!;
  close.addEventListener('click', () => show(null));

  const refButton = (ref: string) => linkButton(ref, () => actions.verse(ref));
  const personButton = (id: string, label?: string) => {
    const person = graph.byId.get(id);
    const action = button(label ?? person?.name ?? id, () => actions.select(id), 'ag-person-link');
    return action;
  };
  const groupedRelations = (rows: Relation[], roleFor?: (row: Relation) => string, includeRel = true) => {
    const groups = new Map<string, { row: Relation; role: string; refs: string[]; notes: string[] }>();
    for (const row of rows) {
      const role = roleFor?.(row) ?? '';
      const key = JSON.stringify([row.id, role, includeRel ? row.rel ?? '' : '', row.qualifier ?? '', row.idQualifier ?? '']);
      const group = groups.get(key) ?? { row, role, refs: [], notes: [] };
      if (row.ref && !group.refs.includes(row.ref)) group.refs.push(row.ref);
      if (row.note && !group.notes.includes(row.note)) group.notes.push(row.note);
      groups.set(key, group);
    }
    return [...groups.values()];
  };
  const relationRefs = (refs: string[]) => refs.flatMap((ref, index) => [
    ...(index ? [h('span', { className: 'ag-ref-separator' }, '、')] : []), refButton(ref),
  ]);
  const relationRows = (rows: Relation[] | undefined, label: string) => {
    if (!rows?.length) return null;
    const section = h('section', { className: 'ag-card-section' }, h('h3', {}, label));
    const list = h('ul', { className: 'ag-relation-list' });
    for (const group of groupedRelations(rows)) {
      const { row } = group;
      const person = graph.byId.get(row.id);
      list.append(h('li', {},
        personButton(row.id, person?.name ?? row.id),
        row.idQualifier ? h('small', { className: 'ag-rel-identifier' }, `（${row.idQualifier}）`) : null,
        row.rel ? h('small', { className: 'ag-rel-label' }, row.rel) : null,
        row.qualifier ? h('small', { className: 'ag-rel-qualifier-tag' }, row.qualifier) : null,
        ...relationRefs(group.refs),
        ...group.notes.map((note) => h('p', { className: 'ag-relation-note' }, note))));
    }
    section.append(list);
    return section;
  };
  const show = (person: Person | null, treeTargetId?: string | null) => {
    current = person;
    traceMessage = '';
    unknownGenerations = false;
    showFamilyLink = false;
    body.replaceChildren();
    if (!person) {
      el.classList.remove('ag-card-open');
      body.append(h('div', { className: 'ag-card-empty' }, h('span', {}, '選一個名字'), h('p', {}, '家譜中的人物資料會顯示在這裡。')));
      return;
    }
    el.classList.add('ag-card-open');
    const routeNames = person.lines?.includes('common') ? ['共同主線'] : person.lines?.filter((line) => line !== 'common') ?? [];
    const fallbackKind = person.kind === 'person' ? '人物' : person.kind;
    body.append(
      h('div', { className: 'ag-card-title' },
        h('div', { className: 'ag-card-kicker' }, routeNames.join('／') || fallbackKind || '人物'),
        h('h2', {}, person.name),
        personQualifier(person, graph) ? h('p', { className: 'ag-card-qualifier' }, personQualifier(person, graph)) : null,
        person.desc ? h('p', { className: 'ag-person-desc' }, person.desc) : null,
        h('p', { className: 'ag-card-refs' },
          ...(person.names ?? []).map((name, index) => h('span', {},
            name.as, name.ref ? refButton(name.ref) : null, index < (person.names?.length ?? 0) - 1 ? h('i', {}, '；') : null))),
        firstReference(person) ? h('small', {}, `首見 ${firstReference(person)}`) : null),
    );
    const meaning = person.nameMeaning;
    if (meaning) {
      const hasMeaning = Boolean(meaning.meaningEn) || meaning.scripture.length > 0;
      const section = h('section', { className: 'ag-card-section ag-name-meaning' }, h('h3', {}, hasMeaning ? '名字的意思' : '名字的原文'));
      if (meaning.orig) {
        const isGreek = meaning.strong.startsWith('G');
        section.append(h('p', { className: 'ag-name-orig' },
          h('span', { className: 'ag-name-orig-text', lang: isGreek ? 'grc' : 'he', dir: isGreek ? 'ltr' : 'rtl' }, meaning.orig),
          h('span', { className: 'ag-name-translit' }, `${meaning.translit}　${isGreek ? '希臘文' : '希伯來文'}`)));
      }
      if (meaning.meaningEn) {
        section.append(h('p', { className: 'ag-name-gloss' }, meaning.meaningZh || meaning.meaningEn,
          meaning.meaningZh ? h('small', {}, `　${meaning.meaningEn}`) : null));
        if (meaning.via) section.append(h('p', { className: 'ag-name-via' }, `字義取自對應的希伯來文名字 ${meaning.via}。`));
      }
      for (const item of meaning.scripture) {
        section.append(h('blockquote', { className: 'ag-name-quote' }, `「${item.quote}」`, refButton(item.ref)));
      }
      if (meaning.meaningEn || meaning.orig) {
        section.append(h('small', { className: 'ag-name-source' },
          meaning.meaningEn ? '原文與字義出處：STEP Bible（CC BY 4.0）；字義中文為本站翻譯。' : '原文出處：STEP Bible（CC BY 4.0）。'));
      }
      body.append(section);
    }
    if (treeTargetId) body.append(button('在家譜樹上看', () => actions.tree(treeTargetId), 'ag-primary-button ag-card-tree-link'));
    const parents = person.parents ?? [];
    const parentSection = h('section', { className: 'ag-card-section' }, h('h3', {}, '父母'));
    if (!parents.length && person.mother_name) parentSection.append(h('p', {}, `母親：${person.mother_name}`));
    if (parents.length) {
      const list = h('ul', { className: 'ag-relation-list' });
      const groupedParents = groupedRelations(parents, (parent) => parent.role ?? (person.mother_name && graph.byId.get(parent.id)?.name === person.mother_name ? '母' : '父'), false);
      for (const group of groupedParents) {
        const { row, role } = group;
        list.append(h('li', {}, h('span', { className: 'ag-rel-role' }, `${role}：`), personButton(row.id),
          row.idQualifier ? h('small', { className: 'ag-rel-identifier' }, `（${row.idQualifier}）`) : null,
          row.qualifier ? h('small', { className: 'ag-rel-qualifier-tag' }, row.qualifier) : null,
          ...relationRefs(group.refs), ...group.notes.map((note) => h('p', { className: 'ag-relation-note' }, note))));
      }
      parentSection.append(list);
    } else parentSection.append(h('p', { className: 'ag-muted' }, '資料沒有列出父母。'));
    body.append(parentSection);

    if (person.maybeSame?.length) {
      const section = h('section', { className: 'ag-card-section ag-maybe-same' },
        h('h3', {}, '可能是同一人'));
      const list = h('ul', { className: 'ag-relation-list' });
      for (const candidate of person.maybeSame) {
        const other = graph.byId.get(candidate.id);
        list.append(h('li', {},
          personButton(candidate.id, other ? `${other.name}${other.qualifier ? `（${other.qualifier}）` : ''}` : candidate.id),
          ...(candidate.refs ?? []).map(refButton)));
      }
      section.append(list, h('small', { className: 'ag-maybe-same-note' }, '經文沒有明說是同一人'));
      body.append(section);
    }

    const children = childrenOf(person.id, graph);
    if (children.length) {
      const section = h('section', { className: 'ag-card-section' }, h('h3', {}, `子女 · ${children.length}`));
      const list = h('div', { className: 'ag-chip-list' });
      for (const child of children) list.append(personButton(child.id));
      section.append(list);
      body.append(section);
    }
    for (const section of [
      relationRows(person.spouses, '配偶'),
      relationRows(person.siblings, '兄弟姊妹'),
      relationRows(person.kin, '親戚'),
      relationRows(person.descends, '後裔（代數不詳）'),
    ]) if (section) body.append(section);

    const appearances = data.witnesses.filter((witness) => witness.entries?.some((entry) => entry.id === person.id));
    if (appearances.length) {
      const section = h('section', { className: 'ag-card-section' }, h('h3', {}, '出現在哪幾份家譜'));
      section.append(h('div', { className: 'ag-chip-list' }, ...appearances.map((witness) => h('span', { className: 'ag-witness-chip' }, witness.title,
        witness.ref ? refButton(witness.ref) : null))));
      body.append(section);
    }
    const refs = [...new Set([...(person.names ?? []).map((name) => name.ref ?? ''), ...parents.map((item) => item.ref ?? ''),
      ...(person.spouses ?? []).map((item) => item.ref ?? ''), ...(person.siblings ?? []).map((item) => item.ref ?? ''),
      ...(person.kin ?? []).map((item) => item.ref ?? ''), ...(person.descends ?? []).map((item) => item.ref ?? '')].filter(Boolean))];
    if (refs.length) {
      const section = h('section', { className: 'ag-card-section' }, h('h3', {}, '經節全文'));
      section.append(h('div', { className: 'ag-chip-list' }, ...refs.map(refButton)));
      body.append(section);
    }
    if (person.note) body.append(h('section', { className: 'ag-card-section' }, h('h3', {}, '註記'), h('p', {}, person.note)));
    if (person.notes?.length) {
      const section = h('section', { className: 'ag-card-section' }, h('h3', {}, '經文差異'));
      for (const noteId of person.notes) {
        const note = data.notes.find((item) => item.id === noteId);
        if (note) section.append(button(note.title, () => actions.note(note.id), 'ag-person-link'));
      }
      body.append(section);
    }
    if (person.entry) {
      const parts = person.entry.split('/').map((part) => encodeURIComponent(part));
      const section = h('section', { className: 'ag-card-section ag-entry' },
        h('h3', {}, '知識庫條目'),
        person.entryGloss ? h('p', {}, person.entryGloss) : null,
        h('a', { href: `${WIKI_BASE}/link_folder/${parts.join('/')}`, target: '_blank', rel: 'noopener noreferrer' }, '查看完整條目（另開網頁）'));
      body.append(section);
    }
    const familyButton = button('看他所在的家族', () => actions.family(person.id), 'ag-text-button ag-trace-family');
    familyButton.hidden = !showFamilyLink;
    body.append(h('div', { className: 'ag-trace-box' },
      h('p', { className: 'ag-trace-message' }, traceMessage),
      button('往上追到亞當', () => actions.trace(person.id), 'ag-primary-button'), familyButton));
    if (unknownGenerations) body.querySelector('.ag-trace-message')!.textContent = '這一段經文只說是後裔，沒有寫代數。';
  };
  const setTraceMessage = (message: string, unknown = false, showFamilyLinkValue = false) => {
    traceMessage = message;
    unknownGenerations = unknown;
    showFamilyLink = showFamilyLinkValue;
    const messageEl = body.querySelector<HTMLElement>('.ag-trace-message');
    if (messageEl) messageEl.textContent = unknown ? '這一段經文只說是後裔，沒有寫代數。' : message;
    const familyButton = body.querySelector<HTMLButtonElement>('.ag-trace-family');
    if (familyButton) familyButton.hidden = !showFamilyLink;
  };
  show(current);
  return { el, show, setTraceMessage };
}
