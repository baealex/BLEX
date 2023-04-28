import blexer from './blexer';

function trimBetweenTags(html: string) {
    return html.replace(/>\s+/g, '>').replace(/\s+</g, '<');
}

describe('blexer', () => {
    it('Header', () => {
        expect(blexer('# Hello World!')).toBe('<h2 id="hello-world">Hello World!</h2>');
        expect(blexer('## Hello World!')).toBe('<h2 id="hello-world">Hello World!</h2>');
        expect(blexer('### Hello World!')).toBe('<h4 id="hello-world">Hello World!</h4>');
        expect(blexer('#### Hello World!')).toBe('<h4 id="hello-world">Hello World!</h4>');
        expect(blexer('##### Hello World!')).toBe('<h6 id="hello-world">Hello World!</h6>');
        expect(blexer('###### Hello World!')).toBe('<h6 id="hello-world">Hello World!</h6>');
    });

    it('Link', () => {
        expect(blexer('[Home](https://blex.me)'))
            .toContain('<p><a href="https://blex.me">Home</a></p>');
    });

    it('Bold', () => {
        expect(blexer('**Bold**')).toContain('<p><strong>Bold</strong></p>');
    });

    it('Italic', () => {
        expect(blexer('*Italic*')).toContain('<p><em>Italic</em></p>');
    });

    it('Strike', () => {
        expect(blexer('~~Strike~~')).toContain('<p><del>Strike</del></p>');
    });

    it('Quote', () => {
        expect(trimBetweenTags(blexer('> Quote')))
            .toContain('<blockquote><p>Quote</p></blockquote>');
    });

    it('List', () => {
        expect(trimBetweenTags(blexer([
            '- List',
            '- List'
        ].join('\n')))).toContain(trimBetweenTags(`
            <ul>
                <li>List</li>
                <li>List</li>
            </ul>
        `));

        expect(trimBetweenTags(blexer([
            '- List',
            '- List',
            '  - List',
            '  - List'
        ].join('\n')))).toContain(trimBetweenTags(`
            <ul>
                <li>List</li>
                <li>List
                    <ul>
                        <li>List</li>
                        <li>List</li>
                    </ul>
                </li>
            </ul>
        `));

        expect(trimBetweenTags(blexer([
            '1. List',
            '2. List'
        ].join('\n')))).toContain(trimBetweenTags(`
            <ol>
                <li>List</li>
                <li>List</li>
            </ol>
        `));

        expect(trimBetweenTags(blexer([
            '1. List',
            '2. List',
            '   1. List',
            '   2. List'
        ].join('\n')))).toContain(trimBetweenTags(`
            <ol>
                <li>List</li>
                <li>List
                    <ol>
                        <li>List</li>
                        <li>List</li>
                    </ol>
                </li>
            </ol>
        `));

        expect(blexer([
            '1. List',
            '1. List'
        ].join('\n'))).toBe(blexer([
            '1. List',
            '2. List'
        ].join('\n')));

        expect(trimBetweenTags(blexer([
            '- [ ] List',
            '- [x] List'
        ].join('\n')))).toContain(trimBetweenTags(`
            <ul>
                <li>
                    <input type="checkbox" disabled>List
                </li>
                <li>
                    <input type="checkbox" disabled checked>List
                </li>
            </ul>
        `));
    });

    it('Table', () => {
        expect(trimBetweenTags(blexer([
            '| Table Header 1 | Table Header 2 |',
            '| -------------- | -------------- |',
            '| Table Content 1 | Table Content 2 |'
        ].join('\n')))).toContain(trimBetweenTags(`
            <table>
                <thead>
                    <tr>
                        <th>Table Header 1</th>
                        <th>Table Header 2</th>
                    </tr>
                </thead>
                <tbody>
                    <tr>
                        <td>Table Content 1</td>
                        <td>Table Content 2</td>
                    </tr>
                </tbody>
            </table>
        `));
    });

    it('Code', () => {
        expect(blexer('`Code`'))
            .toContain('<p><code>Code</code></p>');
    });

    it('Code Block', () => {
        expect(blexer('```typescript\nconst a = 1;\n```'))
            .toContain('<pre><code class="language-typescript">const a = 1;\n</code></pre>');
    });

    it('Image', () => {
        expect(trimBetweenTags(blexer('![](https://blex.me/example.jpg)')))
            .toBe(trimBetweenTags(`
                <p>
                    <img class="lazy" data-src="https://blex.me/example.jpg" src="https://blex.me/example.jpg.preview.jpg" alt="">
                </p>
            `));
        expect(trimBetweenTags(blexer('![이미지1](https://blex.me/example.jpg)')))
            .toBe(trimBetweenTags(`
                <p>
                    <img class="lazy" data-src="https://blex.me/example.jpg" src="https://blex.me/example.jpg.preview.jpg" alt="이미지1">
                </p>
            `));
    });

    it('Grid Image', () => {
        expect(trimBetweenTags(blexer([
            '<grid-image col="2">',
            '![](https://blex.me/example1.jpg)',
            '![](https://blex.me/example2.jpg)',
            '</grid-image>'
        ].join('\n')))).toBe(trimBetweenTags(`
                <p>
                    <figure class="col-2">
                        <img class="lazy" data-src="https://blex.me/example1.jpg" src="https://blex.me/example1.jpg.preview.jpg" alt="">
                        <img class="lazy" data-src="https://blex.me/example2.jpg" src="https://blex.me/example2.jpg.preview.jpg" alt="">
                    </figure>
                </p>
            `));

        expect(trimBetweenTags(blexer([
            '<grid-image col="3">',
            '![](https://blex.me/example1.jpg)',
            '![](https://blex.me/example2.jpg)',
            '![](https://blex.me/example3.jpg)',
            '</grid-image>'
        ].join('\n')))).toBe(trimBetweenTags(`
                <p>
                    <figure class="col-3">
                        <img class="lazy" data-src="https://blex.me/example1.jpg" src="https://blex.me/example1.jpg.preview.jpg" alt="">
                        <img class="lazy" data-src="https://blex.me/example2.jpg" src="https://blex.me/example2.jpg.preview.jpg" alt="">
                        <img class="lazy" data-src="https://blex.me/example3.jpg" src="https://blex.me/example3.jpg.preview.jpg" alt="">
                    </figure>
                </p>
            `));

        expect(trimBetweenTags(blexer([
            '<grid-image col="2">',
            '![](https://blex.me/example1.jpg)',
            '![](https://blex.me/example2.jpg)',
            '<caption>이미지 설명</caption>',
            '</grid-image>'
        ].join('\n')))).toBe(trimBetweenTags(`
                <p>
                    <figure class="col-2">
                        <img class="lazy" data-src="https://blex.me/example1.jpg" src="https://blex.me/example1.jpg.preview.jpg" alt="">
                        <img class="lazy" data-src="https://blex.me/example2.jpg" src="https://blex.me/example2.jpg.preview.jpg" alt="">
                        <figcaption>이미지 설명</figcaption>
                    </figure>
                </p>
            `));
    });

    it('Video', () => {
        expect((blexer('@gif[https://blex.me/example.mp4]')))
            .toContain(trimBetweenTags(`
                <p>
                    <video class="lazy" autoplay muted loop playsinline poster="https://blex.me/example.mp4.preview.jpg">
                        <source data-src="https://blex.me/example.mp4" type="video/mp4"/>
                    </video>
                </p>
            `));
    });

    it('YouTube', () => {
        expect(trimBetweenTags(blexer('@youtube[id]')))
            .toContain(trimBetweenTags(`
                <p>
                    <iframe width="100%" height="350" src="https://www.youtube.com/embed/id" frameborder="0" allow="accelerometer; autoplay; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>
                </p>
            `));
    });
});
