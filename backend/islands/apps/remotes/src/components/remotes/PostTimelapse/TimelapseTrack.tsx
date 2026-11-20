import { useRef, type KeyboardEvent, type PointerEvent } from 'react';

interface TimelapseTrackProps {
    /** Visible characters of each frame; drawn as the outline of the post growing. */
    lengths: number[];
    index: number;
    /** First frame saved after publishing, when earlier draft frames exist. */
    publishIndex: number | null;
    label: string;
    publishLabel: string;
    valueText: string;
    onSeek: (index: number) => void;
}

/** Tick dots get too dense to read beyond this many frames; the outline and current dot remain. */
const MAX_TICKS = 40;
const CHART_WIDTH = 1000;
const CHART_HEIGHT = 36;
const TICK_CLASS = 'absolute top-9 h-2 w-2 -translate-x-1/2 -translate-y-1/2 rounded-full transition-colors duration-300';

const TimelapseTrack = ({
    lengths,
    index,
    publishIndex,
    label,
    publishLabel,
    valueText,
    onSeek
}: TimelapseTrackProps) => {
    const trackRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);
    const last = lengths.length - 1;
    const percentOf = (frameIndex: number) => (last > 0 ? (frameIndex / last) * 100 : 0);
    const longest = Math.max(1, ...lengths);
    const points = lengths.map((length, frameIndex) => [
        (percentOf(frameIndex) / 100) * CHART_WIDTH,
        CHART_HEIGHT - 2 - (length / longest) * (CHART_HEIGHT - 6)
    ]);
    const outline = points.map(([x, y], pointIndex) => `${pointIndex ? 'L' : 'M'}${x.toFixed(1)},${y.toFixed(1)}`).join(' ');
    const area = `${outline} L${CHART_WIDTH},${CHART_HEIGHT} L0,${CHART_HEIGHT} Z`;

    const seekToPointer = (event: PointerEvent<HTMLDivElement>) => {
        const box = trackRef.current?.getBoundingClientRect();
        if (!box || box.width === 0) return;
        const ratio = Math.min(1, Math.max(0, (event.clientX - box.left) / box.width));
        const target = Math.round(ratio * last);
        if (target !== index) onSeek(target);
    };

    const handleKeyDown = (event: KeyboardEvent<HTMLDivElement>) => {
        const targets: Record<string, number> = {
            ArrowLeft: index - 1,
            ArrowDown: index - 1,
            ArrowRight: index + 1,
            ArrowUp: index + 1,
            Home: 0,
            End: last
        };
        const target = targets[event.key];
        if (target === undefined) return;
        event.preventDefault();
        onSeek(Math.min(last, Math.max(0, target)));
    };

    return (
        <div
            ref={trackRef}
            role="slider"
            tabIndex={0}
            aria-label={label}
            aria-valuemin={1}
            aria-valuemax={lengths.length}
            aria-valuenow={index + 1}
            aria-valuetext={valueText}
            onKeyDown={handleKeyDown}
            onPointerDown={(event) => {
                isDraggingRef.current = true;
                event.currentTarget.setPointerCapture(event.pointerId);
                seekToPointer(event);
            }}
            onPointerMove={(event) => {
                if (isDraggingRef.current) seekToPointer(event);
            }}
            onPointerUp={() => {
                isDraggingRef.current = false;
            }}
            onPointerCancel={() => {
                isDraggingRef.current = false;
            }}
            className="relative mx-1.5 mt-3 h-12 cursor-pointer touch-none rounded-md outline-none focus-visible:ring-2 focus-visible:ring-line-strong focus-visible:ring-offset-4 focus-visible:ring-offset-surface">
            <svg
                aria-hidden="true"
                viewBox={`0 0 ${CHART_WIDTH} ${CHART_HEIGHT}`}
                preserveAspectRatio="none"
                className="absolute inset-x-0 top-0 h-9 w-full overflow-visible">
                <path d={area} className="fill-surface-subtle" />
                <g
                    className="transition-[clip-path] duration-700 ease-out motion-reduce:transition-none"
                    style={{ clipPath: `inset(0 ${100 - percentOf(index)}% 0 0)` }}>
                    <path d={area} className="fill-line" />
                    <path
                        d={outline}
                        vectorEffect="non-scaling-stroke"
                        strokeWidth={1.5}
                        strokeLinejoin="round"
                        className="fill-none stroke-content"
                    />
                </g>
            </svg>
            <div aria-hidden="true" className="absolute inset-x-0 top-9 h-px bg-line" />
            {publishIndex !== null && publishIndex > 0 && (
                <div
                    aria-hidden="true"
                    className="pointer-events-none absolute -top-1 flex -translate-x-1/2 flex-col items-center"
                    style={{ left: `${(percentOf(publishIndex - 1) + percentOf(publishIndex)) / 2}%` }}>
                    <span className="rounded-md bg-surface-subtle px-1.5 py-px text-[11px] font-semibold text-content-secondary">
                        {publishLabel}
                    </span>
                    <span className="mt-0.5 h-5 border-l border-dashed border-line-strong" />
                </div>
            )}
            {lengths.length <= MAX_TICKS && lengths.map((_, frameIndex) => (
                <span
                    key={frameIndex}
                    aria-hidden="true"
                    className={`${TICK_CLASS} ${frameIndex < index ? 'bg-content' : 'bg-line-strong'}`}
                    style={{ left: `${percentOf(frameIndex)}%` }}
                />
            ))}
            <span
                aria-hidden="true"
                className="absolute top-9 h-3.5 w-3.5 -translate-x-1/2 -translate-y-1/2 rounded-full bg-content shadow-[0_0_0_4px_var(--color-surface),0_0_0_5px_var(--color-line-strong)] transition-[left] duration-300 ease-out motion-reduce:transition-none"
                style={{ left: `${percentOf(index)}%` }}
            />
        </div>
    );
};

export default TimelapseTrack;
