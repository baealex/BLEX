import { useState, useEffect } from 'react';
import {
    useFloating,
    autoUpdate,
    offset,
    flip,
    shift,
    hide,
    type Placement,
    type VirtualElement
} from '@floating-ui/react';

interface UseFloatingMenuOptions {
    placement?: Placement;
    offsetValue?: number;
    isVirtual?: boolean;
}

/**
 * 플로팅 메뉴를 위한 공통 훅
 * - 실제 DOM 요소와 가상 요소 모두 지원
 * - 스크롤/리사이즈 시 자동 위치 업데이트
 */
export function useFloatingMenu(options: UseFloatingMenuOptions = {}) {
    const {
        placement = 'top',
        offsetValue = 10,
        isVirtual = false
    } = options;

    const [isVisible, setIsVisible] = useState(false);
    const [referenceElement, setReferenceElement] = useState<Element | VirtualElement | null>(null);

    const { refs, floatingStyles, middlewareData, update } = useFloating({
        elements: { reference: referenceElement as Element },
        placement,
        strategy: 'fixed',
        middleware: [
            offset(offsetValue),
            flip({ fallbackPlacements: ['bottom', 'top'] }),
            shift({ padding: 8 }),
            hide()
        ],
        // 실제 DOM 요소인 경우에만 autoUpdate 사용
        ...(!isVirtual && {
            whileElementsMounted: (reference, floating, update) => {
                return autoUpdate(reference, floating, update, {
                    ancestorScroll: true,
                    ancestorResize: true,
                    elementResize: true,
                    layoutShift: true
                });
            }
        })
    });

    // 가상 요소인 경우 수동으로 스크롤/리사이즈 처리
    useEffect(() => {
        if (!isVirtual || !isVisible) return;

        const handleUpdate = () => {
            update();
        };

        window.addEventListener('scroll', handleUpdate, true);
        window.addEventListener('resize', handleUpdate);

        return () => {
            window.removeEventListener('scroll', handleUpdate, true);
            window.removeEventListener('resize', handleUpdate);
        };
    }, [isVirtual, isVisible, update]);

    const isHidden = middlewareData.hide?.referenceHidden;

    return {
        isVisible,
        setIsVisible,
        referenceElement,
        setReferenceElement,
        refs,
        floatingStyles,
        isHidden,
        update
    };
}
