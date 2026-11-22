import { lookup } from 'node:dns/promises';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';
import { BlockList, isIP } from 'node:net';

const denied = new BlockList();
for (const [address, prefix] of [
  ['0.0.0.0', 8], ['10.0.0.0', 8], ['100.64.0.0', 10], ['127.0.0.0', 8], ['169.254.0.0', 16],
  ['172.16.0.0', 12], ['192.0.0.0', 24], ['192.0.2.0', 24], ['192.88.99.0', 24], ['192.168.0.0', 16],
  ['198.18.0.0', 15], ['198.51.100.0', 24], ['203.0.113.0', 24], ['224.0.0.0', 3],
] as const) denied.addSubnet(address, prefix, 'ipv4');
for (const [address, prefix] of [['2001::', 23], ['2001:db8::', 32], ['2002::', 16], ['3fff::', 20]] as const) {
  denied.addSubnet(address, prefix, 'ipv6');
}
const ipv6Global = new BlockList();
ipv6Global.addSubnet('2000::', 3, 'ipv6');

function isPublic(address: string, family: number) {
  if (family === 4) return !denied.check(address, 'ipv4');
  return family === 6 && ipv6Global.check(address, 'ipv6') && !denied.check(address, 'ipv6');
}

function hostnameOf(url: URL) { return url.hostname.replace(/^\[|\]$/g, '').replace(/\.$/, ''); }

export function parseWebhookUrl(input: unknown) {
  if (typeof input !== 'string' || input.length > 500 || /[\u0000-\u0020\u007f\\]/u.test(input)) return null;
  const url = URL.parse(input);
  if (!url || !['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.hash || url.port === '0') return null;
  const host = hostnameOf(url);
  const family = isIP(host);
  if (family) return isPublic(host, family) ? url : null;
  return host.includes('.') && !/\.(?:localhost|local|internal|test|invalid)$/i.test(host) ? url : null;
}

export type SendWebhook = (url: URL, text: string, postUrl: string, signal?: AbortSignal) => Promise<boolean>;

export const sendWebhook: SendWebhook = async (url, text, postUrl, stop) => {
  const hostname = hostnameOf(url);
  const family = isIP(hostname);
  const signal = stop ? AbortSignal.any([stop, AbortSignal.timeout(10_000)]) : AbortSignal.timeout(10_000);
  try {
    const addresses = family ? [{ address: hostname, family }] : await lookup(hostname, { all: true });
    if (signal.aborted || !addresses.length || addresses.some(({ address, family }) => !isPublic(address, family))) return false;
    const host = url.hostname.toLowerCase();
    const payload = JSON.stringify(/(^|\.)discord(?:app)?\.com$/.test(host) ? { content: text, allowed_mentions: { parse: [] } } :
      /(^|\.)slack\.com$/.test(host) ? { text, unfurl_links: true } : { content: text, text, message: text, url: postUrl });
    const client = url.protocol === 'https:' ? httpsRequest : httpRequest;

    // Connect to a validated address and retain the original TLS identity.
    // A second DNS lookup or an HTTP redirect must not choose the destination.
    return await new Promise<boolean>((resolve) => {
      const request = client({
        hostname: addresses[0].address, port: url.port || (url.protocol === 'https:' ? 443 : 80),
        servername: family ? undefined : hostname, path: `${url.pathname}${url.search}`, method: 'POST',
        signal, agent: false, headers: { Host: url.host, 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(payload) },
      }, (response) => {
        const ok = (response.statusCode ?? 500) >= 200 && (response.statusCode ?? 500) < 300;
        response.destroy();
        resolve(ok);
      });
      request.once('error', () => resolve(false));
      request.end(payload);
    });
  } catch {
    return false;
  }
};
