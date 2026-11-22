import { __iconNode as userIcon } from '@tabler/icons-react/icons/IconUser';
import type { LoginPromptAction } from '../features/engagement/ui/login-prompt.js';

interface SocialProvider { key: string; name: string }

const descriptions: Record<LoginPromptAction, string> = {
  like: '좋아요를 누르려면 로그인해 주세요.',
  comment: '댓글을 남기려면 로그인해 주세요.',
  reply: '답글을 작성하려면 로그인해 주세요.',
  subscribe: '이 작가의 새 글 알림을 받으려면 로그인해 주세요.',
};
const actionClass = 'flex min-h-11 w-full items-center justify-center rounded-xl px-4 text-sm font-semibold transition-colors duration-150';

let dialog: HTMLDialogElement | undefined;
let providersRequest: Promise<SocialProvider[]> | undefined;
let openCount = 0;

function loadProviders(): Promise<SocialProvider[]> {
  providersRequest ??= fetch('/v1/social-providers', { headers: { accept: 'application/json' } })
    .then((response) => response.ok ? response.json() as Promise<{ body?: unknown }> : { body: [] })
    .then(({ body }) => Array.isArray(body)
      ? body.filter((item): item is SocialProvider => typeof item?.key === 'string' && typeof item?.name === 'string')
      : [])
    .catch(() => []);
  return providersRequest;
}

function element<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = ''): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  node.className = className;
  node.textContent = text;
  return node;
}

function nativeLink(href: string, text: string, className: string): HTMLAnchorElement {
  const link = element('a', className, text);
  link.href = href;
  link.setAttribute('data-no-spa', '');
  return link;
}

function userGlyph(): SVGSVGElement {
  const namespace = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(namespace, 'svg');
  for (const [name, value] of Object.entries({
    viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor', 'stroke-width': '2', 'stroke-linecap': 'round', 'stroke-linejoin': 'round',
    class: 'size-5 text-content', 'aria-hidden': 'true',
  })) svg.setAttribute(name, value);
  for (const [tag, attributes] of userIcon) {
    const part = document.createElementNS(namespace, tag);
    for (const [name, value] of Object.entries(attributes)) if (name !== 'key') part.setAttribute(name, String(value));
    svg.append(part);
  }
  return svg;
}

function ensureDialog(): HTMLDialogElement {
  if (dialog?.isConnected) return dialog;
  const modal = element('dialog', 'fixed inset-0 m-auto h-fit w-[calc(100%-2rem)] max-w-sm rounded-2xl border border-line bg-surface p-8 text-center text-content shadow-xl backdrop:bg-black/50');
  modal.id = 'blex-login-prompt';
  modal.setAttribute('aria-labelledby', 'blex-login-prompt-title');
  modal.setAttribute('aria-describedby', 'blex-login-prompt-description');
  const icon = element('div', 'mx-auto mb-6 flex size-16 items-center justify-center rounded-full bg-surface-subtle ring-4 ring-line-light');
  icon.append(userGlyph());
  const title = element('h2', 'mb-2 text-xl font-semibold text-content', '로그인이 필요해요');
  title.id = 'blex-login-prompt-title';
  const description = element('p', 'mb-5 text-sm text-content-secondary');
  description.id = 'blex-login-prompt-description';
  const providers = element('div', 'mb-3 grid gap-2');
  providers.dataset.loginProviders = '';
  const login = nativeLink('/login', '로그인하기', `${actionClass} bg-action text-content-inverted hover:bg-action-hover`);
  login.dataset.loginSubmit = '';
  const cancel = element('button', `${actionClass} mt-2 border border-line bg-surface text-content-secondary hover:text-content`, '취소');
  cancel.type = 'button';
  cancel.addEventListener('click', () => modal.close());
  modal.addEventListener('click', (event) => { if (event.target === modal) modal.close(); });
  modal.append(icon, title, description, providers, login, cancel);
  document.body.append(modal);
  dialog = modal;
  return modal;
}

function openLoginPrompt(action: LoginPromptAction, next: string): void {
  const modal = ensureDialog();
  const request = ++openCount;
  modal.querySelector<HTMLElement>('#blex-login-prompt-description')!.textContent = descriptions[action];
  modal.querySelector<HTMLAnchorElement>('[data-login-submit]')!.href = `/login?next=${encodeURIComponent(next)}`;
  const providers = modal.querySelector<HTMLElement>('[data-login-providers]')!;
  providers.replaceChildren();
  if (!modal.open) modal.showModal();
  void loadProviders().then((items) => {
    if (request !== openCount) return;
    providers.replaceChildren(...items.map((provider) => nativeLink(
      `/login/start/${encodeURIComponent(provider.key)}?${new URLSearchParams({ next })}`,
      `${provider.name}로 계속하기`,
      `${actionClass} border border-line bg-surface text-content hover:bg-surface-subtle`,
    )));
  });
}

/** Opens the shared login modal when an anonymous reader activates a member-only control. */
export function openLoginPromptFrom(anchor: HTMLAnchorElement): boolean {
  const action = anchor.getAttribute('data-blex-login-prompt');
  const next = anchor.getAttribute('data-blex-login-next');
  if (!next || !action || !(action in descriptions)) return false;
  openLoginPrompt(action as LoginPromptAction, next);
  return true;
}
