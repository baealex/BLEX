import { useEffect, useRef, useState } from 'react';

interface ScaledBannerHtmlProps {
    html: string;
    /** Width of the slot the banner is drawn at, such as the post body or the sidebar. */
    slotWidth: number;
    /** Below this width, draw the banner at its natural size, as readers on small screens see it. */
    naturalBelow?: number;
    /** Upper bound for the scale, for frames shorter than the banner. */
    maxScale?: number;
}

/**
 * Draws a banner at its real slot width and shrinks it only as much as the frame needs,
 * so a narrow frame shows the same layout readers get instead of a squeezed one.
 */
const ScaledBannerHtml = ({
    html,
    slotWidth,
    naturalBelow = 0,
    maxScale = 1
}: ScaledBannerHtmlProps) => {
    const frameRef = useRef<HTMLDivElement>(null);
    const [frameWidth, setFrameWidth] = useState(0);

    useEffect(() => {
        const frame = frameRef.current;
        if (!frame) {
            return;
        }

        const observer = new ResizeObserver(([entry]) => setFrameWidth(entry.contentRect.width));
        observer.observe(frame);
        return () => observer.disconnect();
    }, []);

    const isNatural = frameWidth > 0 && frameWidth < naturalBelow;
    const scale = frameWidth ? Math.min(maxScale, frameWidth / slotWidth) : 0;

    return (
        <div ref={frameRef} className="w-full">
            <div
                style={isNatural ? undefined : {
                    width: slotWidth,
                    margin: '0 auto',
                    zoom: scale || 1,
                    visibility: scale ? 'visible' : 'hidden'
                }}
                dangerouslySetInnerHTML={{ __html: html }}
            />
        </div>
    );
};

export default ScaledBannerHtml;
