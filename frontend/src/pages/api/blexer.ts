import { CONFIG } from '~/modules/settings';
import blexer from '~/modules/utility/blexer';

import type {
    NextApiRequest,
    NextApiResponse
} from 'next';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
    if (req.method === 'POST') {
        const { token, text } = req.body;

        if (token === CONFIG.API_KEY) {
            res.status(200).json({
                text: blexer(text)
            });
        }
    }
    res.status(404).end();
}