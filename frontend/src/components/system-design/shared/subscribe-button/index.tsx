import { useStore } from 'badland-react';

import { Button } from '~/components/design-system';

import * as API from '~/modules/api';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

import { useFetch } from '~/hooks/use-fetch';

import { authStore } from '~/stores/auth';
import { modalStore } from '~/stores/modal';
import { useRef } from 'react';

interface Props {
    author: string;
}

export function SubscribeButton(props: Props) {
    const ref = useRef<HTMLButtonElement>(null);

    const [{ isLogin, username }] = useStore(authStore);

    const { data: hasSubscribe, mutate } = useFetch([isLogin, username, props.author], async () => {
        if (isLogin && username !== props.author) {
            const { data } = await API.getUserProfile('@' + props.author, ['subscribe']);
            return data.body.subscribe.hasSubscribe;
        }
    }, { observeRef: ref });

    const handleClickSubscribe = async () => {
        if (!isLogin) {
            snackBar(message('BEFORE_REQ_ERR', '로그인이 필요합니다.'), {
                onClick: () => modalStore.open('isOpenAuthGetModal')
            });
            return;
        }
        if (username === props.author) {
            snackBar(message('BEFORE_REQ_ERR', '자신의 계정은 구독할 수 없습니다.'));
            return;
        }
        const { data } = await API.putUserFollow('@' + props.author);
        const { hasSubscribe } = data.body;
        mutate(hasSubscribe);

        if (hasSubscribe) {
            snackBar(message('AFTER_REQ_DONE', '구독을 시작합니다.'));
        } else {
            snackBar(message('AFTER_REQ_DONE', '구독을 취소하였습니다.'));
        }
    };

    return (
        <Button
            ref={ref}
            isRounded
            color={hasSubscribe ? 'secondary' : 'default'}
            onClick={handleClickSubscribe}>
            {hasSubscribe ? '구독중' : '구독하기'}
        </Button>
    );
}
