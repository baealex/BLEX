import React, { useState, useRef, useEffect, useMemo } from 'react';
import { createPortal } from 'react-dom';
import type { Editor } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { SUPPORTED_LANGUAGES, getLanguageLabel } from '../../../../utils/languages';

interface CodeBlockLanguageSelectorProps {
    editor: Editor;
    node: NodeViewProps['node'];
    updateAttributes: (attributes: Record<string, unknown>) => void;
}

const CodeBlockLanguageSelector: React.FC<CodeBlockLanguageSelectorProps> = ({
    node,
    updateAttributes
}) => {
    const [isOpen, setIsOpen] = useState(false);
    const [searchQuery, setSearchQuery] = useState('');
    const [dropdownPosition, setDropdownPosition] = useState({ top: 0, left: 0 });
    const buttonRef = useRef<HTMLButtonElement>(null);
    const searchInputRef = useRef<HTMLInputElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);
    const currentLanguage = node.attrs.language || 'plaintext';

    // 버튼 위치에 따라 드롭다운 위치 계산
    useEffect(() => {
        if (isOpen && buttonRef.current) {
            const rect = buttonRef.current.getBoundingClientRect();
            setDropdownPosition({
                top: rect.bottom,
                left: rect.left
            });
        }
    }, [isOpen]);

    // 드롭다운이 열릴 때 검색 input에 포커스
    useEffect(() => {
        if (isOpen && searchInputRef.current) {
            searchInputRef.current.focus();
        }
    }, [isOpen]);

    // 드롭다운이 열릴 때 검색어 초기화
    useEffect(() => {
        if (!isOpen) {
            setSearchQuery('');
        }
    }, [isOpen]);

    // 외부 클릭 감지
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (
                dropdownRef.current &&
                !dropdownRef.current.contains(event.target as Node) &&
                buttonRef.current &&
                !buttonRef.current.contains(event.target as Node)
            ) {
                setIsOpen(false);
            }
        };

        if (isOpen) {
            document.addEventListener('mousedown', handleClickOutside);
        }

        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, [isOpen]);

    const handleLanguageChange = (language: string) => {
        updateAttributes({ language });
        setIsOpen(false);
        setSearchQuery('');
    };

    const getCurrentLanguageLabel = () => {
        return getLanguageLabel(currentLanguage);
    };

    // 검색어로 언어 목록 필터링
    const filteredLanguages = useMemo(() => {
        if (!searchQuery.trim()) {
            return SUPPORTED_LANGUAGES;
        }

        const query = searchQuery.toLowerCase();
        return SUPPORTED_LANGUAGES.filter((language) =>
            language.label.toLowerCase().includes(query) ||
            language.value.toLowerCase().includes(query)
        );
    }, [searchQuery]);

    return (
        <>
            <button
                ref={buttonRef}
                type="button"
                onClick={() => setIsOpen(!isOpen)}
                className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
                {getCurrentLanguageLabel()}
                <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
            </button>

            {isOpen && createPortal(
                <div
                    ref={dropdownRef}
                    className="fixed z-50 w-48 max-h-60 overflow-auto bg-white border border-gray-300 rounded-md shadow-lg"
                    style={{
                        top: `${dropdownPosition.top}px`,
                        left: `${dropdownPosition.left}px`
                    }}>
                    {/* 검색 입력 필드 */}
                    <div className="p-2 border-b border-gray-200">
                        <input
                            ref={searchInputRef}
                            type="text"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                            placeholder="언어 검색..."
                            className="w-full px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-gray-500"
                        />
                    </div>

                    {/* 언어 목록 */}
                    <div className="py-1">
                        {filteredLanguages.length > 0 ? (
                            filteredLanguages.map((language) => (
                                <button
                                    key={language.value}
                                    onClick={() => handleLanguageChange(language.value)}
                                    className={`block w-full px-3 py-2 text-left text-xs hover:bg-gray-100 ${currentLanguage === language.value
                                        ? 'bg-gray-50 text-gray-600 font-medium'
                                        : 'text-gray-700'
                                        }`}>
                                    {language.label}
                                </button>
                            ))
                        ) : (
                            <div className="px-3 py-2 text-xs text-gray-500">
                                검색 결과가 없습니다
                            </div>
                        )}
                    </div>
                </div>,
                document.body
            )}
        </>
    );
};

export default CodeBlockLanguageSelector;
