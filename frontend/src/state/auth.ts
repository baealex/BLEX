import SharedState from 'bstate';

export interface AuthContextState {
    isLogin: boolean;
    username: string;
}

class AuthContext extends SharedState<AuthContextState> {
    state = {
        isLogin: false,
        username: '',
    }
}

export const authContext = new AuthContext();