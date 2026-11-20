import { useLingui } from '@lingui/react/macro';
import { Code2 } from '@blex/ui/icons';
import { cx } from '~/lib/classnames';
import type { BannerTemplate, BannerTemplateGalleryItem } from '~/lib/api/settings';
import { bannerTemplateMessages } from './bannerI18n';

/** Thumbnails render the real banner at slot width and scale it down, so the picker shows what readers see. */
const THUMBNAIL_SCALE = {
    horizontal: {
        width: 640,
        zoom: 0.38
    },
    sidebar: {
        width: 256,
        zoom: 0.5
    }
} as const;

interface TemplateOptionProps {
    label: string;
    selected: boolean;
    onSelect: () => void;
    children: React.ReactNode;
}

const TemplateOption = ({ label, selected, onSelect, children }: TemplateOptionProps) => (
    <div
        className={cx(
            'relative overflow-hidden rounded-xl border transition-colors duration-150',
            selected ? 'border-line-strong ring-2 ring-line' : 'border-line hover:border-line-strong'
        )}>
        <div
            inert
            aria-hidden="true"
            className="pointer-events-none flex h-36 items-center justify-center overflow-hidden border-b border-line-light bg-surface px-3">
            {children}
        </div>
        <div
            aria-hidden="true"
            className={cx('px-3 py-2.5 text-sm font-semibold', selected ? 'text-content' : 'text-content-secondary')}>
            {label}
        </div>
        <button
            type="button"
            aria-pressed={selected}
            onClick={onSelect}
            className="absolute inset-0 rounded-xl focus:outline-none focus-visible:ring-2 focus-visible:ring-action/30 active:bg-surface-subtle/40">
            <span className="sr-only">{label}</span>
        </button>
    </div>
);

interface BannerTemplatePickerProps {
    gallery: BannerTemplateGalleryItem[];
    allowHtml: boolean;
    value: BannerTemplate | null;
    onChange: (template: BannerTemplate) => void;
}

const BannerTemplatePicker = ({ gallery, allowHtml, value, onChange }: BannerTemplatePickerProps) => {
    const { i18n } = useLingui();

    return (
        <div className="grid gap-3 sm:grid-cols-2 md:grid-cols-3">
            {gallery.map((item) => {
                const kind = item.bannerTypes[0];
                return (
                    <TemplateOption
                        key={item.template}
                        label={i18n._(bannerTemplateMessages[item.template])}
                        selected={value === item.template}
                        onSelect={() => onChange(item.template)}>
                        <div
                            style={THUMBNAIL_SCALE[kind]}
                            dangerouslySetInnerHTML={{ __html: item.html }}
                        />
                    </TemplateOption>
                );
            })}
            {allowHtml && (
                <TemplateOption
                    label={i18n._(bannerTemplateMessages.html)}
                    selected={value === 'html'}
                    onSelect={() => onChange('html')}>
                    <Code2 className="h-8 w-8 text-content-hint" />
                </TemplateOption>
            )}
        </div>
    );
};

export default BannerTemplatePicker;
