
import type Alpine from 'alpinejs';

interface DropdownFilterState {
    open: boolean;
    updateQueryParams(param: string, value: string): void;
    init(): void;
}

const dropdown_filter = (): Alpine.AlpineComponent<DropdownFilterState> => ({
    open: false,

    init() {
        // Init logic if needed
    },

    updateQueryParams(param: string, value: string) {
        const url = new URL(window.location.href);
        if (value === '') {
            url.searchParams.delete(param);
        } else {
            url.searchParams.set(param, value);
        }
        window.location.href = url.toString();
    }
});

export default dropdown_filter;
