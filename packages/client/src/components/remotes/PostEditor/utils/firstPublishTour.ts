import type { DriveStep } from 'driver.js';
import { i18n } from '~/i18n';

const tourTargets = {
    settings: '[data-tour="post-settings"]',
    autosave: '[data-tour="post-autosave"]',
    publish: '[data-tour="post-publish"]'
};

const hasTarget = (selector: string) => Boolean(document.querySelector(selector));

interface StartFirstPublishTourOptions {
    returnFocusTo?: HTMLElement | null;
}

const getOverlayColor = () => {
    const color = getComputedStyle(document.documentElement)
        .getPropertyValue('--color-content')
        .trim();

    return color || '#020617';
};

const getSteps = (): DriveStep[] => {
    const steps: DriveStep[] = [
        {
            element: tourTargets.autosave,
            popover: {
                title: i18n._({
                    id: 'editor.guide.autosave_title',
                    message: 'Your work is saved automatically'
                }),
                description: i18n._({
                    id: 'editor.guide.autosave_description',
                    message: 'Your work remains as a draft even if you pause. Use Save draft only when you want to save immediately.'
                }),
                side: 'top',
                align: 'center'
            }
        },
        {
            element: tourTargets.settings,
            popover: {
                title: i18n._({
                    id: 'editor.guide.settings_title',
                    message: 'Optional details can wait'
                }),
                description: i18n._({
                    id: 'editor.guide.settings_description',
                    message: 'Change the URL, description, series, and visibility here. You can publish without a description, tags, or cover image.'
                }),
                side: 'top',
                align: 'center'
            }
        },
        {
            element: tourTargets.publish,
            popover: {
                title: i18n._({
                    id: 'editor.guide.publish_title',
                    message: 'Review once more before publishing'
                }),
                description: i18n._({
                    id: 'editor.guide.publish_description',
                    message: 'Only required fields such as the title and content block publishing. Recommended fields can be added later.'
                }),
                side: 'top',
                align: 'end'
            }
        }
    ];

    return steps.filter(step => typeof step.element !== 'string' || hasTarget(step.element));
};

export const startFirstPublishTour = async (options: StartFirstPublishTourOptions = {}) => {
    const steps = getSteps();

    if (steps.length === 0) {
        return;
    }

    const [{ driver }] = await Promise.all([
        import('driver.js'),
        import('driver.js/dist/driver.css'),
        import('./firstPublishTour.css')
    ]);

    const firstPublishTour = driver({
        steps,
        animate: true,
        allowClose: true,
        allowKeyboardControl: true,
        disableActiveInteraction: true,
        overlayClickBehavior: 'close',
        overlayColor: getOverlayColor(),
        overlayOpacity: 0.58,
        popoverClass: 'blex-first-publish-tour',
        popoverOffset: 12,
        progressText: '{{current}} / {{total}}',
        showButtons: ['previous', 'next', 'close'],
        showProgress: true,
        smoothScroll: true,
        stagePadding: 8,
        stageRadius: 10,
        nextBtnText: i18n._({
            id: 'common.next',
            message: 'Next'
        }),
        prevBtnText: i18n._({
            id: 'common.previous',
            message: 'Previous'
        }),
        doneBtnText: i18n._({
            id: 'common.done',
            message: 'Done'
        }),
        onPopoverRender: (popover) => {
            popover.closeButton.setAttribute('aria-label', i18n._({
                id: 'editor.guide.close',
                message: 'Close guide'
            }));
        },
        onNextClick: (_, __, { driver: activeDriver }) => {
            activeDriver.moveNext();
        },
        onDestroyed: () => {
            options.returnFocusTo?.focus({ preventScroll: true });
        }
    });

    firstPublishTour.drive();
};
