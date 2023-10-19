import { Remarkable } from 'remarkable';
import { linkify } from 'remarkable/linkify';
import rkatex from 'remarkable-katex';

function slugify(text) {
    return text
        ? text
            .toString()
            .toLowerCase()
            .trim()
            .replace(/\[([^\]]*)\]\([^)]*\)/gi, '$1')
            .replace(/\s+/g, '-')
            .replace(/[^가-힣a-z0-9-]/g, '')
            .replace(/--+/g, '-')
            .slice(0, 25)
        : 'header';
}

function headerHash(remarkable) {
    const ids = [];
    const makeID = (text) => {
        const id = slugify(text);
        for (let idx = 0; ; idx++) {
            let tempId = id + (idx != 0 ? `-${idx}` : '');
            if (!ids.includes(tempId)) {
                ids.push(tempId);
                return tempId;
            }
        }
    };
    remarkable.renderer.rules.heading_open = (tokens, idx) => {
        let { hLevel } = tokens[idx];
        if (tokens[idx].hLevel % 2 == 1) {
            hLevel += 1;
        }
        return `<h${hLevel} id="${makeID(tokens[idx + 1].content)}">`;
    };
    remarkable.renderer.rules.heading_close = (tokens, idx) => {
        let { hLevel } = tokens[idx];
        if (tokens[idx].hLevel % 2 == 1) {
            hLevel += 1;
        }
        return `</h${hLevel}>`;
    };
}

function lazyImage(remarkable) {
    remarkable.renderer.rules.image = (tokens, idx) => {
        const dataSrc = ' data-src="' + tokens[idx].src + '"';
        const src = ' src="' + tokens[idx].src + '.preview.jpg"';
        const title = tokens[idx].title ? (' title="' + tokens[idx].title + '"') : '';
        const alt = ' alt="' + (tokens[idx].alt ? tokens[idx].alt : '') + '"';
        return '<img class="lazy"' + dataSrc + src + alt + title + '>';
    };
}

export default function blexer(md) {
    let html = new Remarkable()
        .use(headerHash)
        .use(lazyImage)
        .use(linkify)
        .use(rkatex)
        .render(md);

    // Custom Markdown
    html = html.replace(
        /@gif\[.*(https?:\/\/.*\.mp4).*\]/g,
        '<video class="lazy" autoplay muted loop playsinline poster="$1.preview.jpg"><source data-src="$1" type="video/mp4"/></video>'
    );
    html = html.replace(
        /@youtube\[(.*)\]/g,
        '<iframe width="100%" height="350" src="https://www.youtube.com/embed/$1" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>'
    );
    html = html.replace(/li>\[\s\]\s/g, 'li class="checkbox">');
    html = html.replace(/li>\[x\]\s/g, 'li class="checkbox checked">');

    // Allow Markup
    html = html.replace(/&lt;br\/?&gt;/g, '<br/>');
    html = html.replace(/&lt;center&gt;/g, '<div style="text-align: center;">');
    html = html.replace(/&lt;\/center&gt;/g, '</div>');

    // Grid Image
    html = html.replace(/&lt;grid-image col=&quot;(1|2|3)&quot;&gt;/g, '<figure class="col-$1">');
    html = html.replace(/&lt;caption&gt;(.*)&lt;\/caption&gt;/g, '<figcaption>$1</figcaption>');
    html = html.replace(/&lt;\/grid-image&gt;/g, '</figure>');

    return html;
}
