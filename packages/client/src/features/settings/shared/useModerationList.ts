import { useCallback, useEffect, useRef } from 'react';
import { useNavigate, useRouterState } from '@tanstack/react-router';
import type { ManagedUsersPagination } from '~/lib/api/settings';

type SearchChanges = Record<string, string | number | undefined>;

/** Keeps a moderation list's search, filter, and page in the URL so it survives reloads and back navigation. */
export const useModerationSearch = () => {
    const navigate = useNavigate();
    const search = useRouterState({ select: state => state.location.search as Record<string, unknown> });
    const requestedPage = Number(search.page);
    const updateSearch = useCallback((changes: SearchChanges, replace = false) => {
        void navigate({
            to: '.',
            replace,
            search: (current: Record<string, unknown>) => ({
                ...current,
                ...changes
            })
        } as never);
    }, [navigate]);

    return {
        page: Number.isSafeInteger(requestedPage) && requestedPage > 0 ? requestedPage : 1,
        query: search.q === undefined ? '' : String(search.q),
        status: search.status === undefined ? '' : String(search.status),
        updateSearch
    };
};

/** Follows the page the server actually returned, and returns to the top of the list after a page change. */
export const useModerationPaging = (
    page: number,
    updateSearch: (changes: SearchChanges, replace?: boolean) => void,
    pagination: ManagedUsersPagination | undefined,
    isSettled: boolean
) => {
    const listRef = useRef<HTMLDivElement>(null);
    const isScrollPendingRef = useRef(false);

    useEffect(() => {
        if (!isSettled || !pagination) return;
        if (pagination.page !== page) {
            updateSearch({ page: pagination.page > 1 ? pagination.page : undefined }, true);
            return;
        }
        if (isScrollPendingRef.current) {
            isScrollPendingRef.current = false;
            listRef.current?.scrollIntoView({ block: 'start' });
        }
    }, [isSettled, page, pagination, updateSearch]);

    const goToPage = (nextPage: number) => {
        if (nextPage === page) return;
        isScrollPendingRef.current = true;
        updateSearch({ page: nextPage > 1 ? nextPage : undefined });
    };

    return {
        listRef,
        goToPage
    };
};
