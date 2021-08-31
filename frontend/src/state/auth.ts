import SharedState from 'bstate';

import { GetLoginData } from '@modules/api';

export interface AuthContextState extends GetLoginData {
    isLogin: boolean;
}

class AuthContext extends SharedState<AuthContextState> {
    constructor() {
        super();
        this.state = {
            isLogin: false,
            username: '',
            avatar: '',
            notify: [],
        };
    }
}

export const authContext = new AuthContext();