import { __iconNode as telegramIcon } from '@tabler/icons-react/icons/IconBrandTelegram';
import { __iconNode as closeIcon } from '@tabler/icons-react/icons/IconX';
import { ENTRANCE_DURATION, INTERACTION_DURATION } from '../ui/lib/designTokens';

const rootId = 'blex-subscription-telegram-hint-root';
const cookieName = 'blex_telegram_hint';
const storagePrefix = 'blex:subscription-telegram-hint-shown:';
// The one brand color on the card. It stays readable on both light and dark surfaces.
const telegramBlue = '#007dbb';
const pressable = `transition-colors ${INTERACTION_DURATION} active:scale-95`;

/** The server leaves a short-lived note on the subscribe redirect. Reading it once also clears it. */
function takeHintUsername(): string {
    const entry = document.cookie.split('; ').find((item) => item.startsWith(`${cookieName}=`));
    if (!entry) return '';
    const secure = location.protocol === 'https:' ? '; Secure' : '';
    document.cookie = `${cookieName}=; Path=/; Max-Age=0; SameSite=Lax${secure}`;
    try {
        return decodeURIComponent(entry.slice(cookieName.length + 1));
    } catch {
        return '';
    }
}

/** Reserves the single showing for this account, and stays quiet when the browser cannot remember it. */
function claimShowing(username: string): boolean {
    if (!username) return false;
    const key = `${storagePrefix}${username}`;
    try {
        if (localStorage.getItem(key)) return false;
        localStorage.setItem(key, new Date().toISOString());
        return true;
    } catch {
        return false;
    }
}

function glyph(icon: typeof closeIcon, className: string): SVGSVGElement {
    const namespace = 'http://www.w3.org/2000/svg';
    const svg = document.createElementNS(namespace, 'svg');
    for (const [name, value] of Object.entries({
        viewBox: '0 0 24 24',
        fill: 'none',
        stroke: 'currentColor',
        'stroke-width': '2',
        'stroke-linecap': 'round',
        'stroke-linejoin': 'round',
        class: `tabler-icon ${className}`,
        'aria-hidden': 'true'
    }))
        svg.setAttribute(name, value);
    for (const [tag, attributes] of icon) {
        const part = document.createElementNS(namespace, tag);
        for (const [name, value] of Object.entries(attributes)) part.setAttribute(name, String(value));
        svg.append(part);
    }
    return svg;
}

function textElement<K extends keyof HTMLElementTagNameMap>(tag: K, className: string, text = '') {
    const node = document.createElement(tag);
    node.className = className;
    node.textContent = text;
    return node;
}

export function showTelegramHint(): void {
    if (!claimShowing(takeHintUsername())) return;
    document.getElementById(rootId)?.remove();

    const root = textElement('div', 'pointer-events-none fixed inset-x-0 z-40 flex justify-end px-4 sm:px-6');
    root.id = rootId;
    const raised = document.querySelector('.post-action-dock') !== null;
    root.style.bottom = `calc(${raised ? '7rem' : '1.5rem'} + env(safe-area-inset-bottom))`;

    const card = textElement(
        'aside',
        `pointer-events-auto relative w-full max-w-[22rem] rounded-2xl border border-line bg-surface-elevated p-4 text-content shadow-floating animate-in fade-in-0 ${ENTRANCE_DURATION}`
    );
    card.setAttribute('role', 'status');
    card.setAttribute('aria-live', 'polite');
    card.setAttribute('aria-label', '텔레그램 연결 안내');

    const onKeyDown = (event: KeyboardEvent) => {
        if (!root.isConnected) window.removeEventListener('keydown', onKeyDown);
        else if (event.key === 'Escape') close();
    };
    const close = () => {
        window.removeEventListener('keydown', onKeyDown);
        root.remove();
    };

    const closeButton = textElement(
        'button',
        `absolute right-1.5 top-1.5 inline-flex min-h-11 min-w-11 items-center justify-center rounded-lg text-content-hint hover:bg-surface-subtle hover:text-content ${pressable} [@media(pointer:fine)]:min-h-8 [@media(pointer:fine)]:min-w-8`
    );
    closeButton.type = 'button';
    closeButton.setAttribute('aria-label', '닫기');
    closeButton.append(glyph(closeIcon, 'h-4 w-4'));
    closeButton.addEventListener('click', close);

    const badge = textElement(
        'span',
        'flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-subtle'
    );
    badge.style.color = telegramBlue;
    badge.append(glyph(telegramIcon, 'h-4 w-4'));

    const copy = textElement('div', 'min-w-0');
    copy.append(
        textElement('p', 'text-sm font-semibold text-content', '구독했어요'),
        textElement('p', 'mt-0.5 text-sm text-content-secondary', '새 글을 텔레그램으로 받아보세요')
    );
    const message = textElement('div', 'flex items-center gap-3 pr-8');
    message.append(badge, copy);

    const actions = textElement('div', 'mt-3 flex items-center justify-end gap-1');
    const later = textElement(
        'button',
        `inline-flex min-h-11 items-center justify-center rounded-lg px-3 text-sm font-medium text-content-secondary hover:bg-surface-subtle hover:text-content ${pressable} [@media(pointer:fine)]:min-h-9`,
        '다음에'
    );
    later.type = 'button';
    later.addEventListener('click', close);
    const connect = textElement(
        'a',
        `inline-flex min-h-11 items-center justify-center rounded-lg bg-action px-3.5 text-sm font-semibold text-content-inverted hover:bg-action-hover ${pressable} [@media(pointer:fine)]:min-h-9`,
        '연결하기'
    );
    connect.href = '/settings/integration';
    connect.setAttribute('aria-label', '텔레그램 연결하기');
    actions.append(later, connect);

    card.append(closeButton, message, actions);
    root.append(card);
    document.body.append(root);
    window.addEventListener('keydown', onKeyDown);
}
