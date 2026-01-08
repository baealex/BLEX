import { useEffect, useRef, useState } from 'react';
import { Popover } from '@blex/ui';

interface MentionAutocompleteProps {
    users: string[];
    open: boolean;
    onSelect: (username: string) => void;
    onClose: () => void;
    anchorEl: HTMLElement | null;
    selectedIndex: number;
    onSelectedIndexChange: (index: number) => void;
}

export const MentionAutocomplete = ({
    users,
    open,
    onSelect,
    onClose,
    anchorEl,
    selectedIndex,
    onSelectedIndexChange
}: MentionAutocompleteProps) => {
    const contentRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        // 선택된 항목이 보이도록 스크롤
        if (contentRef.current && selectedIndex >= 0) {
            const selectedItem = contentRef.current.querySelector(`[data-index="${selectedIndex}"]`);
            if (selectedItem) {
                selectedItem.scrollIntoView({ block: 'nearest' });
            }
        }
    }, [selectedIndex]);

    useEffect(() => {
        // 외부 클릭 감지
        const handleClickOutside = (event: MouseEvent) => {
            if (contentRef.current && !contentRef.current.contains(event.target as Node)) {
                onClose();
            }
        };

        if (open) {
            document.addEventListener('mousedown', handleClickOutside);
            return () => document.removeEventListener('mousedown', handleClickOutside);
        }
    }, [open, onClose]);

    if (!open || users.length === 0 || !anchorEl) {
        return null;
    }

    return (
        <Popover.Root open={open} modal={false}>
            <Popover.Anchor asChild>
                <div style={{ position: 'absolute', pointerEvents: 'none' }} />
            </Popover.Anchor>
            <Popover.Portal>
                <Popover.Content
                    ref={contentRef}
                    sideOffset={4}
                    align="start"
                    className="z-50 w-60 bg-white border border-gray-200 rounded-lg shadow-lg overflow-hidden"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onCloseAutoFocus={(e) => e.preventDefault()}>
                    <div className="overflow-y-auto max-h-[200px]">
                        {users.map((user, index) => (
                            <button
                                key={user}
                                data-index={index}
                                type="button"
                                onClick={() => onSelect(user)}
                                onMouseEnter={() => onSelectedIndexChange(index)}
                                className={`w-full px-4 py-2 text-left text-sm transition-colors ${
                                    index === selectedIndex
                                        ? 'bg-blue-50 text-blue-700'
                                        : 'text-gray-700 hover:bg-gray-50'
                                }`}>
                                <span className="font-medium">@{user}</span>
                            </button>
                        ))}
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
};
