import { hydrateIsland } from '../application/island.js';
import { QuickSearch } from './quick-search.js';

/** The post editor is the one page whose header sits outside the application frame. */
export function mountQuickSearch(search: HTMLElement, signal: AbortSignal): void {
    if (search.parentElement) hydrateIsland(search.parentElement, <QuickSearch />, signal);
}
