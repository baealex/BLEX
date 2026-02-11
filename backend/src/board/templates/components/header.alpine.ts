import type Alpine from 'alpinejs';

interface State {
    isTop: boolean;
    mobileMenuOpen: boolean;
}

interface Actions {
    init(): void;
    toggleMobileMenu(): void;
    closeMobileMenu(): void;
}

const header = (): Alpine.AlpineComponent<State & Actions> => ({
    isTop: true,
    mobileMenuOpen: false,

    init() {
        this.isTop = window.scrollY < 10;

        const updateHeader = () => {
            this.isTop = window.scrollY < 10;
        };

        window.addEventListener('scroll', () => {
            requestAnimationFrame(updateHeader);
        });
    },

    toggleMobileMenu() {
        this.mobileMenuOpen = !this.mobileMenuOpen;
        document.body.style.overflow = this.mobileMenuOpen ? 'hidden' : '';
    },

    closeMobileMenu() {
        this.mobileMenuOpen = false;
        document.body.style.overflow = '';
    }
});

export default header;
