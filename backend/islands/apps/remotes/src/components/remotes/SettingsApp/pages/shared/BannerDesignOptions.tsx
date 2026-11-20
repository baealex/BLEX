import type { ReactNode } from 'react';
import { cx } from '~/lib/classnames';
import type { BannerAlign, BannerImageLayout, BannerTone } from '~/lib/api/settings';

interface DesignOptionGroupProps<T extends string> {
    label: string;
    options: T[];
    value: T;
    getLabel: (option: T) => string;
    renderVisual: (option: T) => ReactNode;
    onChange: (option: T) => void;
}

/** A row of visual choices, like the property panel of a design tool. */
export const DesignOptionGroup = <T extends string>({
    label,
    options,
    value,
    getLabel,
    renderVisual,
    onChange
}: DesignOptionGroupProps<T>) => (
    <div role="group" aria-label={label}>
        <div className="mb-2 ml-1 text-sm font-medium text-content">{label}</div>
        <div className="flex flex-wrap gap-2">
            {options.map((option) => {
                const selected = option === value;
                return (
                    <button
                        key={option}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onChange(option)}
                        className={cx(
                            'flex w-20 flex-col items-center gap-1.5 rounded-xl border p-2 text-xs font-semibold transition-colors duration-150 active:scale-95',
                            selected
                                ? 'border-line-strong text-content ring-2 ring-line'
                                : 'border-line text-content-secondary hover:border-line-strong'
                        )}>
                        <span aria-hidden="true" className="flex h-8 w-full items-center justify-center">
                            {renderVisual(option)}
                        </span>
                        {getLabel(option)}
                    </button>
                );
            })}
        </div>
    </div>
);

const FRAME = {
    x: 0.5,
    y: 0.5,
    width: 43,
    height: 27,
    rx: 4
};

const TextLines = ({ x, y, widths, anchor = 'start' }: { x: number; y: number; widths: number[]; anchor?: 'start' | 'middle' }) => (
    <>
        {widths.map((width, index) => (
            <rect
                key={index}
                x={anchor === 'middle' ? x - width / 2 : x}
                y={y + index * 4.5}
                width={width}
                height={2.5}
                rx={1.25}
                fill="currentColor"
            />
        ))}
    </>
);

const Sketch = ({ children }: { children: ReactNode }) => (
    <svg viewBox="0 0 44 28" width={44} height={28} fill="none">
        <rect {...FRAME} stroke="currentColor" strokeOpacity={0.35} />
        {children}
    </svg>
);

export const ImageLayoutSketch = ({ layout }: { layout: BannerImageLayout }) => {
    const image = {
        fill: 'currentColor',
        fillOpacity: 0.22,
        rx: 2.5
    };

    if (layout === 'right' || layout === 'left') {
        const imageX = layout === 'right' ? 26 : 3;
        const textX = layout === 'right' ? 5 : 22;
        return (
            <Sketch>
                <rect
                    x={imageX}
                    y={3}
                    width={15}
                    height={22}
                    {...image}
                />
                <TextLines x={textX} y={8} widths={[16, 12, 8]} />
            </Sketch>
        );
    }

    if (layout === 'top') {
        return (
            <Sketch>
                <rect
                    x={3}
                    y={3}
                    width={38}
                    height={11}
                    {...image}
                />
                <TextLines x={5} y={17} widths={[20, 13]} />
            </Sketch>
        );
    }

    return (
        <Sketch>
            <rect
                x={3}
                y={3}
                width={38}
                height={22}
                {...image}
                fillOpacity={0.4}
            />
            <TextLines x={7} y={13} widths={[18, 12]} />
        </Sketch>
    );
};

export const AlignSketch = ({ align }: { align: BannerAlign }) => (
    <Sketch>
        {align === 'center'
            ? <TextLines x={22} y={8} widths={[20, 26, 12]} anchor="middle" />
            : <TextLines x={6} y={8} widths={[20, 26, 12]} />}
    </Sketch>
);

export const ToneSwatch = ({ tone }: { tone: BannerTone }) => (
    <span
        className={cx(
            'h-7 w-11 rounded-md border',
            tone === 'default' && 'border-line bg-surface-subtle',
            tone === 'outline' && 'border-line-strong bg-surface',
            tone === 'emphasis' && 'border-transparent bg-action'
        )}
    />
);
