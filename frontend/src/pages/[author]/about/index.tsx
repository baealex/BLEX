import type { GetServerSideProps } from 'next';

export const getServerSideProps: GetServerSideProps = async (context) => {
    const { author = '' } = context.query as Record<string, string>;

    if (!author.startsWith('@')) {
        return { notFound: true };
    }

    return {
        props: {},
        redirect: {
            destination: `/${author}`,
            permanent: true
        }
    };
};

export default function About() {
    return null;
}
