import Head from 'next/head'
import React from 'react'
import axios from 'axios'

import API from '../modules/api'

export async function getServerSideProps(context) {
    const { req } = context;
    const { data } = await axios({
        url: 'http://192.168.0.12:8000/v1/posts/temp?get=list',
        method: 'GET',
        headers: req ? {cookie: req.headers.cookie} : undefined,
    });
    console.log(data)
    return { props: { data } }
}

class Post extends React.Component {
    constructor(props) {
        super(props);
    }

    async componentDidMount() {

    }

    render() {
        console.log(this.props);
        return (
            <>
                <Head>
                    <title></title>
                </Head>


            </>
        )
    }
}

export default Post