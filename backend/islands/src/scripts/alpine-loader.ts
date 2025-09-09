import Alpine from 'alpinejs';

import headerScroll from './alpine/headerScroll';
import likeButton from './alpine/likeButton';

Alpine.data('headerScroll', headerScroll);
Alpine.data('likeButton', likeButton);

document.addEventListener('DOMContentLoaded', () => {
    Alpine.start();
});

window.Alpine = Alpine;

export default Alpine;
