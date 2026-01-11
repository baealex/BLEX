import type Alpine from 'alpinejs';

interface ToCState {
    activeId: string;
}

interface ToCActions {
    scrollTo(id: string): void;
}

const toc = (): Alpine.AlpineComponent<ToCState & ToCActions> => ({
    activeId: '',

    init() {
        // Setup Intersection Observer to track active section
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    this.activeId = entry.target.id;
                }
            });
        }, {
            // Adjust rootMargin to trigger when the header is roughly in the top part of the viewport
            rootMargin: '-10% 0px -80% 0px',
            threshold: 0
        });

        // Observe all headers that have IDs
        document.querySelectorAll('article h1, article h2, article h3, article h4, article h5, article h6').forEach(header => {
            if (header.id) {
                observer.observe(header);
            }
        });
    },

    scrollTo(id: string) {
        const element = document.getElementById(id);
        if (element) {
            // Offset for fixed header (approx 80px)
            const offset = 80;
            const elementPosition = element.getBoundingClientRect().top + window.pageYOffset;

            window.scrollTo({
                top: elementPosition - offset,
                behavior: 'smooth'
            });

            this.activeId = id;
            history.replaceState(null, '', `#${id}`);
        }
    }
});

export default toc;
