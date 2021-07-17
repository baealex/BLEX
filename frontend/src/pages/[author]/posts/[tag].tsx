import { GetServerSidePropsContext } from 'next';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    const { res } = context;

    const {
        author = '',
        tag = '',
        page = 1,
    } = context.query;

    res.writeHead(302, {
        Location: encodeURI(`/${author}/posts?page=${page}&tag=${tag}`)
    });
    res.end();

    return {
        props: {}
    };
}

export default function Tag() {
    return (
        <></>
    )
}