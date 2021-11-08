import SharedState from 'bstate';

export interface LoadingContextState {
    isLoading: boolean;
}

class LoadingContext extends SharedState<LoadingContextState> {
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