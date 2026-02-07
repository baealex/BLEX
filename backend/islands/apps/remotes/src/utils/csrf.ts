/**
 * Get CSRF token from the Django-rendered hidden input in the DOM.
 */
export const getCsrfToken = (): string => {
    const tokenElement = document.querySelector('[name=csrfmiddlewaretoken]') as HTMLInputElement;
    return tokenElement ? tokenElement.value : '';
};
