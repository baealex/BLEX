import { hydrateRoot } from 'react-dom/client';
import { PostCommentsApp, type PostCommentsModel } from './comments.js';

const activeMounts = new WeakMap<HTMLElement, () => void>();

export function mountPage(scope: ParentNode): (() => void) | undefined {
    const root = scope.querySelector<HTMLElement>('[data-blex-post-comments]');
    if (!root) return undefined;
    const active = activeMounts.get(root);
    if (active) return active;
    let model: PostCommentsModel;
    try {
        model = JSON.parse(root.dataset.model ?? '') as PostCommentsModel;
    } catch {
        console.error('Could not hydrate comments because their server model is invalid.');
        return undefined;
    }
    const reactRoot = hydrateRoot(root, <PostCommentsApp model={model} />);
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

if (typeof document !== 'undefined' && !document.getElementById('blex-application')) {
    mountPage(document);
}
