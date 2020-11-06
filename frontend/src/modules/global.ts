interface GlobalState {
    isLogin: boolean;
    isNightMode: boolean;
    username: string;
}

class Global {
    state: GlobalState;
    private updater: any;

    constructor() {
        this.state = {
            isLogin: false,
            isNightMode: false,
            username: '',
        }
        this.updater = {};
    }

    setState(newState: GlobalState) {
        this.state = newState;
        Object.keys(this.updater).forEach(key => {
            try {
                this.runUpdater(key);
            } catch(e) {
                this.popUpdater(key);
            }
        });
    }

    appendUpdater(name: string, fn: Function) {
        this.updater[name] = fn;
    }

    runUpdater(key: string) {
        this.updater[key]();
    }

    popUpdater(key: string) {
        delete this.updater[key];
    }
}

export default new Global();