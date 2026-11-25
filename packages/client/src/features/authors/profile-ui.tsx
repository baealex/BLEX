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

/** The site's own logo, so a self-hosted site stamps its card with its own mark. */
interface SiteMark {
    logoUrl?: string | null;
    darkLogoUrl?: string | null;
}

const pill =
    'inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-5 text-sm font-semibold transition-colors duration-150';

/** Section titles on the overview stay quiet so the author's own content leads. */
export const authorSectionTitle = 'text-sm font-semibold text-content-secondary';
export const authorTextLink =
    'inline-flex min-h-11 items-center gap-1.5 text-sm font-semibold text-content transition-colors duration-150 hover:text-content-secondary';

function SubscriptionControl({ username, state }: { username: string; state: AuthorSubscriptionView }): ReactNode {
    const subscribeLabel = ui('Subscribe to new posts by {value0}', { value0: username });
    if (state.csrfToken === null) {
        return (
            <LoginPromptLink
                returnTo={state.returnTo}
                action="subscribe"
                aria-label={subscribeLabel}
                className={`${pill} bg-action text-content-inverted hover:bg-action-hover active:scale-[0.98]`}
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
                className={`${pill} ${state.subscribed ? 'bg-surface text-content-secondary ring-1 ring-line hover:text-content hover:ring-line-strong' : 'bg-action text-content-inverted hover:bg-action-hover active:scale-95'}`}
            >
                <SiteIcon name={state.subscribed ? 'check' : 'bell'} className="text-xs" />
                {state.subscribed ? ui('Subscribed') : ui('Subscribe')}
            </button>
        </form>
    );
}

/** Owners get their settings in the place a reader would subscribe. */
function ProfileAction({ profile }: { profile: AuthorProfileView }): ReactNode {
    if (profile.isOwner) {
        return (
            <a
                href="/settings/profile"
                className={`${pill} bg-surface text-content ring-1 ring-line hover:bg-surface-subtle hover:ring-line-strong`}
            >
                <SiteIcon name="pencil" className="text-xs" />
                {ui('Edit profile')}
            </a>
        );
    }
    return profile.subscription ? (
        <SubscriptionControl username={profile.username} state={profile.subscription} />
    ) : null;
}

function ProfileLinks({ profile }: { profile: AuthorProfileView }): ReactNode {
    const { socialLinks, homepage, isOwner } = profile;
    if (!socialLinks.length && !homepage && !isOwner) return null;
    return (
        <div className="flex flex-wrap items-center gap-2">
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
                        className="flex size-11 items-center justify-center rounded-full text-content-secondary ring-1 ring-line transition-colors duration-150 hover:text-content hover:ring-line-strong"
                    >
                        <SiteIcon name={socialIcons[name] ?? 'link'} className="text-lg" />
                        <span className="sr-only">{label}</span>
                    </a>
                );
            })}
            {homepage ? (
                <a
                    href={homepage.href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="group inline-flex min-h-11 min-w-0 items-center gap-2 rounded-full px-4 text-sm font-semibold text-content-secondary ring-1 ring-line transition-colors duration-150 hover:text-content hover:ring-line-strong"
                >
                    <SiteIcon name="link" className="text-xs text-content-secondary group-hover:text-content" />
                    <span className="truncate">{homepage.label}</span>
                </a>
            ) : null}
            {isOwner ? (
                socialLinks.length ? (
                    <a
                        href="/settings/social-links"
                        title={ui('Manage social links')}
                        className="flex size-11 items-center justify-center rounded-full border border-dashed border-line-strong text-content-secondary transition-colors duration-150 hover:text-content"
                    >
                        <SiteIcon name="plus" className="text-sm" />
                        <span className="sr-only">{ui('Manage social links')}</span>
                    </a>
                ) : (
                    <a
                        href="/settings/social-links"
                        className="inline-flex min-h-11 items-center gap-2 rounded-full border border-dashed border-line-strong px-4 text-sm text-content-secondary transition-colors duration-150 hover:text-content"
                    >
                        <SiteIcon name="plus" className="text-xs" />
                        <span>{ui('Add a social link')}</span>
                    </a>
                )
            ) : null}
        </div>
    );
}

function SiteSeal({ brand }: { brand?: SiteMark }): ReactNode {
    const light = brand?.logoUrl ?? '/resources/logob.svg';
    const dark = brand?.darkLogoUrl ?? (brand?.logoUrl ? light : '/resources/logow.svg');
    return (
        <span aria-hidden="true" className="pointer-events-none shrink-0 select-none opacity-15">
            <img src={light} alt="" className="blex-site-logo-light h-7 w-auto" data-no-filter="" />
            <img src={dark} alt="" className="blex-site-logo-dark h-7 w-auto" data-no-filter="" />
        </span>
    );
}

/**
 * The author's card on the overview: the cover is a print tucked behind it.
 * The card grows with its content, so long bios and many links never overflow.
 */
export function ProfileHeader({
    profile,
    brand,
    isHeading
}: {
    profile: AuthorProfileView;
    brand?: SiteMark;
    isHeading: boolean;
}): ReactNode {
    const { username, avatar, cover, bio } = profile;
    const Name = isHeading ? 'h1' : 'p';
    const links = <ProfileLinks profile={profile} />;
    const action = <ProfileAction profile={profile} />;
    return (
        <div className="mx-auto mt-6 w-full max-w-3xl px-4 sm:mt-10 sm:px-6">
            <div className={`relative ${cover ? 'pt-[21%]' : 'pt-6'}`}>
                {cover ? (
                    <div className="absolute inset-x-0 top-0 aspect-[3/1] -rotate-2 overflow-hidden rounded-2xl bg-surface-subtle shadow-floating ring-1 ring-line/60">
                        <img
                            className="h-full w-full object-cover object-center"
                            src={cover}
                            alt={ui("{value0}'s cover", { value0: username })}
                        />
                    </div>
                ) : (
                    <div
                        aria-hidden="true"
                        className="absolute inset-x-[6%] top-0 h-[70%] -rotate-3 rounded-2xl bg-surface-subtle ring-1 ring-line/60"
                    />
                )}
                <div className="relative mx-auto max-w-xl rounded-2xl bg-surface p-6 shadow-floating ring-1 ring-line/60 sm:px-8 sm:py-7">
                    <div className="flex items-start justify-between gap-4">
                        <img
                            className="size-[4.5rem] rounded-full object-cover ring-4 ring-surface sm:size-[4.75rem]"
                            src={avatar}
                            alt={username}
                        />
                        <SiteSeal brand={brand} />
                    </div>
                    <Name className="mt-4 break-words text-3xl font-bold tracking-tight text-content">{username}</Name>
                    {bio ? (
                        <p className="mt-1.5 text-base font-medium leading-relaxed text-content-secondary">{bio}</p>
                    ) : null}
                    <div className="mt-6 flex flex-wrap items-center justify-between gap-3 empty:hidden">
                        {links}
                        {action}
                    </div>
                </div>
            </div>
        </div>
    );
}

/** A one-line header for the author's sub-pages, so their own content starts near the top. */
export function ProfileStrip({ profile }: { profile: AuthorProfileView }): ReactNode {
    const { username, avatar, bio } = profile;
    const href = `/@${encodeURIComponent(username)}`;
    return (
        <div className="flex items-center gap-3 sm:gap-4">
            <a href={href} className="shrink-0">
                <img className="size-11 rounded-full object-cover ring-1 ring-line sm:size-12" src={avatar} alt="" />
            </a>
            <div className="min-w-0 flex-1">
                <a href={href} className="block truncate text-lg font-bold tracking-tight text-content">
                    {username}
                </a>
                {bio ? <p className="hidden truncate text-sm text-content-secondary sm:block">{bio}</p> : null}
            </div>
            <ProfileAction profile={profile} />
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
    if (!links) return null;
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
        <nav className="hide-scrollbar flex gap-7 overflow-x-auto border-b border-line" aria-label={ui('Author menu')}>
            {tabs.map((tab) => (
                <a
                    href={tab.href}
                    key={tab.key}
                    aria-current={active === tab.key ? 'page' : undefined}
                    className={`relative flex min-h-11 shrink-0 items-center gap-1.5 text-[15px] font-semibold transition-colors duration-150 ${active === tab.key ? 'text-content after:absolute after:inset-x-0 after:-bottom-px after:h-0.5 after:rounded-full after:bg-content' : 'text-content-secondary hover:text-content'}`}
                >
                    {tab.label}
                    {tab.count !== undefined ? (
                        <span className="text-[13px] font-medium tabular-nums text-content-secondary">
                            {String(tab.count)}
                        </span>
                    ) : null}
                </a>
            ))}
        </nav>
    );
}
