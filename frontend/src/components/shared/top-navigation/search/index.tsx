import styles from './Search.module.scss';

import { useRouter } from 'next/router';
import React, { useState } from 'react';

export function Search() {
    const router = useRouter();
    const [ keyword, setKeyword ] = useState('');

    const onSearch = (e: React.KeyboardEvent<HTMLInputElement>) => {
        if(e.key == 'Enter') {
            router.push(`/search?q=${encodeURIComponent(keyword)}`);
        }
    };

    return (
        <input
            autoComplete="off"
            className={styles.search}
            name="search"
            type="text"
            value={keyword}
            placeholder="검색어를 입력하세요."
            minLength={2}
            maxLength={10}
            onChange={(e) => setKeyword(e.target.value)}
            onKeyPress={(e) => onSearch(e)}
        />
    );
}