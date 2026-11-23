import { ui } from '../../i18n/public-ui.js';
import { SiteIcon, type SiteIconName } from '../../appearance/icons';

interface RecentActivity {
    type: 'post' | 'series' | 'comment' | 'like';
    title: string;
    url: string;
    date: string;
    sortDate: number;
}

const activityLabels: Record<RecentActivity['type'], { label: string; icon: SiteIconName }> = {
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

function ActivityHeatmap({ days }: { days: Record<string, number> }) {
    const total = Object.values(days).reduce((sum, count) => sum + count, 0);
    return (
        <div className="overflow-x-auto">
            <div className="mb-4 flex items-end justify-between gap-3">
                <div>
                    <p className="text-xs font-medium text-content-secondary">{ui('Activity over the past year')}</p>
                    <p className="text-lg font-semibold tabular-nums text-content">
                        {ui('{count, plural, one{# activity} other{# activities}}', { count: total })}
                    </p>
                </div>
                <p className="text-xs text-content-hint">{ui('Unit: activities')}</p>
            </div>
            <div
                className="author-heatmap-chart mx-auto min-h-[150px] w-fit"
                data-heatmap-days={JSON.stringify(days)}
            />
        </div>
    );
}

export function AuthorActivitySection({ days, recent }: { days: Record<string, number>; recent: RecentActivity[] }) {
    return (
        <section>
            <h2 className="mb-4 text-2xl font-bold tracking-tight text-content">{ui('Annual activity')}</h2>
            <div className="mb-6 rounded-2xl bg-surface p-6 ring-1 ring-line/60 md:p-7">
                <ActivityHeatmap days={days} />
                {recent.length > 0 ? (
                    <div className="mt-8 border-t border-line-light pt-6">
                        <div className="mb-3 flex items-center justify-between px-1">
                            <h3 className="text-sm font-semibold text-content">{ui('Activity history')}</h3>
                            <span className="rounded-md bg-surface-subtle px-2 py-0.5 text-[11px] font-medium text-content-secondary">
                                {ui('{count, plural, one{# item} other{# items}}', { count: recent.length })}
                            </span>
                        </div>
                        <div className="space-y-3">
                            {recent.map((activity) => (
                                <a
                                    key={`${activity.type}:${activity.url}:${activity.sortDate}`}
                                    href={activity.url}
                                    className="flex items-center gap-4 rounded-xl bg-surface px-3 py-3 ring-1 ring-line/60 hover:ring-line-strong"
                                >
                                    <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-subtle text-content-secondary">
                                        <SiteIcon name={activityLabels[activity.type].icon} className="text-sm" />
                                    </span>
                                    <span className="min-w-0 flex-1">
                                        <span className="mb-1 flex items-center justify-between gap-2 text-xs text-content-secondary">
                                            <span>{activityLabels[activity.type].label}</span>
                                            <span>{activity.date}</span>
                                        </span>
                                        <span className="line-clamp-1 text-sm font-semibold text-content-secondary">
                                            {activity.title}
                                        </span>
                                    </span>
                                </a>
                            ))}
                        </div>
                    </div>
                ) : (
                    <p className="mt-6 text-center text-sm text-content-secondary">{ui('No activity to display')}</p>
                )}
            </div>
        </section>
    );
}
