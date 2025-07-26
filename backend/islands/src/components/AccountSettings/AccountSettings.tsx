import { useFetch } from '~/hooks/use-fetch';
import type { Response } from '~/modules/http.module';
import { http } from '~/modules/http.module';

interface Account {
    username: string;
    name: string;
    email: string;
    createdDate: string;
}

const getAccount = async () => {
    const { data } = await http.get<Response<Account>>('/v1/setting/account');
    return data;
};

const AccountSettings = () => {
    const { data } = useFetch({
        queryKey: ['account'],
        queryFn: async () => {
            const response = await getAccount();
            if (response.status === 'ERROR') {
                throw new Error(response.errorMessage);
            }
            return response.body;
        }
    });

    return (
        <div>
            <h1>Account Settings</h1>
            <pre>{JSON.stringify(data, null, 2)}</pre>
        </div>
    );
};

export default AccountSettings;
