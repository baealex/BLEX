type HtmlNode = {
  tag: string | null;
  attrs: Record<string, string>;
  text?: string;
  children: HtmlNode[];
  parent?: HtmlNode;
};

const voidTags = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);
const structuralTags = new Set(['article', 'section', 'main', 'aside', 'div', 'html', 'body']);
const inlineRawTags = new Set(['figcaption', 'mark', 'u', 'sub', 'sup']);
const inlinePassthroughTags = new Set(['span']);

export function htmlToMarkdown(html: string): string {
  if (!html) return '';
  const parsed = parseHtml(html);
  const body = findNode(parsed, 'body');
  const root = body ?? parsed;
  const blocks = root.children
    .map(htmlNodeToMarkdown)
    .map((block) => block.trim())
    .filter(Boolean);
  return collapseBlankLines(blocks.join('\n\n'));
}

function parseHtml(html: string): HtmlNode {
  const root: HtmlNode = { tag: null, attrs: {}, children: [] };
  const stack = [root];
  const tokens = html.match(/<!--[\s\S]*?-->|<![^>]*>|<\/?[A-Za-z][^>]*>|[^<]+|</g) ?? [];
  let skippedTag: string | null = null;

  for (const token of tokens) {
    if (skippedTag) {
      if (token.toLowerCase().startsWith(`</${skippedTag}`)) skippedTag = null;
      continue;
    }
    const dangerousTag = token.match(/^<\s*(script|style|object|embed)\b/i)?.[1]?.toLowerCase();
    if (dangerousTag) {
      skippedTag = dangerousTag;
      continue;
    }
    if (token.startsWith('<!--') || /^<!/i.test(token)) continue;
    if (token.startsWith('</')) {
      const closingTag = token.slice(2).match(/^\s*([\w:-]+)/)?.[1]?.toLowerCase();
      if (!closingTag) continue;
      const matchingIndex = stack.map((node) => node.tag).lastIndexOf(closingTag);
      if (matchingIndex > 0) stack.length = matchingIndex;
      continue;
    }
    if (token.startsWith('<')) {
      const match = token.match(/^<\s*([\w:-]+)([\s\S]*?)\s*\/?>$/);
      if (!match) {
        stack.at(-1)!.children.push({ tag: null, attrs: {}, text: token, children: [], parent: stack.at(-1) });
        continue;
      }
      const tag = match[1].toLowerCase();
      const node: HtmlNode = { tag, attrs: parseAttributes(match[2]), children: [], parent: stack.at(-1) };
      stack.at(-1)!.children.push(node);
      if (!voidTags.has(tag) && !/\/\s*>$/.test(token)) stack.push(node);
      continue;
    }
    stack.at(-1)!.children.push({ tag: null, attrs: {}, text: decodeEntities(token), children: [], parent: stack.at(-1) });
  }
  return root;
}

function parseAttributes(source: string): Record<string, string> {
  const attributes: Record<string, string> = {};
  const pattern = /([^\s=/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'=<>`]+)))?/g;
  for (const match of source.matchAll(pattern)) {
    const name = match[1].toLowerCase();
    attributes[name] = decodeEntities(match[2] ?? match[3] ?? match[4] ?? '');
  }
  return attributes;
}

function htmlNodeToMarkdown(node: HtmlNode): string {
  if (node.tag === null) return node.text?.trim() ?? '';
  const name = node.tag;

  if (/^h[1-6]$/.test(name)) {
    return `${'#'.repeat(Number(name[1]))} ${textSegments(node, ' ')}`;
  }
  if (name === 'p') return childrenToMarkdown(node);
  if (name === 'br') return '\n';
  if (name === 'hr') return '---';
  if (name === 'strong' || name === 'b') {
    const text = childrenToMarkdown(node);
    return text ? `**${text}**` : '';
  }
  if (name === 'em' || name === 'i') {
    const text = childrenToMarkdown(node);
    return text ? `_${text}_` : '';
  }
  if (name === 's' || name === 'strike' || name === 'del') {
    const text = childrenToMarkdown(node);
    return text ? `~~${text}~~` : '';
  }
  if (name === 'a') {
    const text = textSegments(node, ' ');
    return text && node.attrs.href ? `[${text}](${node.attrs.href})` : text;
  }
  if (name === 'img') {
    if (Object.keys(node.attrs).some((key) => !['src', 'data-src', 'alt', 'title'].includes(key))) {
      return rawHtml(node);
    }
    const src = node.attrs.src || node.attrs['data-src'];
    if (!src) return '';
    const title = node.attrs.title ? ` "${node.attrs.title}"` : '';
    return `![${node.attrs.alt ?? ''}](${src}${title})`;
  }
  if (name === 'video' || name === 'iframe' || name === 'figure') return rawHtml(node);
  if (name === 'code' && node.parent?.tag !== 'pre') return `\`${textSegments(node, '')}\``;
  if (name === 'pre') {
    const code = findNode(node, 'code');
    const language = code?.attrs.class?.split(/\s+/).find((value) => value.startsWith('language-'))?.slice(9) ?? '';
    const text = textContent(node).replace(/^\n+|\n+$/g, '');
    return text ? `\`\`\`${language}\n${text}\n\`\`\`` : '';
  }
  if (name === 'ul' || name === 'ol') {
    const items = node.children.filter((child) => child.tag === 'li');
    return items.map((item, index) => {
      const prefix = name === 'ol' ? `${index + 1}. ` : '- ';
      const content = childrenToMarkdown(item).trim();
      return content ? `${prefix}${content.replace(/\n/g, '\n  ')}` : '';
    }).filter(Boolean).join('\n');
  }
  if (name === 'blockquote') {
    const text = childrenToMarkdown(node);
    return text.split('\n').filter((line) => line.trim()).map((line) => `> ${line}`).join('\n');
  }
  if (name === 'table') {
    if (shouldPreserveTable(node)) return rawHtml(node);
    return tableToMarkdown(node);
  }
  if (structuralTags.has(name)) {
    if (Object.keys(node.attrs).some((key) => key !== 'id')) return rawHtml(node);
    return blockChildrenToMarkdown(node);
  }
  if (inlineRawTags.has(name)) return rawHtml(node);
  if (inlinePassthroughTags.has(name)) {
    if (Object.keys(node.attrs).some((key) => key !== 'id')) return rawHtml(node);
    return childrenToMarkdown(node);
  }
  return rawHtml(node);
}

function childrenToMarkdown(node: HtmlNode): string {
  return normalizeInlineSpacing(node.children.map(htmlNodeToMarkdown).filter(Boolean).join(' '));
}

function blockChildrenToMarkdown(node: HtmlNode): string {
  return collapseBlankLines(node.children.map(htmlNodeToMarkdown).map((child) => child.trim()).filter(Boolean).join('\n\n'));
}

function textContent(node: HtmlNode): string {
  if (node.tag === null) return node.text ?? '';
  return node.children.map(textContent).join('');
}

function textSegments(node: HtmlNode, separator: string): string {
  const segments: string[] = [];
  function collect(child: HtmlNode) {
    if (child.tag === null) {
      const text = child.text?.trim();
      if (text) segments.push(text);
    } else child.children.forEach(collect);
  }
  collect(node);
  return segments.join(separator);
}

function findNode(node: HtmlNode, tag: string): HtmlNode | undefined {
  if (node.tag === tag) return node;
  for (const child of node.children) {
    const found = findNode(child, tag);
    if (found) return found;
  }
}

function rawHtml(node: HtmlNode): string {
  if (node.tag === null) return escapeHtml(node.text ?? '');
  const attrs = Object.keys(node.attrs).sort().map((key) => ` ${key}=${quoteAttribute(node.attrs[key])}`).join('');
  if (voidTags.has(node.tag)) return `<${node.tag}${attrs}/>`;
  return `<${node.tag}${attrs}>${node.children.map(rawHtml).join('')}</${node.tag}>`;
}

function shouldPreserveTable(table: HtmlNode): boolean {
  return findAll(table, 'th').concat(findAll(table, 'td')).some((cell) =>
    Boolean(cell.attrs.rowspan || cell.attrs.colspan) || cell.children.some((child) =>
      child.tag !== null && !['a', 'strong', 'b', 'em', 'i', 's', 'strike', 'del', 'code', 'span', 'br'].includes(child.tag),
    ),
  );
}

function tableToMarkdown(table: HtmlNode): string {
  const rows = findAll(table, 'tr').map((row) => row.children.filter((cell) => cell.tag === 'th' || cell.tag === 'td')
    .map((cell) => childrenToMarkdown(cell).replace(/\n/g, '<br>').replace(/\|/g, '\\|')))
    .filter((row) => row.length > 0);
  if (!rows.length) return '';
  const columnCount = Math.max(...rows.map((row) => row.length));
  const padded = rows.map((row) => [...row, ...Array.from({ length: columnCount - row.length }, () => '')]);
  const formatRow = (row: string[]) => `| ${row.join(' | ')} |`;
  return [formatRow(padded[0]), formatRow(Array.from({ length: columnCount }, () => '---')),
    ...padded.slice(1).map(formatRow)].join('\n');
}

function findAll(node: HtmlNode, tag: string): HtmlNode[] {
  const found: HtmlNode[] = [];
  for (const child of node.children) {
    if (child.tag === tag) found.push(child);
    found.push(...findAll(child, tag));
  }
  return found;
}

function decodeEntities(value: string): string {
  return value.replace(/&(#(?:x[\da-f]+|\d+)|amp|lt|gt|quot|apos|nbsp);/gi, (entity, name: string) => {
    if (name[0] === '#') {
      const number = name[1]?.toLowerCase() === 'x' ? Number.parseInt(name.slice(2), 16) : Number.parseInt(name.slice(1), 10);
      return Number.isFinite(number) && number > 0 && number <= 0x10ffff ? String.fromCodePoint(number) : entity;
    }
    return ({ amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: '\u00a0' } as Record<string, string>)[name.toLowerCase()] ?? entity;
  });
}

function escapeHtml(value: string): string {
  return value.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function quoteAttribute(value: string): string {
  const escaped = escapeHtml(value);
  if (escaped.includes('"') && !escaped.includes("'")) return `'${escaped}'`;
  return `"${escaped.replace(/"/g, '&quot;')}"`;
}

function normalizeInlineSpacing(text: string): string {
  return text.replace(/[ \t]+/g, ' ').trim().replace(/\s+([.,:;!?])/g, '$1');
}

function collapseBlankLines(text: string): string {
  return text.replace(/\n{3,}/g, '\n\n').trim();
}
