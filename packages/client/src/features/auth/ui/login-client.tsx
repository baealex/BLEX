import { hydrateRoot } from 'react-dom/client';
import { LoginForm, type LoginModel } from './login-form.js';
import './login.css';

const activeMounts = new WeakMap<HTMLElement, () => void>();

export function mountPage(scope: ParentNode): (() => void) | undefined {
    const root = findLoginRoot(scope);
    if (!root) return undefined;
    const active = activeMounts.get(root);
    if (active) return active;

    const serializedModel = root.dataset.model;
    if (!serializedModel) return undefined;
    const model = parseLoginModel(serializedModel);
    if (!model) {
        console.error('Could not hydrate the login form because its server model is invalid.');
        return undefined;
    }

    const reactRoot = hydrateRoot(root, <LoginForm model={model} />);
    let mounted = true;
    const cleanup = () => {
        if (!mounted) return;
        mounted = false;
        reactRoot.unmount();
        activeMounts.delete(root);
    };
    activeMounts.set(root, cleanup);
    return cleanup;
}

function findLoginRoot(scope: ParentNode): HTMLElement | null {
    if (typeof HTMLElement !== 'undefined' && scope instanceof HTMLElement && scope.matches('#blex-login'))
        return scope;
    return scope.querySelector<HTMLElement>('#blex-login');
}

if (typeof document !== 'undefined' && !document.getElementById('blex-application')) {
    mountPage(document);
}

function parseLoginModel(serialized: string): LoginModel | null {
    let value: unknown;
    try {
        value = JSON.parse(serialized);
    } catch {
        return null;
    }
    if (
        !isRecord(value) ||
        typeof value.csrfToken !== 'string' ||
        typeof value.next !== 'string' ||
        !Array.isArray(value.providers)
    ) {
        return null;
    }
    const providers = value.providers.filter(isProvider);
    if (providers.length !== value.providers.length) return null;

    let pendingOAuth: LoginModel['pendingOAuth'] = null;
    if (value.pendingOAuth !== null) {
        if (!isRecord(value.pendingOAuth) || typeof value.pendingOAuth.username !== 'string') return null;
        pendingOAuth = { username: value.pendingOAuth.username };
    }
    return {
        csrfToken: value.csrfToken,
        next: value.next,
        providers,
        pendingOAuth
    };
}

function isRecord(value: unknown): value is Record<string, unknown> {
    return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function isProvider(value: unknown): value is LoginModel['providers'][number] {
    return isRecord(value) && (value.key === 'google' || value.key === 'github') && typeof value.name === 'string';
}
