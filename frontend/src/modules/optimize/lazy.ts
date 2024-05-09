export function lazyIntersection(element: HTMLElement | null, callback: () => void) {
    if ('IntersectionObserver' in window) {
        if (element) {
            const observer = new IntersectionObserver((entries, observer) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        observer.unobserve(entry.target);
                        callback();
                    }
                });
            });
            observer.observe(element);
            return observer;
        }
    } else {
        callback();
    }
}

export function lazyLoadResource(root?: HTMLElement) {
    const images = Array.from((root || document).querySelectorAll('img.lazy')) as HTMLImageElement[];

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const image = entry.target as HTMLImageElement;
                    image.src = image.dataset.src || '';
                    observer.unobserve(image);
                }
            });
        });
        images.forEach(image => observer.observe(image));
    } else {
        images.forEach((image) => {
            image.src = image.dataset.src || '';
        });
    }

    const videos = Array.from(document.querySelectorAll('video.lazy')) as HTMLVideoElement[];

    if ('IntersectionObserver' in window) {
        const observer = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const video = entry.target as HTMLVideoElement;
                    for (const source in video.children) {
                        const videoSource = video.children[source] as HTMLSourceElement;
                        if (typeof videoSource.tagName === 'string' && videoSource.tagName === 'SOURCE') {
                            videoSource.src = videoSource.dataset.src || '';
                        }
                    }
                    video.load();
                    observer.unobserve(video);
                }
            });
        });

        videos.forEach(video => observer.observe(video));
    } else {
        videos.forEach((video) => {
            for (const source in video.children) {
                const videoSource = video.children[source] as HTMLSourceElement;
                if (typeof videoSource.tagName === 'string' && videoSource.tagName === 'SOURCE') {
                    videoSource.src = videoSource.dataset.src || '';
                }
                video.load();
            }
        });
    }
}
