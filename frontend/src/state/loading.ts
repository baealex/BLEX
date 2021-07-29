import SharedState from 'bstate';

export interface LoadingContextState {
    isLoading: boolean;
}

class LoadingContext extends SharedState<LoadingContextState> {
    state = {
        isLoading: false,
    }
}

export const loadingContext = new LoadingContext();