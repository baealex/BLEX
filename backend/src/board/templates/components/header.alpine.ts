import type Alpine from 'alpinejs';

interface State {
    isTop: boolean;
}

interface Actions {
    init(): void;
}

const header = (): Alpine.AlpineComponent<State & Actions> => ({
    isTop: true,

    init() {
        this.isTop = window.scrollY < 10;

        const updateHeader = () => {
            this.isTop = window.scrollY < 10;
        };

        window.addEventListener('scroll', () => {
            requestAnimationFrame(updateHeader);
        });
    }
});

export default header;
