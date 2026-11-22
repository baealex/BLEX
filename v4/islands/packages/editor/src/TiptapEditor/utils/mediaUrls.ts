const MEDIA_PATH_PREFIXES = ['/resources/media/'];

const getCurrentOrigin = () => {
    if (typeof window === 'undefined') return null;
    return window.location.origin;
};

const getMediaPathPrefixes = () => {
    if (typeof window === 'undefined') return MEDIA_PATH_PREFIXES;

    const configuration = (window as Window & {
        configuration?: { media?: string };
    }).configuration;
    const configuredMedia = configuration?.media;

    if (!configuredMedia) return MEDIA_PATH_PREFIXES;

    try {
        const mediaUrl = new URL(configuredMedia, window.location.href);
        return Array.from(new Set([...MEDIA_PATH_PREFIXES, mediaUrl.pathname]));
    } catch {
        return MEDIA_PATH_PREFIXES;
    }
};

const hasMediaPath = (pathname: string) => {
    return getMediaPathPrefixes().some(prefix => pathname.startsWith(prefix));
};

export const normalizeMediaUrlForStorage = (url: string | null | undefined) => {
    if (!url) return url || '';

    const currentOrigin = getCurrentOrigin();
    if (!currentOrigin) return url;

    try {
        const parsedUrl = new URL(url, window.location.href);

        if (!['http:', 'https:'].includes(parsedUrl.protocol)) return url;
        if (parsedUrl.origin !== currentOrigin) return url;
        if (!hasMediaPath(parsedUrl.pathname)) return url;

        return `${parsedUrl.pathname}${parsedUrl.search}${parsedUrl.hash}`;
    } catch {
        return url;
    }
};

const normalizeMediaSrcsetForStorage = (srcset: string | null | undefined) => {
    if (!srcset) return srcset || '';

    let changed = false;
    const candidates = splitSrcsetCandidates(srcset).map(candidate => {
        const trimmedCandidate = candidate.trim();
        if (!trimmedCandidate || trimmedCandidate.startsWith('data:')) return candidate;

        const [url, ...descriptors] = trimmedCandidate.split(/\s+/);
        const normalizedUrl = normalizeMediaUrlForStorage(url);
        if (normalizedUrl === url) return candidate;

        changed = true;
        return [normalizedUrl, ...descriptors].join(' ');
    });

    return changed ? candidates.join(', ') : srcset;
};

function splitSrcsetCandidates(srcset: string) {
    const candidates: string[] = [];
    let start = 0;
    let inDataUrl = false;
    let sawNonWhitespace = false;
    let sawWhitespaceAfterUrl = false;

    const resetCandidateState = () => {
        inDataUrl = false;
        sawNonWhitespace = false;
        sawWhitespaceAfterUrl = false;
    };

    for (let index = 0; index < srcset.length; index += 1) {
        const char = srcset[index];

        if (!sawNonWhitespace && !/\s/.test(char)) {
            sawNonWhitespace = true;
            inDataUrl = srcset.slice(index).toLowerCase().startsWith('data:');
        } else if (inDataUrl && sawNonWhitespace && /\s/.test(char)) {
            sawWhitespaceAfterUrl = true;
        }

        if (char !== ',') continue;
        if (inDataUrl && !sawWhitespaceAfterUrl) continue;

        candidates.push(srcset.slice(start, index));
        start = index + 1;
        resetCandidateState();
    }

    candidates.push(srcset.slice(start));
    return candidates;
}

export const normalizeMediaUrlsInHtml = (html: string) => {
    if (!html || typeof document === 'undefined') return html || '';

    const currentOrigin = getCurrentOrigin();
    if (!currentOrigin || !html.includes(currentOrigin)) return html;

    const template = document.createElement('template');
    template.innerHTML = html;

    let changed = false;

    template.content.querySelectorAll('img, video, source').forEach(element => {
        ['src', 'poster', 'data-src', 'srcset'].forEach(attribute => {
            const value = element.getAttribute(attribute);
            const normalized = attribute === 'srcset'
                ? normalizeMediaSrcsetForStorage(value)
                : normalizeMediaUrlForStorage(value);

            if (value && normalized !== value) {
                element.setAttribute(attribute, normalized);
                changed = true;
            }
        });
    });

    return changed ? template.innerHTML : html;
};
