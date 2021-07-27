import { ShareState } from './share-state';

export interface AuthState {
    isLogin: boolean;
    username: string;
}

class AuthContext extends ShareState<AuthState> {
    state = {
        isLogin: false,
        username: '',
    }
}

export const authContext = new AuthContext();