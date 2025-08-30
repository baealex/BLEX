import React, { useState } from 'react';

interface TagManagerProps {
    tags: string[];
    onTagsChange: (tags: string[]) => void;
}

const TagManager: React.FC<TagManagerProps> = ({ tags, onTagsChange }) => {
    const [newTag, setNewTag] = useState('');

    const handleAddTag = () => {
        const tag = newTag.trim();
        if (tag && !tags.includes(tag)) {
            onTagsChange([...tags, tag]);
            setNewTag('');
        }
    };

    const handleRemoveTag = (index: number) => {
        onTagsChange(tags.filter((_, i) => i !== index));
    };

    return (
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-4 sm:p-6">
            <label className="block text-sm font-semibold text-slate-700 mb-4">태그</label>

            <div className="space-y-4">
                <div className="flex gap-2">
                    <input
                        type="text"
                        value={newTag}
                        onChange={(e) => {
                            const value = e.target.value
                                .toLowerCase()
                                .replace(/[^a-z0-9가-힣\s]/g, '')
                                .replace(/\s+/g, '-');
                            setNewTag(value);
                        }}
                        onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                                e.preventDefault();
                                handleAddTag();
                            }
                        }}
                        className="flex-1 w-full px-3 py-2 border border-solid border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent text-sm sm:text-base"
                        placeholder="태그 입력..."
                    />
                    <button
                        type="button"
                        onClick={handleAddTag}
                        disabled={!newTag.trim()}
                        className="px-3 sm:px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:bg-slate-400 disabled:cursor-not-allowed text-sm sm:text-base">
                        추가
                    </button>
                </div>

                {tags.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                        {tags.map((tag, index) => (
                            <span key={tag} className="inline-flex items-center gap-2 px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm">
                                <span>{tag}</span>
                                <button
                                    type="button"
                                    onClick={() => handleRemoveTag(index)}
                                    className="w-4 h-4 hover:bg-blue-200 rounded-full flex items-center justify-center">
                                    <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                                    </svg>
                                </button>
                            </span>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default TagManager;