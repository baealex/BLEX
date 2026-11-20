import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import {
    bannerListSummary,
    imageLayoutForPosition,
    isTemplateAllowedAt,
    isToneAdjustable,
    isValidBannerLink,
    positionForTemplate,
    swapSampleCopy
} from '../src/components/remotes/SettingsApp/pages/shared/bannerTemplateRules.ts';

const cardSample = {
    eyebrow: '',
    headline: 'Did this post help?',
    description: 'Get new posts first.',
    linkLabel: 'Subscribe',
    linkUrl: '/@author'
};
const introSample = {
    eyebrow: 'Notice',
    headline: 'Hi, I am the author',
    description: 'I write about what I learn.',
    linkLabel: 'About me',
    linkUrl: '/@author'
};

describe('banner template placement', () => {
    test('each shape fits the slots it is designed for, custom HTML fits everywhere', () => {
        assert.equal(isTemplateAllowedAt('notice', 'top'), true);
        assert.equal(isTemplateAllowedAt('notice', 'right'), true);
        assert.equal(isTemplateAllowedAt('card', 'left'), true);
        assert.equal(isTemplateAllowedAt('callout', 'right'), false);
        assert.equal(isTemplateAllowedAt('profile', 'bottom'), false);
        assert.equal(isTemplateAllowedAt('profile', 'left'), true);
        assert.equal(isTemplateAllowedAt('html', 'left'), true);
    });

    test('choosing a template keeps a compatible position and otherwise uses its default', () => {
        assert.equal(positionForTemplate('card', 'top'), 'top');
        assert.equal(positionForTemplate('card', 'left'), 'left');
        assert.equal(positionForTemplate('callout', 'right'), 'top');
        assert.equal(positionForTemplate('profile', 'top'), 'right');
        assert.equal(positionForTemplate('notice', null), 'top');
        assert.equal(positionForTemplate('html', 'left'), 'left');
    });
});

describe('banner design options', () => {
    test('side-by-side images stack on top in the narrow sidebar', () => {
        assert.equal(imageLayoutForPosition('right', 'top'), 'right');
        assert.equal(imageLayoutForPosition('left', 'right'), 'top');
        assert.equal(imageLayoutForPosition('cover', 'left'), 'cover');
        assert.equal(imageLayoutForPosition('top', 'bottom'), 'top');
    });

    test('a background image replaces the surface style', () => {
        assert.equal(isToneAdjustable('card', '', 'cover'), true);
        assert.equal(isToneAdjustable('card', '/media/a.png', 'right'), true);
        assert.equal(isToneAdjustable('card', '/media/a.png', 'cover'), false);
        assert.equal(isToneAdjustable('image', '/media/a.png', 'right'), false);
        assert.equal(isToneAdjustable('html', '', 'right'), false);
    });
});

describe('banner sample copy', () => {
    test('fills empty fields with the chosen template sample', () => {
        const emptyCopy = {
            eyebrow: '',
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
            eyebrow: introSample.eyebrow,
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
