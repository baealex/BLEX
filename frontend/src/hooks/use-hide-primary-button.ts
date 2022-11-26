import { useEffect } from 'react';

export function useHidePrimaryButton() {
    useEffect(() => {
        document.documentElement.classList.add('hide-primary-button');

        return () => {
            document.documentElement.classList.remove('hide-primary-button');
        };
    }, []);
}
