import { useState, useRef } from 'react';
import { Hash, Plus, X } from '@blex/ui/icons';
import { Button } from '~/components/shared';

interface TagManagerProps {
    tags: string[];
    onTagsChange: (tags: string[]) => void;
}

const TagManager = ({ tags, onTagsChange }: TagManagerProps) => {
    const [newTag, setNewTag] = useState('');
    const [isAdding, setIsAdding] = useState(false);
    const inputRef = useRef<HTMLInputElement>(null);

    const handleAddTag = () => {
        const processedTag = newTag.trim()
            .toLowerCase()
            .replace(/[^a-z0-9가-힣\s]/g, '')
            .replace(/\s+/g, '-');

        if (processedTag && !tags.includes(processedTag)) {
            onTagsChange([...tags, processedTag]);
            setNewTag('');
            inputRef.current?.focus();
        }
    };

    const handleRemoveTag = (index: number) => {
        onTagsChange(tags.filter((_, i) => i !== index));
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        if (e.key === 'Enter') {
            e.preventDefault();
            handleAddTag();
        } else if (e.key === 'Escape') {
            setNewTag('');
            setIsAdding(false);
        } else if (e.key === 'Backspace' && !newTag && tags.length > 0) {
            // Remove last tag on backspace if input is empty
            onTagsChange(tags.slice(0, -1));
        }
    };

    return (
        <div className="flex flex-wrap items-center gap-2">
            {/* Tags display */}
            {tags.map((tag, index) => (
                <span
                    key={tag}
                    className="group inline-flex min-h-11 items-center rounded-full border border-line-light bg-surface-subtle pl-4 pr-1 text-sm font-medium text-content-secondary transition-all duration-300 hover:border-line-strong hover:bg-action hover:text-content-inverted">
                    <span className="mr-1 opacity-50">#</span>
                    <span className="break-all">{tag}</span>
                    <button
                        type="button"
                        onClick={() => handleRemoveTag(index)}
                        className="ml-1 inline-flex min-h-11 min-w-11 items-center justify-center rounded-full text-content-hint transition-colors group-hover:text-content-inverted/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-1"
                        aria-label={`${tag} 태그 제거`}>
                        <X aria-hidden className="h-3.5 w-3.5" />
                    </button>
                </span>
            ))}

            {/* Inline tag input */}
            {isAdding ? (
                <div className="inline-flex min-h-11 items-center gap-1.5 rounded-full border border-line bg-surface-subtle px-3 py-1.5">
                    <Hash aria-hidden className="h-3.5 w-3.5 text-content-hint" />
                    <input
                        ref={inputRef}
                        type="text"
                        aria-label="새 태그 이름"
                        value={newTag}
                        onChange={(e) => setNewTag(e.target.value)}
                        onKeyDown={handleKeyDown}
                        onBlur={() => {
                            if (!newTag.trim()) {
                                setIsAdding(false);
                            }
                        }}
                        className="border-0 bg-transparent focus:ring-0 p-0 text-sm font-medium text-content placeholder-content-hint w-24"
                        placeholder="태그명"
                        autoFocus
                    />
                </div>
            ) : (
                <Button
                    type="button"
                    onClick={() => {
                        setIsAdding(true);
                        setTimeout(() => inputRef.current?.focus(), 100);
                    }}
                    variant="ghost"
                    size="sm"
                    leftIcon={<Plus aria-hidden className="h-4 w-4" />}
                    className="min-h-11! rounded-full">
                    태그 추가
                </Button>
            )}
        </div>
    );
};

export default TagManager;
