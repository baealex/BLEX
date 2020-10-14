import { Remarkable } from 'remarkable';

export default function blexer(md) {
    let html = new Remarkable().render(md);

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