import style from './style.module.scss';

interface SnackBarOptions {
    onClick?: (e: MouseEvent) => void;
}

const handleRemove: NodeJS.Timeout[] = [];

const container = (function () {
    if (typeof window !== 'undefined') {
        const containerName = 'snackbar-container';

        if (!document.getElementById(containerName)) {
            const div = document.createElement('div');
            div.id = containerName;
            document.body.appendChild(div);
        }
        return document.getElementById(containerName);
    }
}()) as HTMLElement;

export function clearSnackBar() {
    Array.from(document.getElementsByClassName(style['snack-bar'])).forEach(el => {
        clearTimeout(handleRemove.shift()!);
        container.removeChild(el);
    });
}

export function snackBar(text: string, options?: SnackBarOptions) {
    clearSnackBar();

    const snackBar = document.createElement('div');
    snackBar.textContent = text;
    snackBar.classList.add(style['snack-bar']);

    if (options?.onClick) {
        snackBar.classList.add(style['have-event']);
        snackBar.addEventListener('click', options.onClick);
    }

    container.appendChild(snackBar);
    handleRemove.unshift(setTimeout(() => {
        container.removeChild(snackBar);
    }, 4250));
}
