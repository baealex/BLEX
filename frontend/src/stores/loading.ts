import React from 'react';
import Store from 'badland';

export interface LoadingStoreState {
    isRoute: boolean;
    isLoading: boolean;
    SkeletonUI?: React.ReactNode;
}

class LoadingStore extends Store<LoadingStoreState> {
    constructor() {
        super();
        this.state = {
            isRoute: false,
            isLoading: false,
            SkeletonUI: undefined
        };
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
