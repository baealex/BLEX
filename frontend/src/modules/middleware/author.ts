import { AxiosError } from 'axios';
import type { GetServerSidePropsResult } from 'next';

import * as API from '~/modules/api';

export async function authorRenameCheck(error: unknown, options: {
    author: string;
    continuePath?: string;
}): Promise<GetServerSidePropsResult<{
        redirect: {
            destination: string;
            permanent: boolean;
        };
    } | { notFound: boolean }>> {
    if (error instanceof AxiosError) {
        if (error.response?.status === 404) {
            try {
                const { data } = await API.checkRedirect({
                    username: options.author as string
                });

                if (data.body.newUsername) {
                    const encodedUsername = encodeURI(data.body.newUsername);

                    return {
                        redirect: {
                            destination: `/@${encodedUsername}${options.continuePath ? options.continuePath : ''}`,
                            permanent: true
                        }
                    };
                }
            } catch (error) {
                console.error(error);
            }
        }
    }

    return { notFound: true };
}
