import Store from 'badland';

export interface LoadingStoreState {
    isLoading: boolean;
}

class LoadingStore extends Store<LoadingStoreState> {
    constructor() {
        super();
        this.state = { isLoading: false };
    }

    start() {
        this.set((prevState) => ({
            ...prevState,
            isLoading: true
        }));
    }

    end() {
        this.set((prevState) => ({
            ...prevState,
            isLoading: false
        }));
    }
}

export const loadingStore = new LoadingStore();
