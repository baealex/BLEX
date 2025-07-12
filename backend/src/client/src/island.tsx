import React from 'react';
import { createRoot } from 'react-dom/client';

import { LikeButton, SearchBox, Comments } from './components';

const Components: Record<string, React.ComponentType<any>> = {
    LikeButton,
    SearchBox,
    Comments,
};

customElements.define('island-component', class extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback(): void {
        const name = this.getAttribute('name');
        const props = this.getAttribute('props') ? JSON.parse(decodeURIComponent(this.getAttribute('props') || '')) : {};

        if (!name) {
            console.error('Component name attribute is missing');
            return;
        }

        const Component = Components[name];
        if (Component) {
            const root = createRoot(this);
            root.render(<Component {...props} />);
        } else {
            console.error(`Unknown React component: ${name}`);
        }
    }
});
