import BState from 'bstate';

export interface LoadingContextState {
    isLoading: boolean;
}

class LoadingContext extends BState<LoadingContextState> {
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

export const loadingContext = new LoadingContext();