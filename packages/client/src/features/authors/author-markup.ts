// Authored HTML stays out of the page data. These child chains start at the route content, so markup inside it cannot match them.
const overviewSections = ':scope > main > div > div > .space-y-14 > section';
export const authorAboutSelector = `${overviewSections} > .prose`;
export const authorAboutMarkdownSelector = `${overviewSections}[data-about-editor] > [data-about-form] > textarea`;
export const authorEditMarkdownSelector = ':scope > main > div > div > div > [data-about-page] > textarea';
export const seriesDescriptionSelector = ':scope > main > div > header > h1 + div';
