interface RefreshPartialElementOptions {
    selector: string;
    url?: string;
    fallbackToReload?: boolean;
}

const readPartialUrl = (element: HTMLElement, url?: string) => url || element.dataset.partialUrl;

const reloadOrReturnFalse = (fallbackToReload: boolean) => {
    if (fallbackToReload) {
        window.location.reload();
    }

    return false;
};

export const refreshPartialElement = async ({
    selector,
    url,
    fallbackToReload = true
}: RefreshPartialElementOptions) => {
    const currentElement = document.querySelector<HTMLElement>(selector);

    if (!currentElement) {
        return reloadOrReturnFalse(fallbackToReload);
    }

    const partialUrl = readPartialUrl(currentElement, url);

    if (!partialUrl) {
        return reloadOrReturnFalse(fallbackToReload);
    }

    currentElement.setAttribute('aria-busy', 'true');
    currentElement.classList.add('opacity-60', 'transition-opacity', 'duration-150');

    try {
        const response = await fetch(partialUrl, {
            credentials: 'same-origin',
            headers: { 'X-Requested-With': 'XMLHttpRequest' }
        });

        if (!response.ok) {
            throw new Error('Failed to refresh partial element');
        }

        const html = (await response.text()).trim();

        if (!html) {
            currentElement.remove();
            return true;
        }

        const nextDocument = new DOMParser().parseFromString(html, 'text/html');
        const nextElement = nextDocument.querySelector<HTMLElement>(selector);

        if (!nextElement) {
            throw new Error('Partial element was not found');
        }

        currentElement.replaceWith(nextElement);
        return true;
    } catch {
        return reloadOrReturnFalse(fallbackToReload);
    }
};
