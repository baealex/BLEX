import React from 'react';

import blexer from '@modules/blexer';
import Config from '@modules/config';

export async function getServerSideProps(context) {
    const raise = require('@modules/raise');
    try {
        if(context.req.method === 'POST') {
            const { token, text } = JSON.parse(context.req.read().toString());
            if(token === Config.API_KEY) {
                context.res.end(blexer(text));
            }
        }
    } catch(e) {
        
    }
    raise.auto(404, context.res);
    return {props: {}};
}

class Blexer extends React.Component {
    constructor(props) {
        super(props);
    }

    render() {
        return (
            <></>
        )
    }
}

export default Blexer;