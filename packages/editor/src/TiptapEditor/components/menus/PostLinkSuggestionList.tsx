import { useEffect, useImperativeHandle, useRef, useState } from 'react';
import type { Ref } from 'react';
import type { SuggestionKeyDownProps } from '@tiptap/suggestion';
import { useEditorI18n } from '../../i18n';
import type { PostLinkCandidate } from '../../config/postLink';

export interface PostLinkSuggestionListHandle {
    onKeyDown: (props: SuggestionKeyDownProps) => boolean;
}

export interface PostLinkSuggestionListProps {
    ref?: Ref<PostLinkSuggestionListHandle>;
    items: PostLinkCandidate[];
    loading: boolean;
    failed: boolean;
    command: (item: PostLinkCandidate) => void;
}

const isSelectKey = (event: KeyboardEvent) => event.key === 'Enter' || event.key === 'Tab';

const PostLinkSuggestionList = ({
    ref,
    items,
    loading,
    failed,
    command
}: PostLinkSuggestionListProps) => {
    const { t } = useEditorI18n();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const optionRefs = useRef<(HTMLDivElement | null)[]>([]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [items]);

    useEffect(() => {
        optionRefs.current[selectedIndex]?.scrollIntoView({ block: 'nearest' });
    }, [selectedIndex]);

    const selectItem = (index: number) => {
        const item = items[index];
        if (item) {
            command(item);
        }
    };

    useImperativeHandle(ref, () => ({
        onKeyDown: ({ event }) => {
            if (event.isComposing) {
                return false;
            }

            // Results for the latest query are still on the way; selecting now could pick a stale post.
            if (loading && isSelectKey(event)) {
                return true;
            }

            if (items.length === 0) {
                return false;
            }

            if (event.key === 'ArrowDown') {
                setSelectedIndex(index => (index + 1) % items.length);
                return true;
            }

            if (event.key === 'ArrowUp') {
                setSelectedIndex(index => (index + items.length - 1) % items.length);
                return true;
            }

            if (isSelectKey(event)) {
                selectItem(selectedIndex);
                return true;
            }

            return false;
        }
    }));

    const statusMessage = (() => {
        if (failed) return t('postLink.error');
        if (items.length > 0) return null;
        return loading ? t('postLink.loading') : t('postLink.empty');
    })();

    return (
        <div className="w-80 max-w-[calc(100vw-2rem)] floating-glass-surface rounded-xl p-1.5">
            {items.length > 0 && (
                <div
                    role="listbox"
                    aria-label={t('postLink.label')}
                    aria-busy={loading}
                    className="max-h-72 overflow-y-auto">
                    {items.map((item, index) => {
                        const isSelected = index === selectedIndex;

                        return (
                            <div
                                key={item.href}
                                ref={(element) => {
                                    optionRefs.current[index] = element;
                                }}
                                role="option"
                                aria-selected={isSelected}
                                className={`flex flex-col gap-0.5 rounded-lg px-3 py-3 sm:py-2 cursor-pointer transition-colors duration-150 ${isSelected ? 'bg-surface-subtle' : ''}`}
                                onMouseDown={(event) => event.preventDefault()}
                                onMouseEnter={() => setSelectedIndex(index)}
                                onClick={() => selectItem(index)}>
                                <span className="truncate text-sm font-medium text-content">
                                    {item.title}
                                </span>
                                {item.meta && (
                                    <span className="text-xs text-content-hint">
                                        {item.meta}
                                    </span>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
            {statusMessage && (
                <div role="status" className="px-3 py-3 text-sm text-content-secondary">
                    {statusMessage}
                </div>
            )}
        </div>
    );
};

export default PostLinkSuggestionList;
