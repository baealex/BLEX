/** Smooth scrolling, unless the reader has asked their system for less motion. */
export function scrollBehavior(): ScrollBehavior {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
        ? 'auto'
        : 'smooth';
}
