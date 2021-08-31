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
}

export const loadingContext = new LoadingContext();