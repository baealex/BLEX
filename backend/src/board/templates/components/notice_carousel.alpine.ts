interface NoticeCarouselOptions {
    totalBanners?: number;
}

interface NoticeCarouselState {
    currentIndex: number;
    totalBanners: number;
    interval: number | null;
    init(): void;
    goTo(index: number): void;
    prev(): void;
    next(): void;
    startAutoPlay(): void;
    stopAutoPlay(): void;
    resetAutoPlay(): void;
}

const notice_carousel = (options: NoticeCarouselOptions = {}): NoticeCarouselState => ({
    currentIndex: 0,
    totalBanners: options.totalBanners ?? 0,
    interval: null,

    init() {
        if (this.totalBanners > 1) {
            this.startAutoPlay();
        }
    },

    goTo(index: number) {
        this.currentIndex = index;
        this.resetAutoPlay();
    },

    prev() {
        this.currentIndex = this.currentIndex === 0 ? this.totalBanners - 1 : this.currentIndex - 1;
        this.resetAutoPlay();
    },

    next() {
        this.currentIndex = (this.currentIndex + 1) % this.totalBanners;
        this.resetAutoPlay();
    },

    startAutoPlay() {
        this.interval = setInterval(() => {
            this.currentIndex = (this.currentIndex + 1) % this.totalBanners;
        }, 5000);
    },

    stopAutoPlay() {
        if (this.interval) {
            clearInterval(this.interval);
            this.interval = null;
        }
    },

    resetAutoPlay() {
        this.stopAutoPlay();
        if (this.totalBanners > 1) {
            this.startAutoPlay();
        }
    }
});

export default notice_carousel;
