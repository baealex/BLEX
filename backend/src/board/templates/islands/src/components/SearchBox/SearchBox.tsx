import React, { useState, useRef, useEffect } from 'react';

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
        <>
            <div className="search-box-container">
                <form onSubmit={handleSearch} className="search-form">
                    <div className="input-container">
                        <input
                            ref={inputRef}
                            type="text"
                            value={searchQuery}
                            onChange={handleChange}
                            placeholder={placeholder}
                            maxLength={maxLength}
                            className="search-input"
                            onFocus={() => setShowHistory(true)}
                        />
                        {searchQuery && (
                            <button
                                type="button"
                                className="clear-button"
                                onClick={() => setSearchQuery('')}
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        )}
                    </div>
                    <button type="submit" className="search-button">
                        <i className="fas fa-search"></i>
                    </button>
                </form>

                {showHistory && history && history.length > 0 && (
                    <div ref={historyRef} className="history-container">
                        <div className="history-header">
                            <span>최근 검색어</span>
                        </div>
                        <ul className="history-list">
                            {history.map((item) => (
                                <li
                                    key={item.pk}
                                    className="history-item"
                                    onClick={() => handleHistoryClick(item.keyword)}
                                >
                                    <span className="history-keyword">
                                        <i className="fas fa-history"></i>
                                        {item.keyword}
                                    </span>
                                    <button
                                        className="history-remove"
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

            <style jsx>{`
                .search-box-container {
                    position: relative;
                    width: 100%;
                    max-width: 500px;
                    margin: 0 auto;
                }
                
                .search-form {
                    display: flex;
                    align-items: center;
                    width: 100%;
                }
                
                .input-container {
                    position: relative;
                    flex: 1;
                }
                
                .search-input {
                    width: 100%;
                    padding: 10px 40px 10px 15px;
                    border: 1px solid #e9ecef;
                    border-radius: 20px;
                    font-size: 14px;
                    outline: none;
                    transition: border-color 0.2s;
                }
                
                .search-input:focus {
                    border-color: #adb5bd;
                }
                
                .clear-button {
                    position: absolute;
                    right: 10px;
                    top: 50%;
                    transform: translateY(-50%);
                    background: none;
                    border: none;
                    color: #adb5bd;
                    cursor: pointer;
                    font-size: 12px;
                    padding: 5px;
                }
                
                .search-button {
                    background: none;
                    border: none;
                    color: #495057;
                    cursor: pointer;
                    font-size: 16px;
                    padding: 10px 15px;
                }
                
                .history-container {
                    position: absolute;
                    top: 100%;
                    left: 0;
                    width: 100%;
                    background-color: white;
                    border: 1px solid #e9ecef;
                    border-radius: 4px;
                    box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
                    margin-top: 5px;
                    z-index: 10;
                }
                
                .history-header {
                    padding: 10px 15px;
                    border-bottom: 1px solid #e9ecef;
                    font-size: 14px;
                    font-weight: 500;
                    color: #495057;
                }
                
                .history-list {
                    list-style: none;
                    padding: 0;
                    margin: 0;
                    max-height: 300px;
                    overflow-y: auto;
                }
                
                .history-item {
                    display: flex;
                    align-items: center;
                    justify-content: space-between;
                    padding: 10px 15px;
                    cursor: pointer;
                    transition: background-color 0.2s;
                }
                
                .history-item:hover {
                    background-color: #f8f9fa;
                }
                
                .history-keyword {
                    display: flex;
                    align-items: center;
                    gap: 8px;
                    font-size: 14px;
                    color: #495057;
                }
                
                .history-remove {
                    background: none;
                    border: none;
                    color: #adb5bd;
                    cursor: pointer;
                    font-size: 12px;
                    padding: 5px;
                }
                
                .history-remove:hover {
                    color: #495057;
                }
            `}</style>
        </>
    );
};

export default SearchBox;
