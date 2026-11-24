/** The part of hCaptcha's API that BLEX uses. */
export interface HcaptchaApi {
    render(
        container: HTMLElement,
        options: {
            sitekey: string;
            theme?: 'light' | 'dark';
            size?: 'normal' | 'compact';
            callback?: (token: string) => void;
        }
    ): string;
    remove(widgetId: string): void;
}

declare global {
    interface Window {
        hcaptcha?: HcaptchaApi;
        blexHcaptchaReady?: () => void;
    }
}

let loading: Promise<HcaptchaApi> | null = null;

/**
 * Loads hCaptcha once per document. `window.hcaptcha` exists before the API has finished loading, and without
 * explicit mode hCaptcha draws into `.h-captcha` elements itself, so widgets render only after its onload callback.
 */
export function loadHcaptcha(): Promise<HcaptchaApi> {
    loading ??= new Promise<HcaptchaApi>((resolve, reject) => {
        const script = document.createElement('script');
        window.blexHcaptchaReady = () => {
            delete window.blexHcaptchaReady;
            if (window.hcaptcha) resolve(window.hcaptcha);
            else reject(new Error('hCaptcha did not become available.'));
        };
        script.src = 'https://js.hcaptcha.com/1/api.js?render=explicit&onload=blexHcaptchaReady';
        script.async = true;
        script.addEventListener(
            'error',
            () => {
                script.remove();
                reject(new Error('hCaptcha could not be loaded.'));
            },
            { once: true }
        );
        document.head.append(script);
    }).catch((error: unknown) => {
        // The next page that needs a widget tries again.
        loading = null;
        throw error;
    });
    return loading;
}
