import { Remarkable } from 'remarkable';

export default function blexer(md) {
    const slugify = (text) => (
        text ? text
            .toString()
            .normalize('NFD')
            .replace(/[\u0300-\u036f]/g, '')
            .toLowerCase()
            .trim()
            .replace(/\s+/g, '-')
            .replace(/[^\w-]+/g, '')
            .replace(/--+/g, '-')
        : ''
    );

    const ids = [];
    const makeID = (text) => {
        const id = slugify(text);
        for(let idx=0; ; idx++) {
            let tempId = id + (idx != 0 ? `-${idx}` : '');
            if(!ids.includes(tempId)) {
                ids.push(tempId);
                return tempId;
            }
        }
    };
    
    let html = new Remarkable().use((remarkable) => {
        remarkable.renderer.rules.heading_open = (tokens, idx) => {
            return `<h${tokens[idx].hLevel} id=${makeID(tokens[idx + 1].content)}>`;
        };
    }).use((remarkable) => {
        remarkable.renderer.rules.image = (tokens, idx) => {
            const dataSrc = ' data-src="' + tokens[idx].src + '"';
            const src = ' src="' + tokens[idx].src + '.preview.jpg"';
            const title = tokens[idx].title ? (' title="' + tokens[idx].title + '"') : '';
            const alt = ' alt="' + (tokens[idx].alt ? tokens[idx].alt : '') + '"';
            return '<img class="lazy"' + dataSrc + src + alt + title + '>';
        }
    }).render(md);

    // Custom Markdown
    html = html.replace(
        /<p>@gif\[.*(https?:\/\/.*\.mp4).*\]<\/p>/g,
        '<p><video class="lazy" autoplay muted loop playsinline poster="$1.preview.jpg"><source data-src="$1" type="video/mp4"/></video></p>'
    );
    html = html.replace(
        /<p>@youtube\[(.*)\]<\/p>/g,
        '<p><iframe width="100%" height="350" src="https://www.youtube.com/embed/$1" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe></p>'
    );
    html = html.replace(/>\[\s\]\s/g, '><input type="checkbox" disabled> ');
    html = html.replace(/>\[x\]\s/g, '><input type="checkbox" disabled checked> ');

    // Allow Markup
    html = html.replace(/&lt;br\/?&gt;/g, "<br/>");
    html = html.replace(/&lt;center&gt;/g, "<div style=\"text-align: center;\">");
    html = html.replace(/&lt;\/center&gt;/g, "</div>");

    return html;
}