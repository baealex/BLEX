import BState from 'bstate';

export interface LoadingStoreState {
    isLoading: boolean;
}

class LoadingStore extends BState<LoadingStoreState> {
    constructor() {
        super();
        this.state = {
            isLoading: false,
        };
    }

    start() {
        this.setState((prevState) => ({
            ...prevState,
            isLoading: true,
        }));
    }

    end() {
        this.setState((prevState) => ({
            ...prevState,
            isLoading: false,
        }));
    }
}

export const loadingStore = new LoadingStore();