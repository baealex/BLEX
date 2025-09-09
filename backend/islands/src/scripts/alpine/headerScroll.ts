import type Alpine from 'alpinejs';

interface State {
    translateY: number;
    lastScrollY: number;
    headerHeight: number;
}

interface Actions {
    init(): void;
}

const headerScroll = (): Alpine.AlpineComponent<State & Actions> => ({
    translateY: 0,
    lastScrollY: 0,
    headerHeight: 0,
    init() {
        this.$nextTick(() => {
            const header = this.$el as HTMLElement;
            this.headerHeight = header.offsetHeight;

            let ticking = false;

            const updateHeader = () => {
                const currentScrollY = window.scrollY;
                const scrollDiff = currentScrollY - this.lastScrollY;

                if (currentScrollY <= 0) {
                    this.translateY = 0;
                } else if (scrollDiff > 0) {
                    this.translateY = Math.min(this.translateY + scrollDiff, this.headerHeight);
                } else {
                    this.translateY = Math.max(this.translateY + scrollDiff, 0);
                }

                this.lastScrollY = currentScrollY;
                ticking = false;
            };

            window.addEventListener('scroll', () => {
                if (!ticking) {
                    requestAnimationFrame(updateHeader);
                    ticking = true;
                }
            });
        });
    }
});

export default headerScroll;
