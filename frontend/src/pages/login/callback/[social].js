import React from 'react'
import Head from 'next/head'

export async function getServerSideProps(context) {
    let { social, code } = context.query;
    return { props: { social, code } }
}

class Home extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            
        };
    }

    componentDidMount() {
        if(!window.opener) {
            location.href = '/';
        }

        window.opener.___run(
            this.props.social,
            this.props.code
        );
        window.close();
    }

    render() {
        return (
            <>
                <Head>
                    <title>BLOG EXPRESS ME</title>
                </Head>
            </>
        )
    }
}

export default Home;