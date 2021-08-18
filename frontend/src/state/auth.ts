import SharedState from 'bstate';

import { GetLoginData } from '@modules/api';

export interface AuthContextState extends GetLoginData {
    isLogin: boolean;
}

class AuthContext extends SharedState<AuthContextState> {
    state = {
        isLogin: false,
        username: '',
        avatar: '',
        notify: [],
    } as AuthContextState
}

export const authContext = new AuthContext();