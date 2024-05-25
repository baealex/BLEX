import type { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async (context) => {
    const {
        author = '',
        tag = ''
    } = context.query as Record<string, string>;

    if (!author.startsWith('@')) {
        return {
            notFound: true
        };
    }

    return {
        redirect: {
            destination: encodeURI(`/${author}/posts?tag=${tag}`),
            permanent: true
        },
        props: {
        }
    };
};

export default function UserTagPosts() {
    return null;
}
