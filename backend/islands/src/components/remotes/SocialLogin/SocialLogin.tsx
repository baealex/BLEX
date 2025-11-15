import React from 'react';
import { useSocialProviders } from './hooks/useSocialProviders';

interface SocialProvider {
    key: string;
    name: string;
    color: string;
}

const SocialLogin: React.FC = () => {
    const { providers, loading } = useSocialProviders();

    const handleSocialLogin = (provider: SocialProvider) => {
        const clientIds: Record<string, string | undefined> = {
            google: window.configuration?.googleClientId,
            github: window.configuration?.githubClientId
        };

        const redirectUris: Record<string, string> = {
            google: `${window.location.origin}/login/callback/google`,
            github: `${window.location.origin}/login/callback/github`
        };

        const authUrls: Record<string, (clientId: string, redirectUri: string) => string> = {
            google: (clientId, redirectUri) =>
                `https://accounts.google.com/o/oauth2/v2/auth?client_id=${clientId}&redirect_uri=${redirectUri}&response_type=code&scope=openid email profile`,
            github: (clientId, redirectUri) =>
                `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${redirectUri}&scope=user:email`
        };

        const clientId = clientIds[provider.key];
        const redirectUri = redirectUris[provider.key];
        const authUrlBuilder = authUrls[provider.key];

        if (clientId && authUrlBuilder) {
            const authUrl = authUrlBuilder(clientId, redirectUri);
            window.location.href = authUrl;
        } else {
            console.error(`Social login not configured for ${provider.name}`);
        }
    };

    const GoogleIcon = () => (
        <svg className="w-5 h-5" viewBox="0 0 24 24">
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
        <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
            <path d="M12 0C5.374 0 0 5.373 0 12 0 17.302 3.438 21.8 8.207 23.387c.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23A11.509 11.509 0 0112 5.803c1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576C20.566 21.797 24 17.3 24 12c0-6.627-5.373-12-12-12z" />
        </svg>
    );

    const DefaultIcon = () => (
        <svg
            className="w-5 h-5"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24">
            <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth="2"
                d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"
            />
        </svg>
    );

    if (loading) {
        return (
            <div className="space-y-3">
                <div className="w-full h-12 bg-gray-200 rounded-lg animate-pulse" />
                <div className="w-full h-12 bg-gray-200 rounded-lg animate-pulse" />
            </div>
        );
    }

    return (
        <div className="space-y-3">
            {providers.map((provider) => (
                <button
                    key={provider.key}
                    onClick={() => handleSocialLogin(provider)}
                    onMouseEnter={(e) => {
                        e.currentTarget.style.borderColor = provider.color;
                        e.currentTarget.style.color = provider.color;
                    }}
                    onMouseLeave={(e) => {
                        e.currentTarget.style.borderColor = '';
                        e.currentTarget.style.color = '';
                    }}
                    className="w-full flex items-center justify-center gap-3 px-4 py-3 border border-gray-300 rounded-lg text-gray-700 bg-white hover:bg-gray-50 hover:border-gray-400 transition-all duration-200 shadow-sm hover:shadow-md group">
                    <span className="flex-shrink-0">
                        {provider.key === 'google' && <GoogleIcon />}
                        {provider.key === 'github' && <GitHubIcon />}
                        {provider.key !== 'google' && provider.key !== 'github' && (
                            <DefaultIcon />
                        )}
                    </span>
                    <span className="font-medium">{provider.name}으로 계속하기</span>
                </button>
            ))}
        </div>
    );
};

export default SocialLogin;
