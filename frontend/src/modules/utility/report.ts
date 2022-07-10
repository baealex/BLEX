import axios from '@modules/api';

export function bindErrorReport() {
    if (typeof window !== 'undefined') {
        window.onerror = (e) => {
            axios({
                method: 'POST',
                url: '/v1/report/error',
                data: JSON.stringify(e)
            });
        };
    }
}
