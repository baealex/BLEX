import React from 'react';

import blexer from '@modules/blexer';
import Config from '@modules/config.json';

import { GetServerSidePropsContext } from 'next';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    try {
        if(context.req.method === 'POST') {
            const {
                token = '',
                text = ''
            } = JSON.parse(context.req.read().toString());
            if(token === Config.API_KEY) {
                context.res.end(blexer(text));
            }
        }
    } catch(e) {
        
    }
    return {
        notFound: true
    };
}

export default function Blexer() {
    return (
        <></>
    )
}