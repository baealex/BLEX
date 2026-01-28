import React, { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import * as Popover from '@radix-ui/react-popover';

interface SlashCommandMenuProps {
    editor: Editor | null;
    isVisible: boolean;
    slashPos: number | null;
    onClose: () => void;
    onImageUpload: () => void;
    onVideoUpload: () => void;
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

interface Form {
    id: number;
    title: string;
    created_date: string;
}

const SlashCommandMenu = ({
    editor,
    isVisible,
    slashPos,
    onClose,
    onImageUpload,
    onVideoUpload,
    onYoutubeUpload
}: SlashCommandMenuProps) => {
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const selectedItemRef = useRef<HTMLDivElement>(null);
    const [virtualAnchor, setVirtualAnchor] = useState<HTMLElement | null>(null);
    const [forms, setForms] = useState<Form[]>([]);

    // 서식 목록 불러오기
    useEffect(() => {
        const fetchForms = async () => {
            try {
                const response = await fetch('/v1/forms');
                if (response.ok) {
                    const data = await response.json();
                    setForms(data.body?.forms || []);
                }
            } catch {
                // Ignore error
            }
        };

        if (isVisible) {
            fetchForms();
        }
    }, [isVisible]);

    // 서식 삽입 처리
    const handleFormInsert = async (formId: number) => {
        if (!editor) return;

        try {
            // 서식 내용 가져오기
            const response = await fetch(`/v1/forms/${formId}`);
            if (!response.ok) return;

            const data = await response.json();
            const markdown = data.body?.content || '';

            if (!markdown.trim()) {
                return;
            }

            // 마크다운을 HTML로 변환
            const htmlResponse = await fetch('/v1/markdown', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ text: markdown })
            });

            if (!htmlResponse.ok) {
                // 변환 실패 시 원본 마크다운 삽입
                editor.chain().focus().insertContent(markdown).run();
                return;
            }

            const htmlData = await htmlResponse.json();
            const html = htmlData.body?.html || '';

            // 에디터에 HTML 삽입
            editor.chain().focus().insertContent(html).run();
        } catch {
            // Error handling
        }
    };

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
            keywords: ['image', '이미지', 'img', '사진'],
            action: () => onImageUpload()
        },
        {
            id: 'video',
            title: '비디오',
            description: 'MP4/WebM 비디오 업로드',
            icon: 'fa fa-video',
            keywords: ['video', '비디오', '동영상', 'mp4', 'webm', '영상'],
            action: () => onVideoUpload()
        },
        {
            id: 'youtube',
            title: 'YouTube',
            description: 'YouTube 동영상 삽입',
            icon: 'fab fa-youtube',
            keywords: ['youtube', '유튜브'],
            action: () => onYoutubeUpload()
        },
        {
            id: 'divider',
            title: '구분선',
            description: '수평선 삽입',
            icon: 'fa fa-minus',
            keywords: ['divider', '구분선', 'hr', '수평선'],
            action: (editor) => editor.chain().focus().setHorizontalRule().run()
        },
        {
            id: 'columns2',
            title: '2단 레이아웃',
            description: '2개의 컬럼으로 나누기',
            icon: 'fa fa-columns',
            keywords: ['columns', '컬럼', '2단', '레이아웃', 'layout'],
            action: (editor) => editor.chain().focus().setColumns('1:1').run()
        },
        {
            id: 'columns3',
            title: '3단 레이아웃',
            description: '3개의 컬럼으로 나누기',
            icon: 'fa fa-columns',
            keywords: ['columns', '컬럼', '3단', '레이아웃', 'layout'],
            action: (editor) => editor.chain().focus().setColumns('1:1:1').run()
        }
    ];

    // 서식 항목 동적 생성
    const formItems: CommandItem[] = forms.map(form => ({
        id: `form-${form.id}`,
        title: form.title,
        description: '서식',
        icon: 'fa fa-file-alt',
        keywords: ['서식', 'form', 'template', form.title.toLowerCase()],
        action: (editor) => {
            void editor;
            handleFormInsert(form.id);
        }
    }));

    // 모든 명령어 합치기
    const allCommandItems = [...commandItems, ...formItems];

    const filteredCommands = allCommandItems.filter(item => {
        if (!searchTerm) return true;
        const term = searchTerm.toLowerCase();
        return item.title.toLowerCase().includes(term) ||
            item.description.toLowerCase().includes(term) ||
            item.keywords.some(keyword => keyword.toLowerCase().includes(term));
    });

    const handleKeyDown = (e: React.KeyboardEvent) => {
        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                setSelectedIndex(prev => {
                    const newIndex = Math.min(prev + 1, filteredCommands.length - 1);
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
                    onClose();
                    filteredCommands[selectedIndex].action(editor);
                }
                break;
            case 'Escape':
                e.preventDefault();
                onClose();
                break;
        }
    };

    const handleCommandClick = (item: CommandItem) => {
        if (editor) {
            if (onClose) {
                onClose();
            }
            item.action(editor);
        }
    };

    useEffect(() => {
        if (isVisible && slashPos !== null && editor) {
            setSelectedIndex(0);
            setSearchTerm('');
            setTimeout(() => inputRef.current?.focus(), 10);

            // 가상 앵커 요소 생성 (매번 최신 좌표를 계산하도록)
            const anchor = {
                getBoundingClientRect: () => {
                    // getBoundingClientRect가 호출될 때마다 최신 좌표 계산
                    try {
                        const coords = editor.view.coordsAtPos(slashPos + 1);
                        return {
                            top: coords.top + 25,
                            left: coords.left,
                            right: coords.left,
                            bottom: coords.top + 25,
                            width: 0,
                            height: 0,
                            x: coords.left,
                            y: coords.top + 25,
                            toJSON: () => ({})
                        };
                    } catch {
                        // 위치 계산 실패 시 기본값 반환
                        return {
                            top: 0,
                            left: 0,
                            right: 0,
                            bottom: 0,
                            width: 0,
                            height: 0,
                            x: 0,
                            y: 0,
                            toJSON: () => ({})
                        };
                    }
                }
            } as unknown as HTMLElement;
            setVirtualAnchor(anchor);
        } else {
            setVirtualAnchor(null);
        }
    }, [isVisible, slashPos, editor]);

    useEffect(() => {
        setSelectedIndex(0);
    }, [searchTerm]);

    if (!isVisible || !editor || !virtualAnchor) return null;

    return (
        <Popover.Root open={isVisible} onOpenChange={(open) => !open && onClose()}>
            <Popover.Anchor virtualRef={{ current: virtualAnchor }} />
            <Popover.Portal>
                <Popover.Content
                    className="bg-white border border-gray-200 rounded-lg shadow-lg min-w-64 max-w-80 z-50 outline-none"
                    onOpenAutoFocus={(e) => e.preventDefault()}
                    onCloseAutoFocus={(e) => e.preventDefault()}
                    align="start"
                    side="bottom"
                    sideOffset={5}>
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
                                <div
                                    key={item.id}
                                    ref={index === selectedIndex ? selectedItemRef : null}
                                    className={`w-full px-3 py-2 text-left hover:bg-gray-50 flex items-center gap-3 cursor-pointer ${index === selectedIndex ? 'bg-gray-50' : ''
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
                                </div>
                            ))
                        ) : (
                            <div className="px-3 py-4 text-sm text-gray-500 text-center">
                                검색 결과가 없습니다
                            </div>
                        )}
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
};

export default SlashCommandMenu;
