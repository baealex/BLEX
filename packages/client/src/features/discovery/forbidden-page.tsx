import { ui } from '../../i18n/public-ui.js';
import { goBack } from './not-found-parts';

export function ForbiddenPage() {
    return (
        <main className="fixed inset-0 z-[1000] flex min-h-screen items-center justify-center p-4">
            <div className="absolute inset-0 bg-surface-page" />
            <div className="mx-auto max-w-4xl text-center">
                <div className="pointer-events-none absolute inset-0 overflow-hidden">
                    <div className="blex-float absolute top-20 left-10 size-16 rounded-full bg-line/40" />
                    <div className="blex-float-delayed absolute top-40 right-20 size-12 rounded-full bg-line-light/60" />
                    <div className="blex-float absolute bottom-20 left-20 size-20 rounded-full bg-surface-subtle/70" />
                    <div className="blex-float-delayed absolute right-10 bottom-40 size-14 rounded-full bg-line/30" />
                </div>
                <div className="relative z-10">
                    <div className="mb-8">
                        <h1 className="text-9xl font-bold leading-none tracking-tight text-content-hint/60 md:text-[12rem]">
                            403
                        </h1>
                    </div>
                    <div className="mx-auto mb-8 max-w-2xl rounded-2xl bg-surface-elevated p-8 shadow-floating ring-1 ring-line/60 md:p-12">
                        <h2 className="mb-4 text-3xl font-bold text-content md:text-4xl">{ui('Access denied')}</h2>
                        <p className="text-xl leading-relaxed text-content-secondary">
                            {ui('You do not have permission to access this page.')}
                            <br />
                            {ui('Sign in and try again.')}
                        </p>
                    </div>
                    <div className="flex flex-col items-center justify-center gap-4 sm:flex-row">
                        <button
                            type="button"
                            onClick={goBack}
                            className="rounded-full border border-line bg-surface-elevated px-8 py-4 font-semibold text-content transition-all duration-150 hover:border-line-strong hover:bg-surface-subtle"
                        >
                            {ui('Go back')}
                        </button>
                        <a
                            href="/"
                            className="rounded-full bg-action px-8 py-4 font-semibold text-content-inverted transition-all duration-150 hover:bg-action-hover"
                        >
                            {ui('Go home')}
                        </a>
                    </div>
                </div>
            </div>
        </main>
    );
}

export function mountPage() {
    return <ForbiddenPage />;
}
