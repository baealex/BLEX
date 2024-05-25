import { useRouter } from 'next/router';
import { useState } from 'react';
import { useValue } from 'badland-react';

import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

import {
    BaseInput, Button, Card, Checkbox, Container, Flex, FormControl, Label, Loading
} from '~/components/design-system';
import { useFetch } from '~/hooks/use-fetch';

import { authStore } from '~/stores/auth';

import * as API from '~/modules/api';

export default function SeriesCreate() {
    const router = useRouter();

    const [username] = useValue(authStore, 'username');

    const [title, setTitle] = useState('');
    const [description, setDescription] = useState('');
    const [postIds, setPostIds] = useState<number[]>([]);

    const { data: posts, isLoading } = useFetch(['series', username, 'valid-posts'], async () => {
        if (!username) {
            return [];
        }

        const { data } = await API.getPostsCanAddSeries();
        return data.body?.length ? data.body : [];
    });

    const handleCreate = async () => {
        if (!title) {
            snackBar(message('BEFORE_REQ_ERR', '시리즈의 이름을 입력해주세요.'));
            return;
        }
        const { data } = await API.postUserSeries('@' + username, {
            title,
            description,
            post_ids: postIds.join(',')
        });
        if (data.status === 'ERROR') {
            snackBar(message('AFTER_REQ_ERR', data.errorMessage));
            return;
        }
        snackBar(message('AFTER_REQ_DONE', '시리즈가 생성되었습니다.'));
        router.replace(`/@${username}/series/${data.body.url}`);
    };

    const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
        e.preventDefault();
        handleCreate();
    };

    return (
        <Container size="xs-sm">
            <form onSubmit={handleSubmit} className="mb-3">
                <Flex direction="column" gap={3}>
                    <Flex className="w-100" justify="end">
                        <Button type="submit">
                            생성하기
                        </Button>
                    </Flex>
                    <FormControl className="w-100" required>
                        <Label>
                            시리즈 이름
                        </Label>
                        <BaseInput
                            tag="input"
                            type="text"
                            placeholder="이 시리즈의 이름을 입력해주세요"
                            maxLength={200}
                            onChange={(e) => setTitle(e.target.value)}
                            value={title}
                        />
                    </FormControl>
                    <FormControl className="w-100">
                        <Label>
                            시리즈 설명
                        </Label>
                        <BaseInput
                            tag="textarea"
                            type="text"
                            placeholder="이 시리즈에는 어떤 내용을 다루고 있나요?"
                            maxLength={50}
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                        />
                    </FormControl>
                    <Card className="p-3">
                        <Flex direction="column">
                            {isLoading && (
                                <Flex justify="center" className="p-3 w-100">
                                    <Loading position="inline" />
                                </Flex>
                            )}
                            {posts?.map((post) => (
                                <Checkbox
                                    onChange={(e) => {
                                        if (e.target.checked) {
                                            setPostIds(prev => prev.concat(post.id));
                                        } else {
                                            setPostIds(prev => prev.filter(id => id !== post.id));
                                        }
                                    }}
                                    value={post.id}
                                    label={post.title}
                                />
                            ))}
                        </Flex>
                    </Card>
                </Flex>
            </form>
        </Container >
    );
}
