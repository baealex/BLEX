import { useState } from 'react';
import { ui } from '../../i18n/public-ui.js';
import { SiteIcon, type SiteIconName } from '../../appearance/icons';
import type { AuthorActivityView } from './author-page-data';
import { authorSectionTitle, authorTextLink } from './profile-ui';

const activityLabels: Record<AuthorActivityView['recent'][number]['type'], { label: string; icon: SiteIconName }> = {
    post: {
        get label() {
            return ui('New post published');
        },
        icon: 'writing'
    },
    series: {
        get label() {
            return ui('Series created');
        },
        icon: 'stack-2'
    },
    comment: {
        get label() {
            return ui('Comment posted');
        },
        icon: 'message'
    },
    like: {
        get label() {
            return ui('Post liked');
        },
        icon: 'heart'
    }
};

/** The bars only draw the year's rhythm; the table under "View by week" carries the numbers. */
function ActivityBars({ weeks, months }: Pick<AuthorActivityView, 'weeks' | 'months'>) {
    const max = Math.max(1, ...weeks.map((week) => week.count));
    return (
        <div aria-hidden="true" className="mt-4">
            <div className="flex h-14 items-end gap-px sm:gap-[3px]">
                {weeks.map((week) => (
                    <span
                        key={week.key}
                        title={`${week.label} · ${week.count}`}
                        className={`min-w-0 flex-1 rounded-[2px] ${week.count ? 'bg-content' : 'bg-line'}`}
                        style={{
                            height: week.count ? `${Math.max(24, Math.round((week.count / max) * 100))}%` : '6px'
                        }}
                    />
                ))}
            </div>
            <div className="relative mt-2 h-4 text-xs text-content-secondary">
                {months.map((month, index) => (
                    <span
                        key={month.index}
                        className={`absolute top-0${index % 2 ? ' max-sm:hidden' : ''}`}
                        style={{ left: `${(month.index / weeks.length) * 100}%` }}
                    >
                        {month.label}
                    </span>
                ))}
            </div>
        </div>
    );
}

export function AuthorActivitySection({ total, weeks, months, recent }: AuthorActivityView) {
    const [showAll, setShowAll] = useState(false);
    const active = weeks.filter((week) => week.count > 0);
    const shown = 3;
    return (
        <section>
            <h2 className={`mb-3 ${authorSectionTitle}`}>{ui('Annual activity')}</h2>
            <p className="flex flex-wrap items-baseline gap-x-2">
                <span className="text-3xl font-bold tracking-tight tabular-nums text-content">{total}</span>
                <span className="text-sm text-content-secondary">
                    {ui(
                        '{count, plural, one{public activity in the past year} other{public activities in the past year}}',
                        {
                            count: total
                        }
                    )}
                </span>
            </p>
            <ActivityBars weeks={weeks} months={months} />
            {active.length ? (
                <details className="group mt-1">
                    <summary className="inline-flex min-h-11 cursor-pointer list-none items-center gap-1.5 text-sm font-semibold text-content transition-colors duration-150 hover:text-content-secondary [&::-webkit-details-marker]:hidden">
                        {ui('View by week')}
                        <SiteIcon
                            name="chevron-down"
                            className="text-xs transition-transform duration-150 group-open:rotate-180"
                        />
                    </summary>
                    <table className="mt-1 w-full text-sm">
                        <thead className="sr-only">
                            <tr>
                                <th scope="col">{ui('Week')}</th>
                                <th scope="col">{ui('Activities')}</th>
                            </tr>
                        </thead>
                        <tbody>
                            {active.map((week) => (
                                <tr key={week.key} className="border-b border-line-light">
                                    <td className="py-2 text-content-secondary">{week.label}</td>
                                    <td className="py-2 text-right tabular-nums text-content">{week.count}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </details>
            ) : null}
            <ul className="mt-4 border-t border-line-light">
                {recent.map((activity, index) => (
                    <li key={activity.key} hidden={!showAll && index >= shown} className="border-b border-line-light">
                        <a href={activity.url} className="group flex items-center gap-3 py-3">
                            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-content-secondary">
                                <SiteIcon name={activityLabels[activity.type].icon} className="text-sm" />
                            </span>
                            <span className="min-w-0 flex-1">
                                <span className="block text-xs text-content-secondary">
                                    {activityLabels[activity.type].label} · {activity.date}
                                </span>
                                <span className="block truncate text-sm font-semibold text-content transition-colors duration-150 group-hover:text-content-secondary">
                                    {activity.title}
                                </span>
                            </span>
                        </a>
                    </li>
                ))}
                {recent.length ? null : (
                    <li className="border-b border-line-light py-4 text-sm text-content-secondary">
                        {ui('No public activity in the last 30 days.')}
                    </li>
                )}
            </ul>
            {recent.length > shown ? (
                <button
                    type="button"
                    aria-expanded={showAll}
                    onClick={() => setShowAll(!showAll)}
                    className={`${authorTextLink} mt-1`}
                >
                    {showAll
                        ? ui('Show less')
                        : ui('{count, plural, one{Show # more} other{Show # more}}', { count: recent.length - shown })}
                    <SiteIcon
                        name="chevron-down"
                        className={`text-xs transition-transform duration-150${showAll ? ' rotate-180' : ''}`}
                    />
                </button>
            ) : null}
        </section>
    );
}
