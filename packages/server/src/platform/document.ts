import { youtubeFrameSources } from '../features/posts/post-html.js';

declare module 'fastify' {
  interface FastifyContextConfig {
    /** The route lets this site frame its page and sends that page's policy itself. */
    framedBySite?: boolean;
  }
}

const captchaSources = 'https://hcaptcha.com https://*.hcaptcha.com';
const documentMarker = '<meta name="blex-application" content="1"/>';
// The editor frames the saved draft preview; no other page of the site is framed.
const draftPreviewPath = '/write/preview/';

function documentPolicy(siteUrl: URL, frameAncestors: string): string {
  return [
    "default-src 'none'",
    "img-src 'self' https: data: blob:",
    "media-src 'self' https: blob:",
    "font-src 'self' data:",
    `style-src 'self' 'unsafe-inline' ${captchaSources}`,
    `script-src 'self' ${captchaSources}`,
    `connect-src 'self' ${captchaSources}`,
    `frame-src ${youtubeFrameSources} ${captchaSources} ${new URL(draftPreviewPath, siteUrl).href}`,
    "form-action 'self'",
    "base-uri 'none'",
    `frame-ancestors ${frameAncestors}`,
  ].join('; ');
}

// Client routing can visit any application page from any initial document.
export function applicationContentSecurityPolicy(siteUrl: URL): string {
  return documentPolicy(siteUrl, "'none'");
}

// Only the site's own pages may frame a draft preview.
export function draftPreviewContentSecurityPolicy(siteUrl: URL): string {
  return documentPolicy(siteUrl, "'self'");
}

export function isApplicationDocument(payload: unknown): payload is string {
  if (typeof payload !== 'string' || !payload.startsWith('<!doctype html>')) return false;
  const headEnd = payload.indexOf('</head>');
  const marker = payload.indexOf(documentMarker);
  return headEnd !== -1 && marker !== -1 && marker < headEnd;
}

export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}
