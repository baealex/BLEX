import React, { useState, useRef, useEffect } from 'react';
import styles from './SearchBox.module.scss';

interface HistoryItem {
    pk: number;
    keyword: string;
}

interface SearchBoxProps {
    query?: string;
    placeholder?: string;
    maxLength?: number;
    username?: string;
    history?: HistoryItem[];
}

/**
 * 검색 박스 컴포넌트
 */
const SearchBox: React.FC<SearchBoxProps> = ({
    query = '',
    placeholder = '검색어를 입력하세요.',
    maxLength = 20,
    username = '',
    history = []
}) => {
    const [searchQuery, setSearchQuery] = useState<string>(query);
    const [showHistory, setShowHistory] = useState<boolean>(false);
    const inputRef = useRef<HTMLInputElement>(null);
    const historyRef = useRef<HTMLDivElement>(null);

    // 검색 실행
    const handleSearch = (e?: React.FormEvent): void => {
        e?.preventDefault();

        if (!searchQuery.trim()) return;

        // 검색 페이지로 이동
        window.location.href = `/search?q=${encodeURIComponent(searchQuery)}&u=${encodeURIComponent(username)}`;
    };

    // 검색어 변경
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>): void => {
        setSearchQuery(e.target.value);
    };

    // 검색 히스토리 항목 클릭
    const handleHistoryClick = (term: string): void => {
        setSearchQuery(term);
        setShowHistory(false);
        window.location.href = `/search?q=${encodeURIComponent(term)}&u=${encodeURIComponent(username)}`;
    };

    // 검색 히스토리 삭제
    const handleRemoveHistory = async (e: React.MouseEvent, pk: number): Promise<void> => {
        e.stopPropagation();

        try {
            const response = await fetch(`/v1/search/history/${pk}`, {
                method: 'DELETE',
                headers: {
                    'Content-Type': 'application/json',
                    'X-CSRFToken': getCookie('csrftoken') || ''
                }
            });

            if (response.ok) {
                // 페이지 새로고침으로 히스토리 업데이트
                window.location.reload();
            }
        } catch (error) {
            console.error('Error removing search history:', error);
        }
    };

    // CSRF 토큰 가져오기
    const getCookie = (name: string): string | undefined => {
        const value = `; ${document.cookie}`;
        const parts = value.split(`; ${name}=`);
        if (parts.length === 2) return parts.pop()?.split(';').shift();
        return undefined;
    };

    // 외부 클릭 시 히스토리 닫기
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent): void => {
            if (historyRef.current && !historyRef.current.contains(event.target as Node) &&
                inputRef.current && !inputRef.current.contains(event.target as Node)) {
                setShowHistory(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    return (
        <div className={styles.searchBoxContainer}>
            <form onSubmit={handleSearch} className={styles.searchForm}>
                <div className={styles.inputContainer}>
                    <input
                        ref={inputRef}
                        type="text"
                        value={searchQuery}
                        onChange={handleChange}
                        placeholder={placeholder}
                        maxLength={maxLength}
                        className={styles.searchInput}
                        onFocus={() => setShowHistory(true)}
                    />
                    {searchQuery && (
                        <button
                            type="button"
                            className={styles.clearButton}
                            onClick={() => setSearchQuery('')}
                        >
                            <i className="fas fa-times"></i>
                        </button>
                    )}
                </div>
                <button type="submit" className={styles.searchButton}>
                    <i className="fas fa-search"></i>
                </button>
            </form>

            {showHistory && history && history.length > 0 && (
                <div ref={historyRef} className={styles.historyContainer}>
                    <div className={styles.historyHeader}>
                        <span>최근 검색어</span>
                    </div>
                    <ul className={styles.historyList}>
                        {history.map((item) => (
                            <li
                                key={item.pk}
                                className={styles.historyItem}
                                onClick={() => handleHistoryClick(item.keyword)}
                            >
                                <span className={styles.historyKeyword}>
                                    <i className="fas fa-history"></i>
                                    {item.keyword}
                                </span>
                                <button
                                    className={styles.historyRemove}
                                    onClick={(e) => handleRemoveHistory(e, item.pk)}
                                >
                                    <i className="fas fa-times"></i>
                                </button>
                            </li>
                        ))}
                    </ul>
                </div>
            )}
        </div>
    );
};

export default SearchBox;
