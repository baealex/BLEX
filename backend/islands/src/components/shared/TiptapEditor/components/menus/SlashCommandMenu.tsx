import React, { useEffect, useRef, useState, useCallback } from 'react';
import type { Editor } from '@tiptap/react';

interface SlashCommandMenuProps {
    editor: Editor | null;
    isVisible: boolean;
    position: { top: number; left: number };
    onClose: () => void;
    onImageUpload: () => void;
    onYoutubeUpload: () => void;
}

interface CommandItem {
    id: string;
    title: string;
    description: string;
    icon: string;
    keywords: string[];
    action: (editor: Editor) => void;
}

const SlashCommandMenu = ({
    editor,
    isVisible,
    position,
    onClose,
    onImageUpload,
    onYoutubeUpload
}: SlashCommandMenuProps) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const menuRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);
    const selectedItemRef = useRef<HTMLButtonElement>(null);

    const commandItems: CommandItem[] = [
        {
            id: 'heading2',
            title: '대제목',
            description: 'H2 헤딩',
            icon: 'fa fa-heading',
            keywords: ['heading', '헤딩', '제목', 'h2'],
            action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run()
        },
        {
            id: 'heading3',
            title: '중간제목',
            description: 'H3 헤딩',
            icon: 'fa fa-heading',
            keywords: ['heading', '헤딩', '제목', 'h3'],
            action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run()
        },
        {
            id: 'heading4',
            title: '소제목',
            description: 'H4 헤딩',
            icon: 'fa fa-heading',
            keywords: ['heading', '헤딩', '제목', 'h4'],
            action: (editor) => editor.chain().focus().toggleHeading({ level: 4 }).run()
        },
        {
            id: 'bulletList',
            title: '순서없는 목록',
            description: '글머리 기호 목록',
            icon: 'fa fa-list-ul',
            keywords: ['list', '목록', 'bullet', '글머리'],
            action: (editor) => editor.chain().focus().toggleBulletList().run()
        },
        {
            id: 'orderedList',
            title: '순서있는 목록',
            description: '번호가 있는 목록',
            icon: 'fa fa-list-ol',
            keywords: ['list', '목록', 'numbered', '번호'],
            action: (editor) => editor.chain().focus().toggleOrderedList().run()
        },
        {
            id: 'codeBlock',
            title: '코드 블록',
            description: '구문 강조 코드 블록',
            icon: 'fa fa-code',
            keywords: ['code', '코드', 'block'],
            action: (editor) => editor.chain().focus().toggleCodeBlock().run()
        },
        {
            id: 'blockquote',
            title: '인용구',
            description: '인용문 블록',
            icon: 'fa fa-quote-left',
            keywords: ['quote', '인용', 'blockquote'],
            action: (editor) => editor.chain().focus().toggleBlockquote().run()
        },
        {
            id: 'table',
            title: '표',
            description: '3x3 표 삽입',
            icon: 'fa fa-table',
            keywords: ['table', '표', '테이블'],
            action: (editor) => editor.chain().focus().insertTable({
                rows: 3,
                cols: 3,
                withHeaderRow: true
            }).run()
        },
        {
            id: 'image',
            title: '이미지',
            description: '이미지 업로드',
            icon: 'fa fa-image',
            keywords: ['image', '이미지', 'img'],
            action: () => onImageUpload()
        },
        {
            id: 'youtube',
            title: 'YouTube',
            description: 'YouTube 동영상 삽입',
            icon: 'fab fa-youtube',
            keywords: ['youtube', '유튜브', '동영상', 'video'],
            action: () => onYoutubeUpload()
        },
        {
            id: 'divider',
            title: '구분선',
            description: '수평선 삽입',
            icon: 'fa fa-minus',
            keywords: ['divider', '구분선', 'hr', '수평선'],
            action: (editor) => editor.chain().focus().setHorizontalRule().run()
        }
    ];

    const filteredCommands = commandItems.filter(item => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return item.title.toLowerCase().includes(term) ||
            item.description.toLowerCase().includes(term) ||
            item.keywords.some(keyword => keyword.toLowerCase().includes(term));
    });

    const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => {
                    const newIndex = Math.min(prev + 1, filteredCommands.length - 1);
                    // 선택된 항목으로 스크롤
                    setTimeout(() => {
                        selectedItemRef.current?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'nearest'
                        });
                    }, 0);
                    return newIndex;
                });
                break;
            case 'ArrowUp':
                e.preventDefault();
                setSelectedIndex(prev => {
                    const newIndex = Math.max(prev - 1, 0);
                    // 선택된 항목으로 스크롤
                    setTimeout(() => {
                        selectedItemRef.current?.scrollIntoView({
                            behavior: 'smooth',
                            block: 'nearest'
                        });
                    }, 0);
                    return newIndex;
                });
                break;
            case 'Enter':
                e.preventDefault();
                if (filteredCommands[selectedIndex] && editor) {
                    // "/" 문자 제거 후 명령 실행
                    onClose();
                    filteredCommands[selectedIndex].action(editor);
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    }, [selectedIndex, filteredCommands, editor, onClose]);

    const handleCommandClick = (item: CommandItem) => {
        if (editor) {
            // "/" 문자 제거 후 명령 실행
            if (onClose) {
                // onClose에서 슬래시 문자 제거 처리
                onClose();
            }
            item.action(editor);
        }
    };

    useEffect(() => {
        if (isVisible) {
            setSelectedIndex(0);
            setSearchTerm('');
            setTimeout(() => inputRef.current?.focus(), 10);
        }
    }, [isVisible]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [searchTerm]);

    if (!isVisible || !editor) return null;

    return (
        <div
            ref={menuRef}
            className="fixed z-50 bg-white border border-gray-200 rounded-lg shadow-lg min-w-64 max-w-80"
            style={{
                top: `${position.top}px`,
                left: `${position.left}px`
            }}>
            <div className="p-2 border-b border-gray-100">
                <input
                    ref={inputRef}
                    type="text"
                    placeholder="명령어 검색..."
                    className="w-full px-2 py-1 text-sm border-none outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    onKeyDown={handleKeyDown}
                />
            </div>

            <div className="max-h-64 overflow-y-auto">
                {filteredCommands.length > 0 ? (
                    filteredCommands.map((item, index) => (
                        <button
                            key={item.id}
                            ref={index === selectedIndex ? selectedItemRef : null}
                            className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-3 ${index === selectedIndex ? 'bg-gray-50' : ''
                                }`}
                            onClick={() => handleCommandClick(item)}>
                            <div className="w-8 h-8 flex items-center justify-center bg-gray-100 rounded">
                                <i className={`${item.icon} text-sm text-gray-600`} />
                            </div>
                            <div>
                                <div className="text-sm font-medium text-gray-900">
                                    {item.title}
                                </div>
                                <div className="text-xs text-gray-500">
                                    {item.description}
                                </div>
                            </div>
                        </button>
                    ))
                ) : (
                    <div className="px-3 py-4 text-sm text-gray-500 text-center">
                        검색 결과가 없습니다
                    </div>
                )}
            </div>
        </div>
    );
};

export default SlashCommandMenu;
