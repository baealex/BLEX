import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    bannerListSummary,
    isTemplateAllowedAt,
    isValidBannerLink,
    positionForTemplate,
    swapSampleCopy
} from '../src/components/remotes/SettingsApp/pages/shared/bannerTemplateRules.ts';

const cardSample = {
    headline: 'Did this post help?',
    description: 'Get new posts first.',
    linkLabel: 'Subscribe',
    linkUrl: '/@author'
};
const introSample = {
    headline: 'Hi, I am the author',
    description: 'I write about what I learn.',
    linkLabel: 'About me',
    linkUrl: '/@author'
};

describe('banner template placement', () => {
    test('text templates only fit their own slot type, custom HTML fits everywhere', () => {
        assert.equal(isTemplateAllowedAt('notice', 'top'), true);
        assert.equal(isTemplateAllowedAt('card', 'left'), false);
        assert.equal(isTemplateAllowedAt('intro', 'right'), true);
        assert.equal(isTemplateAllowedAt('intro', 'bottom'), false);
        assert.equal(isTemplateAllowedAt('html', 'left'), true);
        assert.equal(isTemplateAllowedAt('centered', 'right'), false);
        assert.equal(isTemplateAllowedAt('profile', 'left'), true);
    });

    test('image banners fit both the post body and the sidebar', () => {
        assert.equal(isTemplateAllowedAt('image', 'top'), true);
        assert.equal(isTemplateAllowedAt('image', 'right'), true);
    });

    test('choosing a template keeps a compatible position and otherwise uses its default', () => {
        assert.equal(positionForTemplate('card', 'top'), 'top');
        assert.equal(positionForTemplate('card', 'left'), 'bottom');
        assert.equal(positionForTemplate('intro', 'top'), 'right');
        assert.equal(positionForTemplate('notice', null), 'top');
        assert.equal(positionForTemplate('html', 'left'), 'left');
        assert.equal(positionForTemplate('image', 'left'), 'left');
        assert.equal(positionForTemplate('sidelink', 'bottom'), 'right');
    });
});

describe('banner sample copy', () => {
    test('fills empty fields with the chosen template sample', () => {
        const emptyCopy = {
            headline: '',
            description: ' ',
            linkLabel: '',
            linkUrl: ''
        };

        assert.deepEqual(swapSampleCopy(emptyCopy, null, cardSample), cardSample);
    });

    test('replaces untouched sample text but keeps text the user wrote', () => {
        const editedCopy = {
            ...cardSample,
            headline: 'My own headline'
        };

        assert.deepEqual(swapSampleCopy(editedCopy, cardSample, introSample), {
            headline: 'My own headline',
            description: introSample.description,
            linkLabel: introSample.linkLabel,
            linkUrl: introSample.linkUrl
        });
    });
});

describe('banner form helpers', () => {
    test('accepts site paths and web links only', () => {
        assert.equal(isValidBannerLink('/@author/post'), true);
        assert.equal(isValidBannerLink('https://example.com'), true);
        assert.equal(isValidBannerLink('//example.com'), false);
        assert.equal(isValidBannerLink('javascript:alert(1)'), false);
        assert.equal(isValidBannerLink('example.com'), false);
    });
});

describe('banner list summary', () => {
    const base = {
        title: 'Footer CTA',
        template: 'card',
        contentHtml: '',
        headline: 'Subscribe',
        description: 'Weekly notes',
        linkUrl: '/@author'
    };

    test('shows the headline when the name differs', () => {
        assert.equal(bannerListSummary(base), 'Subscribe');
    });

    test('falls back to description or link when the name is the headline', () => {
        const namedByHeadline = {
            ...base,
            title: 'Subscribe'
        };

        assert.equal(bannerListSummary(namedByHeadline), 'Weekly notes');
        assert.equal(bannerListSummary({
            ...namedByHeadline,
            description: ''
        }), '/@author');
    });

    test('shows the markup for custom HTML banners', () => {
        assert.equal(bannerListSummary({
            ...base,
            template: 'html',
            contentHtml: '<div>Ad</div>'
        }), '<div>Ad</div>');
    });
});
