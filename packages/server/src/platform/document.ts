import { youtubeFrameSources } from '../features/posts/post-html.js';

const captchaSources = 'https://hcaptcha.com https://*.hcaptcha.com';
const documentMarker = '<meta name="blex-application" content="1"/>';

// Client routing can visit any application page from any initial document.
export const applicationContentSecurityPolicy = [
  "default-src 'none'", "img-src 'self' https: data: blob:", "media-src 'self' https: blob:",
  "font-src 'self' data:", `style-src 'self' 'unsafe-inline' ${captchaSources}`,
  `script-src 'self' ${captchaSources}`, `connect-src 'self' ${captchaSources}`,
  `frame-src ${youtubeFrameSources} ${captchaSources}`,
  "form-action 'self'", "base-uri 'none'", "frame-ancestors 'none'",
].join('; ');

export function isApplicationDocument(payload: unknown): payload is string {
  if (typeof payload !== 'string' || !payload.startsWith('<!doctype html>')) return false;
  const headEnd = payload.indexOf('</head>');
  const marker = payload.indexOf(documentMarker);
  return headEnd !== -1 && marker !== -1 && marker < headEnd;
}

export function scriptJson(value: unknown): string {
  return JSON.stringify(value).replace(/</g, '\\u003c').replace(/>/g, '\\u003e').replace(/&/g, '\\u0026');
}
