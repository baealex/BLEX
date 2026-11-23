export const getCsrfToken = (): string => {
    const tokenElement = document.querySelector('[name=csrfmiddlewaretoken]') as HTMLInputElement;
    return tokenElement ? tokenElement.value : '';
};
