class Global {
    constructor() {
        this.state = {
            isLogin: false,
            username: ''
        }
        this._updater = {};
    }

    setState(newState) {
        this.state = newState;
        Object.keys(this._updater).forEach(key => {
            try {
                this._updater[key]();
            } catch(e) {
                delete this._updater[key];
            }
        });
    }

    appendUpdater(name, fn) {
        this._updater[name] = fn;
    }

    popUpdater(name) {
        delete this._updater[name];
    }
}

export default new Global();