import Head from 'next/head';
import Link from 'next/link';
import React from 'react';

import SEO from '../../components/seo'

export async function getServerSideProps(context) {
    const { author } = context.query;
    console.log(author);
}

class UserPosts extends React.Component {
    constructor(props) {
        super(props);

    }

    render() {
        return (
            <>
                <p>헤헤ㅔ</p>
            </>
        )
    }
}

export default UserPosts