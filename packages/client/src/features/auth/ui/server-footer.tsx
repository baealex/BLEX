/** The footer carries the site brand, which stays out of the page data, so the browser reuses the server's copy. */
export function serverFooter(content: Element) {
    const footer = content.querySelector(':scope > footer');
    if (!footer) throw new Error('The page footer is missing, so the page stays as server HTML.');
    return <footer className={footer.className} dangerouslySetInnerHTML={{ __html: footer.innerHTML }} />;
}
