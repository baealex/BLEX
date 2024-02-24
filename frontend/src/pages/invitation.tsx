import type { GetServerSideProps } from 'next';
import { Text } from '~/components/design-system';

import * as API from '~/modules/api';

type Props = API.GetPostsResponseData;

export const getServerSideProps: GetServerSideProps<Props> = async (context) => {
    try {
        const { data } = await API.getPopularPosts(1, context.req.headers.cookie);

        return {
            props: {
                ...data.body
            }
        };
    } catch (error) {
        return { notFound: true };
    }
};

const Invitation = () => {
    return (
        <div className="container">
            <Text tag="h2" fontSize={8} fontWeight={600}>작업중입니다.</Text>
            <p>금방 끝낼게요! 🤥</p>
        </div>
    );
};

export default Invitation;
