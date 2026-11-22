import { Trans, useLingui } from '@lingui/react/macro';
import { getBrowserTimeZone } from '~/i18n/locale';
import { useSocialProviders } from './hooks/useSocialProviders';
import {
    BrandGithub,
    UserRound
} from '@blex/ui/icons';

interface SocialLoginProps {
    nextUrl?: string;
    showPasswordDivider?: boolean;
}

const GoogleIcon = () => (
    <svg aria-hidden="true" className="w-5 h-5" viewBox="0 0 24 24">
        <path
            fill="#4285F4"
            d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        />
        <path
            fill="#34A853"
            d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        />
        <path
            fill="#FBBC05"
            d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
        />
        <path
            fill="#EA4335"
            d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
        />
    </svg>
);

const GitHubIcon = () => (
    <BrandGithub aria-hidden="true" className="w-5 h-5" />
);

const DefaultIcon = () => (
    <UserRound aria-hidden="true" className="w-5 h-5" />
);

const SocialLogin = ({ nextUrl, showPasswordDivider = false }: SocialLoginProps) => {
    const { i18n } = useLingui();
    const { providers, loading } = useSocialProviders();

    if (loading || !Array.isArray(providers) || providers.length === 0) {
        return null;
    }

    const params = new URLSearchParams({
        next: nextUrl || window.NEXT_URL || '/',
        time_zone: getBrowserTimeZone() || ''
    });

    return (
        <>
            <div className="grid gap-3">
                {providers.map((provider) => (
                    <a
                        key={provider.key}
                        href={`/login/start/${encodeURIComponent(provider.key)}?${params}`}
                        className="flex min-h-11 w-full items-center justify-center gap-3 rounded-lg border border-line bg-surface px-4 py-3 text-sm font-semibold text-content transition-colors duration-150 hover:bg-surface-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-action focus-visible:ring-offset-1 active:scale-[0.98]">
                        <span className="shrink-0">
                            {provider.key === 'google' && <GoogleIcon />}
                            {provider.key === 'github' && <GitHubIcon />}
                            {provider.key !== 'google' && provider.key !== 'github' && <DefaultIcon />}
                        </span>
                        {i18n._({
                            id: 'auth.social.continue_with',
                            message: 'Continue with {providerName}',
                            values: { providerName: provider.name }
                        })}
                    </a>
                ))}
            </div>
            <p className="mt-3 text-center text-xs leading-relaxed text-content-secondary">
                <Trans id="auth.social.first_sign_in">Your first social sign-in creates a BLEX account.</Trans>
            </p>
            {showPasswordDivider && (
                <div className="my-5 flex items-center gap-3 text-center text-xs text-content-secondary">
                    <span className="flex-1 border-t border-line" aria-hidden="true" />
                    <Trans id="auth.social.password_divider">Or use a username and password</Trans>
                    <span className="flex-1 border-t border-line" aria-hidden="true" />
                </div>
            )}
        </>
    );
};

export default SocialLogin;
