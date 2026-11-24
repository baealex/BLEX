import { ui } from '../../i18n/public-ui.js';
import type { ShareLinksPageData } from './management-page-data';

const labelLimit = 100;

export function ShareLinksPage({ data }: { data: ShareLinksPageData }) {
    const { action, csrfToken, links } = data;
    return (
        <main>
            <a href={data.postPath}>{ui('Back to post')}</a>
            <h1>{ui('Share links')}</h1>
            <p>{data.title}</p>
            {data.error && <p role="alert">{data.error}</p>}
            {data.create && (
                <form method="post" action={action}>
                    <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
                    <label>
                        {ui('Link name')} <input name="label" maxLength={labelLimit} required />
                    </label>
                    <button type="submit">{ui('Create link')}</button>
                </form>
            )}
            {links.length > 0 && (
                <ul>
                    {links.map((link) => (
                        <li key={link.id}>
                            <a href={link.url}>{link.url}</a>
                            <p>
                                {ui(
                                    'Last 7 days: {recent, plural, one{# click} other{# clicks}} · Total: {total, plural, one{# click} other{# clicks}}',
                                    { recent: link.recentClicks, total: link.totalClicks }
                                )}
                            </p>
                            <form method="post" action={action}>
                                <input type="hidden" name="csrfmiddlewaretoken" value={csrfToken} />
                                <input type="hidden" name="id" value={link.id} />
                                <label>
                                    {ui('Link name')}{' '}
                                    <input name="label" maxLength={labelLimit} defaultValue={link.label} required />
                                </label>
                                <label>
                                    <input
                                        name="isPaused"
                                        type="checkbox"
                                        value="true"
                                        defaultChecked={link.isPaused}
                                    />{' '}
                                    {ui('Pause')}
                                </label>
                                <button type="submit">{ui('Save')}</button>
                            </form>
                        </li>
                    ))}
                </ul>
            )}
        </main>
    );
}

export function mountPage(data: ShareLinksPageData) {
    return <ShareLinksPage data={data} />;
}
