import {
    Card,
    Flex,
    Modal
} from '~/components/design-system';

import type * as API from '~/modules/api';

interface Props {
    isOpen: boolean;
    onClose: () => void;
    token: string;
    tempPosts: API.GetTempPostsResponseData['temps'];
    onClick: (token: string) => void;
    onDelete: (token: string) => void;
}

export function TempArticleModal(props: Props) {
    return (
        <Modal
            title="임시 저장된 글"
            isOpen={props.isOpen}
            onClose={props.onClose}>
            {props.tempPosts.map((item, idx) => (
                <Card key={idx} hasShadow isRounded className="p-3 mb-3">
                    <Flex justify="between">
                        <span onClick={() => props.onClick(item.token)} className={`c-pointer ${props.token == item.token ? 'deep-dark' : 'shallow-dark'}`}>
                            {item.title} <span className="vs">{item.createdDate}</span>
                        </span>
                        <a onClick={() => props.onDelete(item.token)}>
                            <i className="fas fa-times"></i>
                        </a>
                    </Flex>
                </Card>
            ))}
            <Card hasShadow isRounded className="p-3 mb-3">
                <Flex justify="between">
                    <span onClick={() => props.onClick('')} className={`c-pointer ${props.token == '' ? 'deep-dark' : 'shallow-dark'}`}>
                        새 글 쓰기
                    </span>
                </Flex>
            </Card>
        </Modal>
    );
}
