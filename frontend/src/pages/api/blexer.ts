import blexer from '@modules/blexer';

import { NextApiRequest, NextApiResponse } from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { text } = req.body;
        res.status(200).json({ text: blexer(text) });
    }
    res.status(404).end();
}