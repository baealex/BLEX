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

export function lazyLoadResource() {
    if (!document.querySelectorAll) {
        Array.from(document.getElementsByClassName('lazy')).forEach((element: any) => {
            element.src = element.dataset.src;
        });
    }

    const lazyImages = Array.from(document.querySelectorAll('img.lazy'));

    if ('IntersectionObserver' in window) {
        const lazyImageObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    const lazyImage = entry.target as HTMLImageElement;
                    lazyImage.src = lazyImage.dataset.src || '';
                    // lazyImage.classList.remove("lazy");
                    lazyImageObserver.unobserve(lazyImage);
                }
            });
        });

        lazyImages.forEach((lazyImage) => {
            lazyImageObserver.observe(lazyImage);
        });
    } else {
        lazyImages.forEach((entry) => {
            const lazyImage = entry as HTMLImageElement;
            lazyImage.src = lazyImage.dataset.src || '';
        });
    }

    const lazyVideos = Array.from(document.querySelectorAll('video.lazy'));

    if ('IntersectionObserver' in window) {
        const lazyVideoObserver = new IntersectionObserver((entries) => {
            entries.forEach((video: any) => {
                if (video.isIntersecting) {
                    for (const source in video.target.children) {
                        const videoSource = video.target.children[source];
                        if (typeof videoSource.tagName === 'string' && videoSource.tagName === 'SOURCE') {
                            videoSource.src = videoSource.dataset.src;
                        }
                    }
                    video.target.load();
                    // video.target.classList.remove("lazy");
                    lazyVideoObserver.unobserve(video.target);
                }
            });
        });

        lazyVideos.forEach((lazyVideo) => {
            lazyVideoObserver.observe(lazyVideo);
        });
    } else {
        lazyVideos.forEach((entry) => {
            const lazyVideo = entry as HTMLVideoElement;
            lazyVideo.src = lazyVideo.dataset.src || '';
        });
    }
}
