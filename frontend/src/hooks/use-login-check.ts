import { useEffect } from 'react';
import { useRouter } from 'next/router';
import { useStore } from 'badland-react';

import { authStore } from '~/stores/auth';

interface Props {
    loginRequired?: { redirect: string };
    onSuccess?: () => void;
    onFailure?: () => void;
}

export function useLoginCheck(props: Props) {
    const router = useRouter();
    const [ state ] = useStore(authStore);

    useEffect(() => {
        if (state.isConfirmed) {
            if (!state.isLogin) {
                if (props.loginRequired) {
                    router.push(props.loginRequired.redirect);
                }
                props.onFailure && props.onFailure();
            }

            if (state.isLogin) {
                props.onSuccess && props.onSuccess();
            }
        }
    }, [state.isConfirmed, state.isLogin]);
}
