import { ui } from '../../i18n/public-ui.js';
import type { ReactNode } from 'react';
import { SiteIcon, type SiteIconName } from '../../appearance/icons';
import { LoginPromptLink } from '../engagement/ui/login-prompt-link';
import type { AuthorProfileView, AuthorSubscriptionView } from './author-page-data';

const socialIcons: Record<string, SiteIconName> = {
    github: 'brand-github',
    twitter: 'brand-x',
    x: 'brand-x',
    threads: 'brand-threads',
    telegram: 'brand-telegram',
    facebook: 'brand-facebook',
    instagram: 'brand-instagram',
    linkedin: 'brand-linkedin',
    youtube: 'brand-youtube',
    tiktok: 'brand-tiktok',
    discord: 'brand-discord'
};

function SubscriptionControl({ username, state }: { username: string; state: AuthorSubscriptionView }): ReactNode {
    const subscribeLabel = ui('Subscribe to new posts by {value0}', { value0: username });
    if (state.csrfToken === null) {
        return (
            <LoginPromptLink
                returnTo={state.returnTo}
                action="subscribe"
                aria-label={subscribeLabel}
                className="inline-flex items-center gap-2 rounded-full bg-action px-5 py-2.5 text-sm font-semibold text-content-inverted transition-colors duration-150 hover:bg-action-hover active:scale-[0.98]"
            >
                <SiteIcon name="bell" className="text-xs" />
                {ui('Subscribe')}
            </LoginPromptLink>
        );
    }
    return (
        <form className="mb-0" method="post" action={state.action}>
            <input type="hidden" name="csrfmiddlewaretoken" value={state.csrfToken} />
            <input type="hidden" name="returnTo" value={state.returnTo} />
            {state.subscribed ? <input type="hidden" name="action" value="unsubscribe" /> : null}
            <button
                type="submit"
                aria-pressed={state.subscribed}
                aria-label={subscribeLabel}
                className={`inline-flex items-center justify-center gap-2 rounded-full border px-5 py-2.5 text-sm font-semibold transition-all duration-150 ${state.subscribed ? 'border-line bg-surface text-content-secondary hover:border-line-strong hover:text-content' : 'border-transparent bg-action text-content-inverted hover:bg-action-hover active:scale-95'}`}
            >
                <SiteIcon name={state.subscribed ? 'check' : 'bell'} className="text-xs" />
                {state.subscribed ? ui('Subscribed') : ui('Subscribe')}
            </button>
        </form>
    );
}

export function ProfileHeader({ profile, isHeading }: { profile: AuthorProfileView; isHeading: boolean }): ReactNode {
    const { username, avatar, cover, bio, homepage, socialLinks, isOwner, subscription } = profile;
    return (
        <div className="relative overflow-hidden pb-12 sm:pb-16">
            {cover ? (
                <div className="mx-auto max-w-4xl px-4 pt-6 sm:px-6 sm:pt-8">
                    <div className="relative aspect-[3/1] w-full overflow-hidden rounded-2xl ring-1 ring-line/60">
                        <img
                            className="h-full w-full object-cover object-center"
                            src={cover}
                            alt={ui("{value0}'s cover", { value0: username })}
                            loading="lazy"
                        />
                        <div className="absolute inset-0 bg-surface-page/5" />
                        <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-b from-transparent to-surface-page/35 sm:h-16 md:h-20" />
                        {isOwner ? (
                            <a
                                href="/settings/profile"
                                className="absolute right-4 top-4 inline-flex items-center gap-2 rounded-full border border-white/30 bg-black/25 px-3 py-1.5 text-xs font-semibold text-white/90 backdrop-blur-sm transition-colors duration-150 hover:border-white/50 hover:bg-black/35 hover:text-white"
                            >
                                <SiteIcon name="camera" className="text-[11px]" />
                                <span>{ui('Change cover')}</span>
                            </a>
                        ) : null}
                    </div>
                </div>
            ) : null}
            <div
                className={`relative mx-auto max-w-4xl px-4 sm:px-6 ${cover ? '-mt-14 sm:-mt-16 md:-mt-20' : 'pt-12'}`}
            >
                <div className="flex flex-col items-center text-center">
                    <div className="relative mb-6 sm:mb-8">
                        <img
                            className="relative size-28 rounded-full object-cover shadow-floating ring-4 ring-surface-page sm:size-32 md:size-40"
                            src={avatar}
                            alt={username}
                        />
                        {isOwner ? (
                            <a
                                href="/settings/profile"
                                title={ui('Change profile picture')}
                                aria-label={ui('Change profile picture')}
                                className="absolute bottom-1 right-1 flex size-9 items-center justify-center rounded-full border border-line bg-surface text-content-secondary shadow-subtle transition-colors duration-150 hover:border-line-strong hover:text-content"
                            >
                                <SiteIcon name="pencil" className="text-xs" />
                            </a>
                        ) : null}
                    </div>
                    {isHeading ? (
                        <h1 className="mb-2 text-2xl font-bold tracking-tight text-content">{username}</h1>
                    ) : (
                        <p className="mb-2 text-2xl font-bold tracking-tight text-content">{username}</p>
                    )}
                    {bio ? (
                        <p className="mx-auto mb-6 max-w-2xl px-4 text-md font-medium leading-relaxed text-content-secondary">
                            {bio}
                        </p>
                    ) : null}
                    {subscription ? (
                        <div className="mb-6">
                            <SubscriptionControl username={username} state={subscription} />
                        </div>
                    ) : null}
                    {homepage ? (
                        <div className="mb-8">
                            <a
                                href={homepage.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="group inline-flex items-center gap-2 rounded-full border border-line bg-surface px-5 py-2.5 text-sm font-semibold text-content-secondary transition-colors duration-150 hover:border-line-strong hover:text-content"
                            >
                                <SiteIcon
                                    name="link"
                                    className="text-xs text-content-hint transition-colors group-hover:text-content"
                                />
                                <span>{homepage.label}</span>
                            </a>
                        </div>
                    ) : null}
                    {socialLinks.length ? (
                        <div className="mx-auto flex max-w-lg flex-wrap justify-center gap-3">
                            {socialLinks.map((social) => {
                                const name = social.name.toLowerCase();
                                const label = name === 'twitter' ? 'X' : social.name;
                                return (
                                    <a
                                        key={social.key}
                                        href={social.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        title={label}
                                        className="flex size-10 items-center justify-center rounded-full border border-line bg-surface text-content-secondary transition-colors duration-150 hover:border-line-strong hover:text-content sm:size-11"
                                    >
                                        <SiteIcon name={socialIcons[name] ?? 'link'} className="text-lg" />
                                        <span className="sr-only">{label}</span>
                                    </a>
                                );
                            })}
                        </div>
                    ) : isOwner ? (
                        <a
                            href="/settings/social-links"
                            className="inline-flex items-center gap-2 rounded-full border border-dashed border-line-strong px-4 py-2 text-sm text-content-hint transition-colors duration-150 hover:border-line hover:text-content-secondary"
                        >
                            <SiteIcon name="plus" className="text-xs" />
                            <span>{ui('Add a social link')}</span>
                        </a>
                    ) : null}
                </div>
            </div>
        </div>
    );
}

export function AuthorTabs({
    profile,
    active
}: {
    profile: AuthorProfileView;
    active: 'overview' | 'posts' | 'series' | 'about';
}): ReactNode {
    const { tabs: links } = profile;
    if (!links) return <div className="mb-8" />;
    const tabs: Array<{ key: 'overview' | 'posts' | 'series'; href: string; label: string; count?: number }> = [
        {
            key: 'overview',
            href: links.overview,
            label: ui('Overview')
        },
        {
            key: 'posts',
            href: links.posts,
            label: ui('Posts'),
            count: links.postCount
        },
        {
            key: 'series',
            href: links.series,
            label: ui('Series'),
            count: links.seriesCount
        }
    ];
    return (
        <div className="relative mb-10">
            <div className="hide-scrollbar flex justify-center overflow-x-auto pb-2 sm:pb-0">
                <nav
                    className="inline-flex min-w-fit rounded-xl bg-surface-subtle/80 p-1.5 backdrop-blur-sm"
                    aria-label={ui('Author menu')}
                >
                    {tabs.map((tab) => (
                        <a
                            href={tab.href}
                            key={tab.key}
                            aria-current={active === tab.key ? 'page' : undefined}
                            className={`relative whitespace-nowrap rounded-lg px-6 py-2 text-sm font-bold transition-all duration-200 ${active === tab.key ? 'bg-surface-elevated text-content shadow-sm' : 'text-content-secondary hover:text-content'}`}
                        >
                            <span className="relative z-10 flex items-center gap-2">
                                <span className="flex items-center gap-1.5">
                                    {tab.label}
                                    {tab.count !== undefined ? (
                                        <span
                                            className={`rounded-md px-1.5 py-0.5 text-[10px] ${active === tab.key ? 'bg-action text-content-inverted' : 'bg-surface-elevated text-content-secondary ring-1 ring-line/80'}`}
                                        >
                                            {String(tab.count)}
                                        </span>
                                    ) : null}
                                </span>
                            </span>
                        </a>
                    ))}
                </nav>
            </div>
        </div>
    );
}
