import { useState, useRef } from 'react';
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
                    className="inline-flex items-center px-4 py-2 bg-surface-subtle hover:bg-action hover:text-content-inverted text-content-secondary rounded-full text-sm font-medium transition-all duration-300 border border-line-light hover:border-line-strong group">
                    <span className="mr-1 opacity-50">#</span>
                    <span className="break-all">{tag}</span>
                    <button
                        type="button"
                        onClick={() => handleRemoveTag(index)}
                        className="ml-2 w-4 h-4 text-content-hint group-hover:text-content-inverted/80 transition-colors flex items-center justify-center"
                        aria-label={`${tag} 태그 제거`}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </span>
            ))}

            {/* Inline tag input */}
            {isAdding ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-surface-subtle border border-line rounded-full">
                    <i className="fas fa-hashtag text-xs text-content-hint" />
                    <input
                        ref={inputRef}
                        type="text"
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
                    className="rounded-full">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>태그 추가</span>
                </Button>
            )}
        </div>
    );
};

export default TagManager;
