import React from 'react';

import blexer from '@modules/blexer';
import { CONFIG } from '@modules/settings';

import { GetServerSidePropsContext } from 'next';

export async function getServerSideProps(context: GetServerSidePropsContext) {
    try {
        if(context.req.method === 'POST') {
            const {
                token = '',
                text = ''
            } = JSON.parse(context.req.read().toString());
            if(token === CONFIG.API_KEY) {
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