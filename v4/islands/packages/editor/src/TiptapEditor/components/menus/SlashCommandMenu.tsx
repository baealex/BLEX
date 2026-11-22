import React, { useEffect, useRef, useState } from 'react';
import type { Editor } from '@tiptap/react';
import * as Popover from '@radix-ui/react-popover';
import { useEditorI18n } from '../../i18n';
import type { EditorMessageKey } from '../../i18n';

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
    category: string;
    action: (editor: Editor) => void;
}

interface Form {
    id: number;
    title: string;
    created_date: string;
}

const getCsrfToken = () => {
    const tokenElement = document.querySelector('[name=csrfmiddlewaretoken]') as HTMLInputElement | null;
    if (tokenElement?.value) {
        return tokenElement.value;
    }

    const tokenCookie = document.cookie
        .split(';')
        .map(cookie => cookie.trim())
        .find(cookie => cookie.startsWith('csrftoken='));

    return tokenCookie ? decodeURIComponent(tokenCookie.split('=')[1]) : '';
};

const SlashCommandMenu = ({
    editor,
    isVisible,
    slashPos,
    onClose,
    onImageUpload,
    onVideoUpload,
    onYoutubeUpload
}: SlashCommandMenuProps) => {
    const { t } = useEditorI18n();
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [searchTerm, setSearchTerm] = useState('');
    const inputRef = useRef<HTMLInputElement>(null);
    const selectedItemRef = useRef<HTMLDivElement>(null);
    const [virtualAnchor, setVirtualAnchor] = useState<HTMLElement | null>(null);
    const [forms, setForms] = useState<Form[]>([]);
    const getKeywords = (key: EditorMessageKey) => t(key)
        .split(',')
        .map(keyword => keyword.trim())
        .filter(Boolean);

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
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCsrfToken()
                },
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
            title: t('slash.heading2.title'),
            description: t('slash.heading2.description'),
            icon: 'fa fa-heading',
            keywords: getKeywords('slash.heading2.keywords'),
            category: t('slash.category.text'),
            action: (editor) => editor.chain().focus().toggleHeading({ level: 2 }).run()
        },
        {
            id: 'heading3',
            title: t('slash.heading3.title'),
            description: t('slash.heading3.description'),
            icon: 'fa fa-heading',
            keywords: getKeywords('slash.heading3.keywords'),
            category: t('slash.category.text'),
            action: (editor) => editor.chain().focus().toggleHeading({ level: 3 }).run()
        },
        {
            id: 'heading4',
            title: t('slash.heading4.title'),
            description: t('slash.heading4.description'),
            icon: 'fa fa-heading',
            keywords: getKeywords('slash.heading4.keywords'),
            category: t('slash.category.text'),
            action: (editor) => editor.chain().focus().toggleHeading({ level: 4 }).run()
        },
        {
            id: 'bulletList',
            title: t('slash.bullet_list.title'),
            description: t('slash.bullet_list.description'),
            icon: 'fa fa-list-ul',
            keywords: getKeywords('slash.bullet_list.keywords'),
            category: t('slash.category.text'),
            action: (editor) => editor.chain().focus().toggleBulletList().run()
        },
        {
            id: 'orderedList',
            title: t('slash.ordered_list.title'),
            description: t('slash.ordered_list.description'),
            icon: 'fa fa-list-ol',
            keywords: getKeywords('slash.ordered_list.keywords'),
            category: t('slash.category.text'),
            action: (editor) => editor.chain().focus().toggleOrderedList().run()
        },
        {
            id: 'blockquote',
            title: t('slash.blockquote.title'),
            description: t('slash.blockquote.description'),
            icon: 'fa fa-quote-left',
            keywords: getKeywords('slash.blockquote.keywords'),
            category: t('slash.category.block'),
            action: (editor) => editor.chain().focus().toggleBlockquote().run()
        },
        {
            id: 'codeBlock',
            title: t('slash.code_block.title'),
            description: t('slash.code_block.description'),
            icon: 'fa fa-code',
            keywords: getKeywords('slash.code_block.keywords'),
            category: t('slash.category.block'),
            action: (editor) => editor.chain().focus().toggleCodeBlock().run()
        },
        {
            id: 'table',
            title: t('slash.table.title'),
            description: t('slash.table.description'),
            icon: 'fa fa-table',
            keywords: getKeywords('slash.table.keywords'),
            category: t('slash.category.block'),
            action: (editor) => editor.chain().focus().insertTable({
                rows: 3,
                cols: 3,
                withHeaderRow: true
            }).run()
        },
        {
            id: 'divider',
            title: t('slash.divider.title'),
            description: t('slash.divider.description'),
            icon: 'fa fa-minus',
            keywords: getKeywords('slash.divider.keywords'),
            category: t('slash.category.block'),
            action: (editor) => editor.chain().focus().setHorizontalRule().run()
        },
        {
            id: 'image',
            title: t('slash.image.title'),
            description: t('slash.image.description'),
            icon: 'fa fa-image',
            keywords: getKeywords('slash.image.keywords'),
            category: t('slash.category.media'),
            action: () => onImageUpload()
        },
        {
            id: 'video',
            title: t('slash.video.title'),
            description: t('slash.video.description'),
            icon: 'fa fa-video',
            keywords: getKeywords('slash.video.keywords'),
            category: t('slash.category.media'),
            action: () => onVideoUpload()
        },
        {
            id: 'youtube',
            title: t('slash.youtube.title'),
            description: t('slash.youtube.description'),
            icon: 'fab fa-youtube',
            keywords: getKeywords('slash.youtube.keywords'),
            category: t('slash.category.media'),
            action: () => onYoutubeUpload()
        },
        {
            id: 'columns2',
            title: t('slash.columns2.title'),
            description: t('slash.columns2.description'),
            icon: 'fa fa-columns',
            keywords: getKeywords('slash.columns2.keywords'),
            category: t('slash.category.layout'),
            action: (editor) => editor.chain().focus().setColumns('1:1').run()
        },
        {
            id: 'columns3',
            title: t('slash.columns3.title'),
            description: t('slash.columns3.description'),
            icon: 'fa fa-columns',
            keywords: getKeywords('slash.columns3.keywords'),
            category: t('slash.category.layout'),
            action: (editor) => editor.chain().focus().setColumns('1:1:1').run()
        }
    ];

    // 서식 항목 동적 생성
    const formItems: CommandItem[] = forms.map(form => ({
        id: `form-${form.id}`,
        title: form.title,
        description: t('slash.template.description'),
        icon: 'fa fa-file-alt',
        keywords: [
            ...getKeywords('slash.template.keywords'),
            form.title.toLowerCase()
        ],
        category: t('slash.category.template'),
        action: (editor) => {
            void editor;
            handleFormInsert(form.id);
        }
    }));

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
                            placeholder={t('slash.search.placeholder')}
                            className="w-full px-2 py-1 text-sm border-none outline-none"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            onKeyDown={handleKeyDown}
                        />
                    </div>

                    <div className="max-h-64 overflow-y-auto">
                        {filteredCommands.length > 0 ? (
                            filteredCommands.map((item, index) => {
                                const prevItem = filteredCommands[index - 1];
                                const showCategoryHeader = item.category !== prevItem?.category;

                                return (
                                    <React.Fragment key={item.id}>
                                        {showCategoryHeader && (
                                            <div className="px-3 pt-3 pb-1 text-xs font-medium text-gray-400">
                                                {item.category}
                                            </div>
                                        )}
                                        <div
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
                                    </React.Fragment>
                                );
                            })
                        ) : (
                            <div className="px-3 py-4 text-sm text-gray-500 text-center">
                                {t('slash.search.no_results')}
                            </div>
                        )}
                    </div>
                </Popover.Content>
            </Popover.Portal>
        </Popover.Root>
    );
};

export default SlashCommandMenu;
