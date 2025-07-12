import React from 'react';
import { createRoot } from 'react-dom/client';

// 컴포넌트 임포트
import LikeButton from './components/LikeButton.jsx';
import SearchBox from './components/SearchBox.jsx';

// 컴포넌트 맵핑
const Components = {
    LikeButton,
    SearchBox,
};

customElements.define('island-component', class extends HTMLElement {
    constructor() {
        super();
    }

    connectedCallback() {
        const componentName = this.getAttribute('name');
        const Component = Components[componentName];
        if (Component) {
            const props = this.dataset.props ? JSON.parse(this.dataset.props) : {};
            const root = createRoot(this);
            root.render(<Component {...props} />);
        } else {
            console.error(`Unknown React component: ${componentName}`);
        }
    }
});
