import type { ComponentType } from 'react';
import { useLingui } from '@lingui/react/macro';
import { Code2, Megaphone, Signpost, UserRound } from '@blex/ui/icons';
import { cx } from '~/lib/classnames';
import type { BannerTemplate } from '~/lib/api/settings';
import { bannerTemplateDescriptions, bannerTemplateMessages } from './bannerI18n';

const templateIcons: Record<BannerTemplate, ComponentType<{ className?: string; 'aria-hidden'?: boolean }>> = {
    notice: Megaphone,
    card: Signpost,
    intro: UserRound,
    html: Code2
};

interface BannerTemplatePickerProps {
    options: BannerTemplate[];
    value: BannerTemplate | null;
    onChange: (template: BannerTemplate) => void;
}

const BannerTemplatePicker = ({ options, value, onChange }: BannerTemplatePickerProps) => {
    const { i18n, t } = useLingui();

    return (
        <div
            role="group"
            aria-label={t({
                id: 'settings.banners.editor.template.label',
                message: 'Template'
            })}
            className={cx('grid gap-2', options.length === 3 ? 'sm:grid-cols-3' : 'sm:grid-cols-2')}>
            {options.map((template) => {
                const selected = value === template;
                const Icon = templateIcons[template];

                return (
                    <button
                        key={template}
                        type="button"
                        aria-pressed={selected}
                        onClick={() => onChange(template)}
                        className={cx(
                            'flex min-h-11 items-start gap-3 rounded-xl border px-4 py-3 text-left transition-colors duration-150 active:scale-[0.98]',
                            selected
                                ? 'border-line-strong bg-surface-subtle ring-2 ring-line'
                                : 'border-line bg-surface hover:border-line-strong'
                        )}>
                        <span
                            className={cx(
                                'mt-0.5 flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
                                selected ? 'bg-action text-content-inverted' : 'bg-surface-subtle text-content-secondary'
                            )}>
                            <Icon aria-hidden className="h-4 w-4" />
                        </span>
                        <span className="min-w-0">
                            <span className="block text-sm font-semibold text-content">
                                {i18n._(bannerTemplateMessages[template])}
                            </span>
                            <span className="mt-0.5 block text-xs leading-relaxed text-content-secondary">
                                {i18n._(bannerTemplateDescriptions[template])}
                            </span>
                        </span>
                    </button>
                );
            })}
        </div>
    );
};

export default BannerTemplatePicker;
