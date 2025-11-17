import React, { useState, useRef } from 'react';

interface TagManagerProps {
    tags: string[];
    onTagsChange: (tags: string[]) => void;
}

const TagManager: React.FC<TagManagerProps> = ({ tags, onTagsChange }) => {
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
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-full text-sm font-medium transition-all duration-200 group">
                    <i className="fas fa-hashtag text-xs text-gray-400" />
                    <span className="break-all">{tag}</span>
                    <button
                        type="button"
                        onClick={() => handleRemoveTag(index)}
                        className="ml-1 w-4 h-4 text-gray-400 hover:text-gray-600 transition-colors flex items-center justify-center"
                        aria-label={`${tag} 태그 제거`}>
                        <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                        </svg>
                    </button>
                </span>
            ))}

            {/* Inline tag input */}
            {isAdding ? (
                <div className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-gray-50 border border-gray-200 rounded-full">
                    <i className="fas fa-hashtag text-xs text-gray-400" />
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
                        className="border-0 bg-transparent focus:ring-0 p-0 text-sm font-medium text-gray-700 placeholder-gray-400 w-24"
                        placeholder="태그명"
                        autoFocus
                    />
                </div>
            ) : (
                <button
                    type="button"
                    onClick={() => {
                        setIsAdding(true);
                        setTimeout(() => inputRef.current?.focus(), 100);
                    }}
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-500 hover:text-gray-700 hover:bg-gray-100 rounded-full transition-colors">
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 4v16m8-8H4" />
                    </svg>
                    <span>태그 추가</span>
                </button>
            )}
        </div>
    );
};

export default TagManager;
