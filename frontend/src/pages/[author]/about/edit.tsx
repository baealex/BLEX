import { useRouter } from 'next/router';

import { Button, Carousel, Container, Text } from '~/components/design-system';
import { EditorContent } from '~/components/system-design/article-editor-page';

import * as API from '~/modules/api';
import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';
import { useFetch } from '~/hooks/use-fetch';
import { useHidePrimaryButton } from '~/hooks/use-hide-primary-button';

export default function UserAboutEdit() {
    const router = useRouter();

    useHidePrimaryButton();

    const { data, mutate } = useFetch(['user', 'about', router.query.author], async () => {
        if (router.query.author) {
            const { data } = await API.getUserAbout('' + router.query.author);
            if (data.status === 'ERROR') {
                snackBar(message('AFTER_REQ_ERR', data.errorMessage));
                router.push('/');
            }
            return data.body;
        }
    });

    const handleUpdateUserAbout = async () => {
        if (data) {
            const { data: responseData } = await API.updateUserAbout('' + router.query.author, data);
            if (responseData.status === 'DONE') {
                snackBar(message('AFTER_REQ_DONE', '소개가 업데이트되었습니다.'));
            }
        }
    };

    if (!data) return null;

    return (
        <Container size="sm">
            <Text fontSize={8} fontWeight={700} className="mb-2">
                자신을 소개해 보세요.
            </Text>
            <div className="mb-3">
                <Carousel
                    items={[
                        <Text fontSize={4}>
                            자신을 소개하는 글을 작성해 보세요. 자신의 주요 관심사 등을 작성해 보세요.
                        </Text>,
                        <Text fontSize={4}>
                            누구에게 자신을 소개하고 싶으신가요? 대상을 선정하면 작성이 쉬워집니다.
                        </Text>,
                        <Text fontSize={4}>
                            소개글은 자신의 블로그 프로필 페이지에 노출됩니다. 자신을 표현해 보세요.
                        </Text>
                    ]}
                />
            </div>
            <EditorContent
                value={data.aboutMd}
                onChange={(aboutMd) => mutate({
                    ...data,
                    aboutMd
                })}
            />
            <Button display="block" className="mb-5" onClick={handleUpdateUserAbout}>
                작성 완료
            </Button>
        </Container>
    );
}
