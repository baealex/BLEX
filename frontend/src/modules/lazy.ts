export function lazyIntersection(className: string, callback: Function) {
    let element = document.getElementsByClassName(className.replace('.', ''))[0];

    if ("IntersectionObserver" in window) {
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

    let lazyImages = Array.from(document.querySelectorAll("img.lazy"));

    if ("IntersectionObserver" in window) {
        const lazyImageObserver = new IntersectionObserver((entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    let lazyImage: any = entry.target;
                    lazyImage.src = lazyImage.dataset.src;
                    // lazyImage.classList.remove("lazy");
                    lazyImageObserver.unobserve(lazyImage);
                }
            });
        });

        lazyImages.forEach((lazyImage) => {
            lazyImageObserver.observe(lazyImage);
        });
    } else {

    }

    var lazyVideos = Array.from(document.querySelectorAll("video.lazy"));

    if ("IntersectionObserver" in window) {
        const lazyVideoObserver = new IntersectionObserver((entries) => {
            entries.forEach((video: any) => {
                if (video.isIntersecting) {
                    for (var source in video.target.children) {
                        var videoSource = video.target.children[source];
                        if (typeof videoSource.tagName === "string" && videoSource.tagName === "SOURCE") {
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
        
    }
}