import type Alpine from 'alpinejs';

interface Heading {
    id: string;
    text: string;
    level: number;
}

interface State {
    headings: Heading[];
    activeId: string;
    minLevel: number;
}

interface Actions {
    init(): void;
    scrollToHeading(id: string): void;
    updateActiveHeading(): void;
}

const toc = (): Alpine.AlpineComponent<State & Actions> => ({
    headings: [],
    activeId: '',
    minLevel: 1,

    init() {
        // Collect headings available in the DOM for scroll spying
        // The ToC items are rendered by Django, so we look for data-id attributes
        const tocItems = this.$el.querySelectorAll('.toc-item');
        this.headings = Array.from(tocItems).map(item => ({
            id: item.getAttribute('data-id') || '',
            text: '', // Not needed for logic
            level: 0  // Not needed for logic
        })).filter(h => h.id);

        // Set up scroll spy to track active heading
        this.updateActiveHeading();
        window.addEventListener('scroll', () => {
            requestAnimationFrame(() => this.updateActiveHeading());
        });

        // Update on resize
        window.addEventListener('resize', () => {
            requestAnimationFrame(() => this.updateActiveHeading());
        });
    },

    scrollToHeading(id: string) {
        const element = document.getElementById(id);
        if (!element) return;

        // Smooth scroll to the heading with offset for fixed header
        const headerOffset = 100;
        const elementPosition = element.getBoundingClientRect().top;
        const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

        window.scrollTo({
            top: offsetPosition,
            behavior: 'smooth'
        });

        this.activeId = id;
        history.replaceState(null, '', `#${id}`);
    },

    updateActiveHeading() {
        // Offset to consider header height + comfortable reading space
        const headerOffset = 100;
        const scrollPosition = window.scrollY + headerOffset + 50;

        let currentActiveId = '';

        // Iterate through headings to find the active one
        // We look for the section that is closest to the top but not passed yet
        for (let i = 0; i < this.headings.length; i++) {
            const heading = this.headings[i];
            const element = document.getElementById(heading.id);

            if (element) {
                const elementTop = element.offsetTop;

                // Check if current scroll position is within this section
                if (scrollPosition >= elementTop) {
                    currentActiveId = heading.id;
                    // Keep looking to find the *last* one that matches (deepest nested)
                } else {
                    // If we haven't reached this element yet, we can stop checking subsequent ones
                    // (assuming headings are in order)
                    break;
                }
            }
        }

        if (currentActiveId && currentActiveId !== this.activeId) {
            this.activeId = currentActiveId;

            // Sync Sidebar Scroll
            // Center the active item in the sidebar
            this.$nextTick(() => {
                const activeItem = this.$el.querySelector(`.toc-item[data-id="${currentActiveId}"]`);
                const container = this.$el;

                if (activeItem && container) {
                    const containerRect = container.getBoundingClientRect();
                    const itemRect = activeItem.getBoundingClientRect();

                    // Calculate relative position within the container
                    const relativeTop = itemRect.top - containerRect.top;
                    const currentScrollTop = container.scrollTop;

                    // Calculate target scroll position to center the item
                    // Target = Current Scroll + Relative Position - (Container Height / 2) + (Item Height / 2)
                    const targetScrollTop = currentScrollTop + relativeTop - (containerRect.height / 2) + (itemRect.height / 2);

                    // Prevent micro-scrolling (jitter)
                    if (Math.abs(container.scrollTop - targetScrollTop) > 10) {
                        container.scrollTo({
                            top: targetScrollTop,
                            behavior: 'smooth'
                        });
                    }
                }
            });
        }

        if (window.scrollY < 100 && this.activeId) {
            this.activeId = '';
        }
    }
});

export default toc;
