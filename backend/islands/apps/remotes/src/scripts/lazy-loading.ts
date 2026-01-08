let imageObserver: IntersectionObserver | null = null;
let videoObserver: IntersectionObserver | null = null;
let mutationObserver: MutationObserver | null = null;

function processLazyElements() {
    const lazyImages = Array.from(document.querySelectorAll('img.lazy')) as HTMLImageElement[];
    const lazyVideos = Array.from(document.querySelectorAll('video.lazy')) as HTMLVideoElement[];

    if ('IntersectionObserver' in window) {
        if (!imageObserver) {
            imageObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const image = entry.target as HTMLImageElement;
                        if (image.dataset.src) {
                            image.src = image.dataset.src;
                        }
                        image.classList.remove('lazy');
                        imageObserver!.unobserve(image);
                    }
                });
            });
        }

        if (!videoObserver) {
            videoObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        const video = entry.target as HTMLVideoElement;
                        const source = video.querySelector('source') as HTMLSourceElement;
                        if (source?.dataset.src) {
                            source.src = source.dataset.src;
                            video.load();
                        }
                        video.classList.remove('lazy');
                        videoObserver!.unobserve(video);
                    }
                });
            });
        }

        lazyImages.forEach(image => {
            if (image.classList.contains('lazy')) {
                imageObserver!.observe(image);
            }
        });

        lazyVideos.forEach(video => {
            if (video.classList.contains('lazy')) {
                videoObserver!.observe(video);
            }
        });
    } else {
        // Fallback for browsers without IntersectionObserver
        lazyImages.forEach(image => {
            if (image.dataset.src) {
                image.src = image.dataset.src;
            }
            image.classList.remove('lazy');
        });

        lazyVideos.forEach(video => {
            const source = video.querySelector('source') as HTMLSourceElement;
            if (source?.dataset.src) {
                source.src = source.dataset.src;
                video.load();
            }
            video.classList.remove('lazy');
        });
    }
}

function initializeLazyLoading() {
    processLazyElements();

    if ('MutationObserver' in window && !mutationObserver) {
        mutationObserver = new MutationObserver((mutations) => {
            let hasNewLazyElements = false;

            mutations.forEach((mutation) => {
                if (mutation.type === 'childList') {
                    mutation.addedNodes.forEach((node) => {
                        if (node.nodeType === Node.ELEMENT_NODE) {
                            const element = node as Element;

                            if (element.matches?.('img.lazy, video.lazy') ||
                                element.querySelector?.('img.lazy, video.lazy')) {
                                hasNewLazyElements = true;
                            }
                        }
                    });
                }
            });

            if (hasNewLazyElements) {
                processLazyElements();
            }
        });

        mutationObserver.observe(document.body, {
            childList: true,
            subtree: true
        });
    }
}

export function destroyLazyLoading() {
    if (imageObserver) {
        imageObserver.disconnect();
        imageObserver = null;
    }

    if (videoObserver) {
        videoObserver.disconnect();
        videoObserver = null;
    }

    if (mutationObserver) {
        mutationObserver.disconnect();
        mutationObserver = null;
    }
}

document.addEventListener('DOMContentLoaded', () => {
    initializeLazyLoading();
});
