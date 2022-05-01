import {
    useEffect,
    useMemo, useState 
} from 'react';

import { Button } from '@design-system';

import * as API from '@modules/api';
import { debounceEvent } from '@modules/optimize/event';
import { message } from '@modules/utility/message';
import { snackBar } from '@modules/ui/snack-bar';

interface ArticleThanks {
  author: string;
  url: string;
}

export function ArticleThanks({ author, url }: ArticleThanks) {
    const [active, setActive] = useState<0 | 1 | null>(null);

    useEffect(() => {
        setActive(null);
    }, [author, url]);

    const thanksEvent = useMemo(() => {
        return debounceEvent(() => {
            API.putAnUserPosts('@' + author, url, 'thanks').then(() => {
                setActive(0);
                snackBar(message('AFTER_REQ_DONE', '소중한 의견 감사합니다.'));
            });
        }, 500);
    }, [author, url]);

    const noThanksEvent = useMemo(() => {
        return debounceEvent(() => {
            API.putAnUserPosts('@' + author, url, 'nothanks').then(() => {
                setActive(1);
                snackBar(message('AFTER_REQ_DONE', '소중한 의견 감사합니다.'));
            });
        }, 500);
    }, [author, url]);

    return (
        <div className="text-center my-5">
            <div className="mb-3 font-weight-bold">
                이 글이 도움이 되었나요?
            </div>
            <Button
                color={active === 0 ? 'secondary' : 'default'}
                gap="little"
                space="spare"
                onClick={() => thanksEvent()}
            >
                도움됐어요 😆
            </Button>
            <Button
                color={active === 1 ? 'secondary' : 'default'}
                gap="little"
                space="spare"
                onClick={() => noThanksEvent()}
            >
                도움안돼요 😢
            </Button>
        </div>
    );
}