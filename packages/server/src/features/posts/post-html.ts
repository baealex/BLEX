import { DomUtils, parseDocument } from 'htmlparser2';
import sanitizeHtml from 'sanitize-html';

const youtubeHosts = new Set(['youtube.com', 'www.youtube.com', 'youtube-nocookie.com', 'www.youtube-nocookie.com']);

export const youtubeFrameSources = [...youtubeHosts].map((host) => `https://${host}`).join(' ');

const mediaSchemes = ['http', 'https'];
const lengthValue = /^(?:0|\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw))$/i;
const boxLengths = /^(?:0|\d+(?:\.\d+)?(?:px|rem|em|%))(?:\s+(?:0|\d+(?:\.\d+)?(?:px|rem|em|%))){0,3}$/i;
const colorValue = /^(?:#[a-f\d]{3,8}|[a-z]{1,24}|rgba?\([\d.,% /]+\))$/i;
const autoOrLength = /^(?:auto|0|\d+(?:\.\d+)?(?:px|rem|em|%|vh|vw))$/i;
const gridColumns = /^\d+(?:\.\d+)?fr(?:\s+\d+(?:\.\d+)?fr){0,5}$/i;
const themedColor = String.raw`(?:#[a-f\d]{3,8}|rgba?\([\d.,% /]+\)|var\(--color-[a-z-]+,\s*(?:#[a-f\d]{3,8}|rgba?\([\d.,% /]+\))\))`;
const borderValue = new RegExp(String.raw`^(?:0|none|\d+px\s+(?:solid|dashed|dotted)\s+${themedColor})$`, 'i');
const shadowValue = new RegExp(String.raw`^(?:none|(?:-?\d+px\s+){2,4}${themedColor})$`, 'i');
const editorDataAttributes = [
  'data-align',
  'data-aspect-ratio',
  'data-border',
  'data-border-radius',
  'data-shadow',
  'data-size',
];
const iframeFeatures = new Set([
  'accelerometer',
  'autoplay',
  'clipboard-write',
  'encrypted-media',
  'gyroscope',
  'picture-in-picture',
]);

function mediaUrl(value: string | undefined): string | undefined {
  const input = value?.trim();
  if (!input || /^[\/\\]{2}/.test(input) || /[\\\u0000-\u001f\u007f]/.test(input)) return;

  const url = URL.parse(input, 'https://blex.invalid');
  if (url?.protocol === 'http:' || url?.protocol === 'https:') return input;
}

function renderMedia(tagName: string, attributes: sanitizeHtml.Attributes): sanitizeHtml.Tag {
  // Older BLEX content stored the real source in data-src for its lazy loader.
  const { 'data-src': lazySource, ...attribs } = attributes;
  const source = mediaUrl(lazySource) ?? mediaUrl(attribs.src);
  if (source) attribs.src = source;
  else delete attribs.src;

  if (tagName === 'img' && lazySource) attribs.loading ??= 'lazy';
  if (attribs.srcset) {
    const candidates = attribs.srcset.split(',').map((candidate) => {
      const [url, descriptor] = candidate.trim().split(/\s+/);
      if (!mediaUrl(url)) return '';
      return descriptor && /^\d+(?:\.\d+)?[wx]$/.test(descriptor) ? `${url} ${descriptor}` : url;
    });
    attribs.srcset = candidates.filter(Boolean).join(', ');
  }
  return { tagName, attribs };
}

const postHtmlOptions: sanitizeHtml.IOptions = {
  allowedTags: [
    'a',
    'blockquote',
    'br',
    'code',
    'del',
    'div',
    'em',
    'figcaption',
    'figure',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'hr',
    'i',
    'iframe',
    'img',
    'li',
    'mark',
    'ol',
    'p',
    'pre',
    's',
    'small',
    'source',
    'span',
    'strong',
    'sub',
    'sup',
    'table',
    'tbody',
    'td',
    'tfoot',
    'th',
    'thead',
    'tr',
    'u',
    'ul',
    'video',
  ],
  allowedAttributes: {
    '*': ['class'],
    a: ['href', 'title', 'target', 'rel'],
    div: ['id', 'style', 'data-type', 'data-layout'],
    figure: ['style', ...editorDataAttributes],
    figcaption: ['style'],
    h1: ['id'],
    h2: ['id'],
    h3: ['id'],
    h4: ['id'],
    h5: ['id'],
    h6: ['id'],
    iframe: [
      'src',
      'title',
      'width',
      'height',
      'loading',
      'allow',
      'allowfullscreen',
      'referrerpolicy',
      'style',
      { name: 'frameborder', values: ['0', '1'] },
      ...editorDataAttributes,
    ],
    img: ['src', 'srcset', 'alt', 'title', 'width', 'height', 'loading', 'style', ...editorDataAttributes],
    ol: ['start'],
    p: ['id', 'style'],
    source: ['src', 'type'],
    span: ['id', 'style'],
    td: ['colspan', 'rowspan'],
    th: ['colspan', 'rowspan', 'scope'],
    video: [
      'src',
      'poster',
      'width',
      'height',
      'controls',
      'autoplay',
      'muted',
      'loop',
      'playsinline',
      'preload',
      'style',
      ...editorDataAttributes,
    ],
  },
  allowedStyles: {
    '*': {
      'align-items': [/^(?:start|end|center|flex-start|flex-end|stretch|baseline)$/],
      'aspect-ratio': [/^\d+(?:\.\d+)?(?:\s*\/\s*\d+(?:\.\d+)?)?$/],
      'background-color': [colorValue],
      color: [colorValue],
      display: [/^(?:block|flex|grid|inline|inline-block|inline-flex)$/],
      'flex-direction': [/^(?:row|row-reverse|column|column-reverse)$/],
      'justify-content': [/^(?:start|end|center|flex-start|flex-end|space-between|space-around|space-evenly)$/],
      'object-fit': [/^(?:contain|cover|fill|none|scale-down)$/],
      'text-align': [/^(?:left|right|start|end|center|justify)$/],
      border: [borderValue],
      'border-radius': [boxLengths],
      'box-shadow': [shadowValue],
      gap: [lengthValue],
      'grid-template-columns': [gridColumns],
      margin: [boxLengths],
      'margin-left': [autoOrLength],
      'margin-right': [autoOrLength],
      overflow: [/^(?:auto|clip|hidden|visible)$/],
      padding: [boxLengths],
      width: [lengthValue],
      height: [lengthValue],
      'min-width': [lengthValue],
      'max-width': [lengthValue],
      'min-height': [lengthValue],
      'max-height': [lengthValue],
    },
  },
  allowedSchemes: [...mediaSchemes, 'mailto'],
  allowedSchemesByTag: { img: mediaSchemes, video: mediaSchemes, source: mediaSchemes, iframe: ['https'] },
  allowedSchemesAppliedToAttributes: ['href', 'src', 'poster'],
  allowProtocolRelative: false,
  allowedIframeHostnames: [...youtubeHosts],
  allowIframeRelativeUrls: false,
  exclusiveFilter: (frame) => frame.tag === 'iframe' && !frame.attribs.src,
  transformTags: {
    a: (tagName, attributes) => {
      const { target, ...attribs } = attributes;
      if (target === '_blank') {
        attribs.target = target;
        attribs.rel = 'noopener noreferrer';
      }
      return { tagName, attribs };
    },
    img: renderMedia,
    video: renderMedia,
    source: renderMedia,
    iframe: (tagName, attributes) => {
      const { src, allow, ...attribs } = attributes;
      const features = allow
        ?.split(';')
        .map((feature) => feature.trim())
        .filter((feature) => iframeFeatures.has(feature));
      if (features?.length) attribs.allow = features.join('; ');
      const url = URL.parse(src ?? '');
      if (
        url?.protocol === 'https:' &&
        youtubeHosts.has(url.hostname) &&
        !url.port &&
        !url.username &&
        !url.password &&
        /^\/embed\/[a-zA-Z0-9_-]{1,64}$/.test(url.pathname)
      ) {
        attribs.src = url.href;
        attribs.loading = 'lazy';
        attribs.referrerpolicy = 'strict-origin-when-cross-origin';
        attribs.allowfullscreen = '';
      }
      return { tagName, attribs };
    },
  },
};

export function sanitizePostHtml(html: string): string {
  return sanitizeHtml(html, postHtmlOptions);
}

/** Author banners keep the declaration spacing 3.x wrote when it cleaned their inline styles. */
export function sanitizeBannerHtml(html: string): string {
  return sanitizePostHtml(html)
    .trimStart()
    .replace(/\bstyle="([^"]*)"/g, (_match, css: string) => {
      const declarations = css
        .split(';')
        .map((part) => part.trim())
        .filter(Boolean)
        .map((part) => {
          const colon = part.indexOf(':');
          return colon < 0 ? part : `${part.slice(0, colon).trim()}: ${part.slice(colon + 1).trim()}`;
        });
      return `style="${declarations.join('; ')}"`;
    });
}

const commentHtmlOptions: sanitizeHtml.IOptions = {
  ...postHtmlOptions,
  allowedTags: [
    'div',
    'p',
    'span',
    'a',
    'img',
    'h1',
    'h2',
    'h3',
    'h4',
    'h5',
    'h6',
    'ul',
    'ol',
    'li',
    'br',
    'strong',
    'em',
    'b',
    'i',
    'u',
    'blockquote',
    'code',
    'pre',
    'hr',
    'small',
    'sub',
    'sup',
    'mark',
    'del',
    'ins',
    's',
    'figure',
    'figcaption',
    'table',
    'thead',
    'tbody',
    'tfoot',
    'tr',
    'th',
    'td',
    'video',
    'source',
    'iframe',
    'input',
  ],
  allowedAttributes: {
    a: ['href', 'title', 'target', 'rel', 'class'],
    img: ['src', 'alt', 'title', 'width', 'height', 'class', 'loading'],
    ul: ['class'],
    li: ['class'],
    code: ['class'],
    pre: ['class'],
    figure: ['class'],
    th: ['colspan', 'rowspan'],
    td: ['colspan', 'rowspan'],
    video: ['class', 'autoplay', 'muted', 'loop', 'playsinline', 'controls', 'poster'],
    source: ['src', 'type'],
    iframe: ['src', 'title', 'allow', 'allowfullscreen', 'frameborder', 'loading', 'referrerpolicy'],
    input: ['type', 'checked', 'disabled'],
  },
  allowedClasses: {
    a: ['mention'],
    img: ['lazy'],
    video: ['lazy'],
    ul: ['task-list'],
    li: ['checkbox', 'checked', 'task-list-item'],
    figure: ['col-1', 'col-2', 'col-3'],
    pre: ['highlight', 'codehilite', 'lang-*', 'language-*'],
    code: ['highlight', 'codehilite', 'lang-*', 'language-*'],
  },
  allowedStyles: {},
};

/** Comments keep the narrower 3.x allowlist; post layout attributes do not apply to them. */
export function sanitizeCommentHtml(html: string): string {
  return sanitizeHtml(html, commentHtmlOptions);
}

export function postOutline(html: string, naming: { maxLength?: number; fallback: string } = { fallback: 'heading' }) {
  if (!/<h[1-6][\s>]/.test(html)) return { html, headings: [] };
  const document = parseDocument(html, { withStartIndices: true });
  const elements = DomUtils.getElementsByTagName((name) => /^h[1-6]$/.test(name), document.children);
  const used = new Set(elements.flatMap((element) => element.attribs.id || []));
  const nextSuffix = new Map<string, number>();
  let body = '';
  let cursor = 0;
  const headings = elements.flatMap((element) => {
    const text = DomUtils.textContent(element).trim();
    if (!text) return [];
    let id = element.attribs.id;
    if (!id) {
      const slug = text
        .normalize('NFKC')
        .toLowerCase()
        .replace(/[^\p{L}\p{N}_\s-]/gu, '')
        .replace(/[-\s]+/g, '-')
        .replace(/^-|-$/g, '');
      const base = (naming.maxLength ? Array.from(slug).slice(0, naming.maxLength).join('') : slug) || naming.fallback;
      id = base;
      let suffix = nextSuffix.get(base) ?? 1;
      while (used.has(id)) {
        id = `${base}-${suffix}`;
        suffix += 1;
      }
      nextSuffix.set(base, suffix);
      used.add(id);
      const offset = (element.startIndex ?? 0) + element.name.length + 1;
      body += html.slice(cursor, offset) + ` id="${id}"`;
      cursor = offset;
    }
    return [{ id, text, level: Number(element.name[1]) }];
  });
  return { html: body + html.slice(cursor), headings };
}
