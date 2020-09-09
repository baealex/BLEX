import { decorate, observable, action } from 'mobx';
import { observer } from 'mobx-react';

class LoginStore {
    isLogin = true;
    
    login = () => {
        this.isLogin++;
    }

    logout = () => {
        this.isLogin = false;
    }
}

decorate(LoginStore, {
    isLogin: observable,
    login: action,
    logout: action
});

export default observer(LoginStore);