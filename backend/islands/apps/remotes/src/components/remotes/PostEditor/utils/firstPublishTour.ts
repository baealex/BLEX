import type { DriveStep } from 'driver.js';

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
                title: '작성 내용은 자동으로 저장됩니다',
                description: '잠시 멈춰도 임시 글로 남습니다. 바로 저장하고 싶을 때만 임시 저장을 누르세요.',
                side: 'top',
                align: 'center'
            }
        },
        {
            element: tourTargets.settings,
            popover: {
                title: '선택 항목은 나중에 정해도 됩니다',
                description: 'URL, 설명, 시리즈, 비공개 여부는 여기에서 바꿉니다. 설명, 태그, 커버 이미지는 비워도 발행할 수 있습니다.',
                side: 'top',
                align: 'center'
            }
        },
        {
            element: tourTargets.publish,
            popover: {
                title: '발행 전 한 번 더 확인합니다',
                description: '제목과 본문 같은 필수 항목만 막습니다. 권장 항목은 나중에 보완해도 됩니다.',
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
        nextBtnText: '다음',
        prevBtnText: '이전',
        doneBtnText: '끝내기',
        onPopoverRender: (popover) => {
            popover.closeButton.setAttribute('aria-label', '가이드 닫기');
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
