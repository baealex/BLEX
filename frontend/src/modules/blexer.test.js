import blexer from './blexer';

test('blexer', () => {
    expect(blexer('# Hello World!')).toBe('<h2 id="hello-world">Hello World!</h2>');
    expect(blexer('## Hello World!')).toBe('<h2 id="hello-world">Hello World!</h2>');
    expect(blexer('### Hello World!')).toBe('<h4 id="hello-world">Hello World!</h4>');
    expect(blexer('#### Hello World!')).toBe('<h4 id="hello-world">Hello World!</h4>');
    expect(blexer('##### Hello World!')).toBe('<h6 id="hello-world">Hello World!</h6>');
    expect(blexer('###### Hello World!')).toBe('<h6 id="hello-world">Hello World!</h6>');
})