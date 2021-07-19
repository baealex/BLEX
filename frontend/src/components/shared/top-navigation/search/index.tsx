import styles from './Search.module.scss';

import React, { useState } from 'react';

export function Search() {
    const [ keyword, setKeyword ] = useState('');

    const onSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if(e.key == 'Enter') {
            const search = `https://duckduckgo.com/?q=${encodeURIComponent(`${keyword} site:${location.host}`)}`;
            window.open('about:blank')!.location.href = search;
        }
    };

    return (
        <input
            autoComplete="off"
            className={styles.search}
            name="search"
            type="text"
            value={keyword}
            placeholder="덕덕고에서 검색"
            onChange={(e) => setKeyword(e.target.value)}
            onKeyPress={(e) => onSearch(e)}
        />
    );
}