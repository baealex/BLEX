import React from 'react'

export async function getServerSideProps(context) {
    let { social, code } = context.query;
    return { props: { social, code } };
}

class Home extends React.Component {
    constructor(props) {
        super(props);
    }

    componentDidMount() {
        if(!window.opener) {
            location.replace('/');
        }

        window.opener.___run(
            this.props.social,
            this.props.code,
            () => { window.close() }
        );
    }

    render() {
        return (
            <></>
        )
    }
}

export default Home;