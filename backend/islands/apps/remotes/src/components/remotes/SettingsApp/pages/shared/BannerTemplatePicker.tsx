import { useLingui } from '@lingui/react/macro';
import { Code2 } from '@blex/ui/icons';
import { cx } from '~/lib/classnames';
import type { BannerTemplate, BannerTemplateGalleryItem } from '~/lib/api/settings';
import { bannerTemplateMessages } from './bannerI18n';
import ScaledBannerHtml from './ScaledBannerHtml';
import { BANNER_SLOT_WIDTH } from './bannerTemplateRules';

const THUMBNAIL_HEIGHT = 220;

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
            style={{ height: THUMBNAIL_HEIGHT }}
            className="pointer-events-none flex items-center justify-center overflow-hidden border-b border-line-light bg-surface px-4">
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
        <div className="grid gap-4 sm:grid-cols-2">
            {gallery.map((item) => {
                const kind = item.bannerTypes[0];
                return (
                    <TemplateOption
                        key={item.template}
                        label={i18n._(bannerTemplateMessages[item.template])}
                        selected={value === item.template}
                        onSelect={() => onChange(item.template)}>
                        <ScaledBannerHtml
                            html={item.html}
                            slotWidth={BANNER_SLOT_WIDTH[kind]}
                            maxScale={kind === 'sidebar' ? 0.7 : 1}
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
