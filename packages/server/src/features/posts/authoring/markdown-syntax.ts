import type { MarkdownIt, StateBlock, StateCore, StateInline, Token } from 'markdown-it';

/**
 * BLEX Markdown syntax on top of markdown-it. Scans remember what they found, because a document can repeat an
 * opening marker many times and searching again from each one would take quadratic time.
 */

const MAX_EMBED_URL_LENGTH = 2048;
// One short marker expands into a full player, and missing table cells are filled in, so each document gets a budget.
const MAX_EMBEDS_PER_DOCUMENT = 500;
const MAX_TABLE_CELLS_PER_DOCUMENT = 200_000;

interface Search {
  from: number;
  found: number;
}

class InlineScan {
  private readonly searches = new Map<string, Search>();
  captionClose = -1;

  constructor(private readonly src: string) {}

  private remembered(key: string, from: number, find: () => number) {
    const search = this.searches.get(key);
    if (search && search.from <= from && (search.found === -1 || search.found >= from)) return search.found;
    const found = find();
    this.searches.set(key, { from, found });
    return found;
  }

  next(text: string, from: number) {
    return this.remembered(text, from, () => this.src.indexOf(text, from));
  }

  nextSpace(from: number) {
    return this.remembered('whitespace', from, () => {
      const whitespace = /\s/g;
      whitespace.lastIndex = from;
      return whitespace.exec(this.src)?.index ?? -1;
    });
  }

  lastCaptionClose(lineEnd: number) {
    return this.remembered(`caption:${lineEnd}`, 0, () =>
      this.src.lastIndexOf('</caption>', lineEnd - '</caption>'.length),
    );
  }
}

const scans = new WeakMap<StateInline, InlineScan>();

function scanFor(state: StateInline) {
  let scan = scans.get(state);
  if (!scan) {
    scan = new InlineScan(state.src);
    scans.set(state, scan);
  }
  return scan;
}

function escapeAttribute(value: string) {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function isSafeVideoUrl(value: string) {
  if (/[\u0000- \\]/.test(value)) return false;
  const url = URL.parse(value);
  return Boolean(
    url &&
      (url.protocol === 'http:' || url.protocol === 'https:') &&
      url.hostname &&
      url.pathname.toLowerCase().endsWith('.mp4'),
  );
}

function readGif(state: StateInline, scan: InlineScan) {
  const marker = '@gif[';
  if (!state.src.startsWith(marker, state.pos)) return null;
  const start = state.pos + marker.length;
  const close = scan.next(']', start);
  if (close <= start || close - start > MAX_EMBED_URL_LENGTH) return null;
  const space = scan.nextSpace(start);
  if (space !== -1 && space < close) return null;
  const url = state.src.slice(start, close);
  if (!isSafeVideoUrl(url)) return null;
  const source = escapeAttribute(url);
  return {
    end: close + 1,
    html: `<video class="lazy" autoplay muted loop playsinline poster="${source}.preview.jpg"><source data-src="${source}" type="video/mp4"/></video>`,
  };
}

function readYoutube(state: StateInline, scan: InlineScan) {
  const marker = '@youtube[';
  if (!state.src.startsWith(marker, state.pos)) return null;
  const start = state.pos + marker.length;
  const close = scan.next(']', start);
  if (close <= start || close - start > 64) return null;
  const id = state.src.slice(start, close);
  let end = close + 1;
  let ratio = '16:9';
  if (state.src[end] === '{') {
    const brace = scan.next('}', end + 1);
    if (brace > end + 1) {
      ratio = state.src.slice(end + 1, brace);
      end = brace + 1;
    }
  }
  if (!/^[A-Za-z0-9_-]{1,64}$/.test(id) || !/^[1-9]\d{0,2}(?::[1-9]\d{0,2})?$/.test(ratio)) return null;
  return {
    end,
    html:
      '<figure style="text-align: center; display: flex; justify-content: center; flex-direction: column; align-items: center;">' +
      `<iframe style="width: 100%; aspect-ratio: ${ratio.replace(':', ' / ')}; border: 0;" data-aspect-ratio="${ratio}" ` +
      `src="https://www.youtube.com/embed/${id}" frameborder="0" ` +
      'allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></figure>',
  };
}

function embedRule(state: StateInline, silent: boolean) {
  if (state.src.charCodeAt(state.pos) !== 0x40) return false;
  const used = Number(state.env.legacyEmbeds ?? 0);
  if (used >= MAX_EMBEDS_PER_DOCUMENT) return false;
  const scan = scanFor(state);
  const embed = readGif(state, scan) ?? readYoutube(state, scan);
  if (!embed) return false;
  if (!silent) {
    state.env.legacyEmbeds = used + 1;
    state.push('html_inline', '', 0).content = embed.html;
  }
  state.pos = embed.end;
  return true;
}

function allowedTag(state: StateInline, tag: string, scan: InlineScan): string | null {
  if (tag === '<br>' || tag === '<br/>') return '<br/>';
  if (tag === '<center>') return '<div style="text-align: center;">';
  if (tag === '</center>') return '</div>';
  if (tag === '</grid-image>') return '</figure>';
  if (tag === '</caption>') return state.pos === scan.captionClose ? '</figcaption>' : null;
  if (tag === '<caption>') {
    if (scan.captionClose >= state.pos) return null;
    const newline = scan.next('\n', state.pos);
    const close = scan.lastCaptionClose(newline === -1 ? state.src.length : newline);
    if (close < state.pos + tag.length) return null;
    scan.captionClose = close;
    return '<figcaption>';
  }
  return `<figure class="col-${tag[17]}">`;
}

function allowedTagRule(state: StateInline, silent: boolean) {
  if (state.src.charCodeAt(state.pos) !== 0x3c) return false;
  if (state.src.startsWith('<!--', state.pos)) {
    const close = scanFor(state).next('-->', state.pos + 4);
    if (close < 0) return false;
    state.pos = close + 3;
    return true;
  }
  const pattern = /<(?:br\/?|center|\/center|caption|\/caption|\/grid-image|grid-image col="[123]")>/y;
  pattern.lastIndex = state.pos;
  const tag = pattern.exec(state.src)?.[0];
  if (!tag) return false;
  const html = allowedTag(state, tag, scanFor(state));
  if (html === null) return false;
  if (!silent) state.push('html_inline', '', 0).content = html;
  state.pos += tag.length;
  return true;
}

/** A backslash before a line break stays visible, and the line break renders on its own. */
function backslashBreakRule(state: StateInline, silent: boolean) {
  if (state.src.charCodeAt(state.pos) !== 0x5c || state.src.charCodeAt(state.pos + 1) !== 0x0a) return false;
  if (!silent) state.pending += '\\';
  state.pos += 1;
  return true;
}

/** Abbreviation titles do not survive the content sanitizer, so only their definition lines are removed. */
function abbreviationRule(state: StateBlock, startLine: number, _endLine: number, silent: boolean) {
  if (state.sCount[startLine]! - state.blkIndent >= 4) return false;
  const line = state.src.slice(state.bMarks[startLine]! + state.tShift[startLine]!, state.eMarks[startLine]!);
  if (!/^\*\[[^\\\]]*\] ?:/.test(line)) return false;
  if (!silent) state.line = startLine + 1;
  return true;
}

/** `#title` is a heading, a seventh `#` stays as text, and closing marks are dropped. */
function hashHeadingRule(state: StateBlock, startLine: number, _endLine: number, silent: boolean) {
  if (state.sCount[startLine]! - state.blkIndent >= 4) return false;
  const start = state.bMarks[startLine]! + state.tShift[startLine]!;
  const max = state.eMarks[startLine]!;
  if (state.src.charCodeAt(start) !== 0x23) return false;
  if (silent) return true;
  let level = 0;
  while (level < 6 && state.src.charCodeAt(start + level) === 0x23) level += 1;
  let end = max;
  while (end > start + level && state.src.charCodeAt(end - 1) === 0x23) end -= 1;
  state.line = startLine + 1;
  const tag = `h${level}`;
  const open = state.push('heading_open', tag, 1);
  open.markup = '#'.repeat(level);
  open.map = [startLine, state.line];
  const inline = state.push('inline', '', 0);
  inline.content = state.src.slice(start + level, end).trim();
  inline.map = [startLine, state.line];
  inline.children = [];
  state.push('heading_close', tag, -1).markup = open.markup;
  return true;
}

type BlockRule = (state: StateBlock, startLine: number, endLine: number, silent: boolean) => boolean;

function wrapBlockRule(parser: MarkdownIt, name: string, wrap: (rule: BlockRule) => BlockRule) {
  const entry = parser.block.ruler.__rules__.find((rule) => rule.name === name);
  if (!entry) throw new Error(`Missing Markdown block rule: ${name}`);
  parser.block.ruler.at(name, wrap(entry.fn as BlockRule), { alt: entry.alt });
}

/** Top-level lists and tables require a preceding blank line; `1)` stays literal text. */
function legacyList(rule: BlockRule): BlockRule {
  return (state, startLine, endLine, silent) => {
    if (silent && state.parentType === 'paragraph' && state.listIndent < 0) return false;
    const start = state.bMarks[startLine]! + state.tShift[startLine]!;
    if (/^\d+\)/.test(state.src.slice(start, start + 12))) return false;
    return rule(state, startLine, endLine, silent);
  };
}

/** Every line of a table block must contain a pipe. */
function legacyTable(rule: BlockRule): BlockRule {
  return (state, startLine, endLine, silent) => {
    if (silent && state.parentType === 'paragraph') return false;
    let rows = 0;
    for (let line = startLine; line < endLine && !state.isEmpty(line); line += 1) {
      if (!state.src.slice(state.bMarks[line]!, state.eMarks[line]!).includes('|')) return false;
      rows += 1;
    }
    const delimiter =
      startLine + 1 < endLine ? state.src.slice(state.bMarks[startLine + 1]!, state.eMarks[startLine + 1]!) : '';
    const cells = rows * (delimiter.split('|').length + 1);
    const used = Number(state.env.legacyTableCells ?? 0);
    if (used + cells > MAX_TABLE_CELLS_PER_DOCUMENT) return false;
    if (!rule(state, startLine, endLine, silent)) return false;
    if (!silent) state.env.legacyTableCells = used + cells;
    return true;
  };
}

const fenceEnds = new WeakMap<StateBlock, Map<number, number>>();

function lastFenceLine(state: StateBlock, marker: number) {
  let ends = fenceEnds.get(state);
  if (!ends) {
    ends = new Map();
    fenceEnds.set(state, ends);
  }
  let last = ends.get(marker);
  if (last === undefined) {
    last = -1;
    for (let line = state.bMarks.length - 2; line >= 0 && last < 0; line -= 1) {
      const start = state.bMarks[line]! + state.tShift[line]!;
      if (
        state.src.charCodeAt(start) === marker &&
        state.src.charCodeAt(start + 1) === marker &&
        state.src.charCodeAt(start + 2) === marker
      )
        last = line;
    }
    ends.set(marker, last);
  }
  return last;
}

/** An unclosed fence is plain text. */
function legacyFence(rule: BlockRule): BlockRule {
  return (state, startLine, endLine, silent) => {
    const marker = state.src.charCodeAt(state.bMarks[startLine]! + state.tShift[startLine]!);
    if ((marker === 0x60 || marker === 0x7e) && lastFenceLine(state, marker) <= startLine) return false;
    return rule(state, startLine, endLine, silent);
  };
}

/**
 * Nested lists require four spaces. An adjacent item of the other list type stays in the current item as text.
 * Rewrite those lines before markdown-it builds the list.
 */
function legacyListSource(source: string) {
  const lines = source.split('\n');
  const typeAtLevel = new Map<number, string>();
  let fence: { mark: string; dedent: number } | null = null;
  let inList = false;
  let previousBlank = true;
  const leaveList = () => {
    inList = false;
    typeAtLevel.clear();
  };
  lines.forEach((line, index) => {
    const fenceLine = line.match(/^( *)(`{3,}|~{3,})/);
    if (fence) {
      if (fence.dedent) lines[index] = line.replace(new RegExp(`^ {0,${fence.dedent}}`), '');
      if (fenceLine?.[2]?.[0] === fence.mark) fence = null;
      return;
    }
    if (fenceLine && (fenceLine[1]!.length < 4 || inList)) {
      const indent = fenceLine[1]!.length;
      const leavesList = inList && previousBlank && indent < 4;
      fence = { mark: fenceLine[2]![0]!, dedent: leavesList ? indent : 0 };
      if (leavesList) {
        lines[index] = line.slice(indent);
        leaveList();
      }
      previousBlank = false;
      return;
    }
    if (!line.trim()) {
      previousBlank = true;
      return;
    }
    const item = line.match(/^( *)([-*+]|\d+\.)([ \t]+)/);
    if (item && (inList || item[1]!.length < 4)) {
      const indent = item[1]!.length;
      const level = Math.floor(indent / 4);
      const type = /\d/.test(item[2]!) ? 'ordered' : 'bullet';
      const marker = item[2]!;
      const continuesItem = inList && !previousBlank && typeAtLevel.has(level) && typeAtLevel.get(level) !== type;
      const rest = line.slice(indent + marker.length + item[3]!.length);
      lines[index] = continuesItem
        ? `${' '.repeat(level * 4)}${marker.slice(0, -1)}\\${marker.at(-1)}${item[3]}${rest}`
        : `${' '.repeat(level * 4)}${marker}${' '.repeat(Math.max(1, 4 - marker.length))}${rest}`;
      if (!continuesItem) {
        typeAtLevel.set(level, type);
        for (const key of typeAtLevel.keys()) if (key > level) typeAtLevel.delete(key);
      }
      inList = true;
    } else if (inList && previousBlank) {
      const indent = line.match(/^ */)![0].length;
      if (indent < 4) {
        lines[index] = line.slice(indent);
        leaveList();
      }
    }
    previousBlank = false;
  });
  return lines.join('\n');
}

function listSourceRule(state: StateCore) {
  state.src = legacyListSource(state.src);
}

function footnoteOrderRule(state: StateCore) {
  const footnotes = state.env.footnotes as
    | { refs?: Record<string, number>; list?: Array<{ label: string; count: number }> }
    | undefined;
  if (!footnotes?.refs) return;
  footnotes.list ??= [];
  for (const key of Object.keys(footnotes.refs)) {
    if (footnotes.refs[key]! >= 0) continue;
    footnotes.refs[key] = footnotes.list.length;
    footnotes.list.push({ label: key.slice(1), count: 0 });
  }
}

function headingId(text: string, used: Set<string>, nextIndex: Map<string, number>) {
  const slug = text
    .replace(/[^\p{L}\p{N}_\s-]/gu, '')
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, '-');
  const base = Array.from(slug).slice(0, 25).join('') || 'header';
  for (let index = nextIndex.get(base) ?? 0; index < 100; index += 1) {
    const id = index ? `${base}-${index}` : base;
    if (used.has(id)) continue;
    used.add(id);
    nextIndex.set(base, index + 1);
    return id;
  }
  nextIndex.set(base, 100);
  return base;
}

/** Odd heading levels move down one step, and each heading is named from its Markdown source. */
function headingRule(state: StateCore) {
  const used = new Set<string>();
  const nextIndex = new Map<string, number>();
  state.tokens.forEach((token, index) => {
    if (token.type !== 'heading_open') return;
    const level = Number(token.tag[1]);
    if (level % 2 === 1) {
      token.tag = `h${level + 1}`;
      state.tokens[index + 2]!.tag = token.tag;
    }
    const text = state.tokens[index + 1]!.content;
    if (text) token.attrSet('id', headingId(text, used, nextIndex));
  });
}

function markTaskItem(state: StateCore, index: number) {
  const inline = state.tokens[index + 2];
  const first = state.tokens[index + 1]?.type === 'paragraph_open' ? inline?.children?.[0] : undefined;
  if (first?.type !== 'text') return false;
  const checkbox = first.content.match(/^ *\[(?:x|X| )\](?: +|$)/);
  if (!checkbox) return false;
  first.content = ` ${first.content.slice(checkbox[0].length)}`;
  state.tokens[index]!.attrJoin('class', 'task-list-item');
  return true;
}

/** Keeps references from repeating one long definition URL into an output far larger than the document. */
function spendLinkBudget(token: Token, budget: { remaining: number }) {
  if (token.type !== 'link_open' && token.type !== 'image') return;
  const attribute = token.type === 'image' ? 'src' : 'href';
  budget.remaining -= String(token.attrGet(attribute) ?? '').length + String(token.attrGet('title') ?? '').length;
  if (budget.remaining < 0)
    token.attrs = token.attrs?.filter(([name]) => name !== attribute && name !== 'title') ?? null;
}

function readAttributes(source: string) {
  const attributes: Array<[string, string]> = [];
  const pattern = /([#.])([^\s.#=]+)|([^\s=#.][^\s=]*)=(?:"([^"]*)"|'([^']*)'|(\S+))/g;
  for (const match of source.matchAll(pattern)) {
    if (match[1] === '#') attributes.push(['id', match[2]!]);
    else if (match[1] === '.') attributes.push(['class', match[2]!]);
    else attributes.push([match[3]!, match[4] ?? match[5] ?? match[6] ?? '']);
  }
  return attributes;
}

function applyAttributes(token: Token, source: string) {
  for (const [name, value] of readAttributes(source)) {
    if (name === 'class') token.attrJoin('class', value);
    else token.attrSet(name, value);
  }
}

function attributeBody(text: string) {
  const inner = text.slice(1, -1).replace(/^:/, '').trim();
  return inner && !inner.includes('}') ? inner : null;
}

function headingAttributes(open: Token, inline: Token) {
  const last = inline.children?.at(-1);
  if (last?.type !== 'text') return;
  const text = last.content.trimEnd();
  const brace = text.lastIndexOf('{');
  if (!text.endsWith('}') || brace < 1 || text[brace - 1] !== ' ') return;
  const body = attributeBody(text.slice(brace));
  if (!body) return;
  applyAttributes(open, body);
  last.content = text.slice(0, brace).trimEnd();
}

function paragraphAttributes(open: Token, inline: Token) {
  const children = inline.children ?? [];
  const last = children.at(-1);
  if (last?.type !== 'text' || (children.at(-2)?.type !== 'softbreak' && children.at(-2)?.type !== 'hardbreak')) return;
  const text = last.content.trim();
  if (!text.startsWith('{') || !text.endsWith('}')) return;
  const body = attributeBody(text);
  if (!body) return;
  applyAttributes(open, body);
  children.pop();
}

const inlineAttributeClosers = new Set([
  'link_close',
  'image',
  'code_inline',
  'em_close',
  'strong_close',
  's_close',
  'mark_close',
  'sub_close',
]);

/** Attributes follow an inline element. Only links, images, and code keep them. */
function inlineAttributes(inline: Token) {
  const children = inline.children;
  if (!children) return;
  const links: Token[] = [];
  children.forEach((child, index) => {
    if (child.type === 'link_open') links.push(child);
    const target =
      child.type === 'link_close'
        ? links.pop()
        : child.type === 'image' || child.type === 'code_inline'
          ? child
          : undefined;
    if (!inlineAttributeClosers.has(child.type)) return;
    const next = children[index + 1];
    if (next?.type !== 'text') return;
    const match = next.content.match(/^\{:?[ ]*([^}\n ][^}\n]*)\}/);
    if (!match) return;
    if (target) applyAttributes(target, match[1]!);
    next.content = next.content.slice(match[0].length);
  });
}

function finishRule(state: StateCore) {
  const lists: Token[] = [];
  const budget = { remaining: Math.max(512 * 1024, state.src.length * 2) };
  const kept: Token[] = [];
  state.tokens.forEach((token, index) => {
    const previous = state.tokens[index - 1];
    const next = state.tokens[index + 1];
    // Mixed `-`, `*`, and `+` markers stay in one list.
    if (token.type === 'bullet_list_close' && next?.type === 'bullet_list_open') return;
    if (token.type === 'bullet_list_open' && previous?.type === 'bullet_list_close') return;
    // Quotes separated only by blank lines are one quote.
    if (token.type === 'blockquote_close' && next?.type === 'blockquote_open') return;
    if (token.type === 'blockquote_open' && previous?.type === 'blockquote_close') return;
    if (token.type === 'bullet_list_open' || token.type === 'ordered_list_open') lists.push(token);
    if (token.type === 'bullet_list_close' || token.type === 'ordered_list_close') lists.pop();
    if (token.type === 'list_item_open' && markTaskItem(state, index)) {
      const list = lists.at(-1);
      if (list && !list.attrGet('class')) list.attrSet('class', 'task-list');
    }
    if (token.type === 'inline') {
      inlineAttributes(token);
      if (previous?.type === 'heading_open') headingAttributes(previous, token);
      if (previous?.type === 'paragraph_open') paragraphAttributes(previous, token);
    }
    for (const child of token.children ?? []) {
      if (child.type === 's_open' || child.type === 's_close') child.tag = 'del';
      spendLinkBudget(child, budget);
    }
    kept.push(token);
  });
  // A paragraph holding only an HTML comment renders nothing.
  state.tokens = kept.filter((token, index) => {
    const isEmpty = (inline?: Token) =>
      inline?.type === 'inline' && inline.content.startsWith('<!--') && !inline.children?.length;
    if (token.type === 'paragraph_open') return !isEmpty(kept[index + 1]);
    if (token.type === 'inline') return !(kept[index - 1]?.type === 'paragraph_open' && isEmpty(token));
    if (token.type === 'paragraph_close') return !isEmpty(kept[index - 1]);
    return true;
  });
}

function footnoteMeta(token: Token) {
  const meta = token.meta ?? {};
  const number = Number(meta.id) + 1;
  return { number, subId: Number(meta.subId ?? 0), label: escapeAttribute(String(meta.label ?? number)) };
}

function renderFootnotes(parser: MarkdownIt) {
  const rules = parser.renderer.rules;
  rules.footnote_ref = (tokens, index) => {
    const { number, label } = footnoteMeta(tokens[index]!);
    return `<sup><a class="footnote-ref" href="#fn:${label}">${number}</a></sup>`;
  };
  rules.footnote_block_open = () => '<div class="footnote">\n<hr />\n<ol>\n';
  rules.footnote_block_close = () => '</ol>\n</div>\n';
  rules.footnote_open = () => '<li>\n';
  rules.footnote_close = () => '</li>\n';
  rules.footnote_anchor = (tokens, index) => {
    const { number, subId, label } = footnoteMeta(tokens[index]!);
    // Each repeated reference adds a link back, so a capped count keeps the output proportional to the document.
    if (subId >= 100) return '';
    const target = subId ? `fnref${subId + 1}` : 'fnref';
    return `${subId ? '' : '&#160;'}<a class="footnote-backref" href="#${target}:${label}" title="Jump back to footnote ${number} in the text">↩</a>`;
  };
}

export function legacySyntax(parser: MarkdownIt) {
  parser.inline.ruler.before('link', 'legacy_embed', embedRule);
  parser.inline.ruler.before('autolink', 'legacy_tag', allowedTagRule);
  parser.inline.ruler.before('escape', 'legacy_backslash_break', backslashBreakRule);
  parser.block.ruler.before('reference', 'legacy_abbreviation', abbreviationRule, { alt: ['paragraph', 'reference'] });
  parser.block.ruler.at('heading', hashHeadingRule, { alt: ['paragraph', 'reference', 'blockquote'] });
  wrapBlockRule(parser, 'list', legacyList);
  wrapBlockRule(parser, 'table', legacyTable);
  wrapBlockRule(parser, 'fence', legacyFence);
  parser.core.ruler.after('normalize', 'legacy_list_source', listSourceRule);
  parser.core.ruler.after('block', 'legacy_heading', headingRule);
  parser.core.ruler.after('legacy_heading', 'legacy_footnote_order', footnoteOrderRule);
  parser.core.ruler.push('legacy_finish', finishRule);
  parser.disable('footnote_inline');
  renderFootnotes(parser);
}
