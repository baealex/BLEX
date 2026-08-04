import { useState, useEffect } from 'react';
import type { DragEndEvent } from '@dnd-kit/core';
import { Trans, useLingui } from '@lingui/react/macro';
import {
    DndContext,
    closestCenter,
    KeyboardSensor,
    PointerSensor,
    useSensor,
    useSensors,
    TouchSensor
} from '@dnd-kit/core';
import {
    arrayMove,
    SortableContext,
    sortableKeyboardCoordinates,
    verticalListSortingStrategy
} from '@dnd-kit/sortable';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { restrictToVerticalAxis, restrictToFirstScrollableAncestor } from '@dnd-kit/modifiers';
import {
    BriefcaseBusiness,
    Camera,
    ChevronDown,
    Code2,
    GripVertical,
    Link,
    MessageCircle,
    Play,
    Plus,
    Save,
    Send,
    Share2,
    Users,
    X,
    type LucideIcon
} from '@blex/ui/icons';
import { toast } from '~/utils/toast';
import { useSuspenseQuery } from '@tanstack/react-query';
import { SettingsEmptyState, SettingsHeader } from '../../components';
import { Button, Input, Dropdown } from '~/components/shared';
import { settingsCompactSelectTriggerStyles } from '~/styles/settingsStyles';
import { getSocialLinks, updateSocialLinks, type SocialLink as ApiSocialLink } from '~/lib/api/settings';

interface SocialLink extends ApiSocialLink {
    prepare?: boolean;
}

interface SocialLinkItemProps {
    social: SocialLink;
    index: number;
    onRemove: (id: number) => void;
    onChange: (index: number, field: 'name' | 'value', value: string) => void;
}

const getPlatformIcon = (name: string): LucideIcon => {
    const iconMap: Record<string, LucideIcon> = {
        github: Code2,
        twitter: MessageCircle,
        facebook: Users,
        telegram: Send,
        instagram: Camera,
        linkedin: BriefcaseBusiness,
        youtube: Play,
        other: Link
    };
    return iconMap[name] || Link;
};

const SocialLinkItem = ({ social, index, onRemove, onChange }: SocialLinkItemProps) => {
    const { i18n, t } = useLingui();
    const {
        attributes,
        listeners,
        setNodeRef,
        transform,
        transition
    } = useSortable({ id: social.id });

    const style = {
        transform: CSS.Transform.toString(transform),
        transition
    };

    const platformOptions = [
        {
            label: t({
                id: 'settings.social_links.platform.select',
                message: 'Select platform'
            }),
            value: ''
        },
        {
            label: t({
                id: 'settings.social_links.platform.github',
                message: 'GitHub'
            }),
            value: 'github'
        },
        {
            label: t({
                id: 'settings.social_links.platform.twitter',
                message: 'Twitter'
            }),
            value: 'twitter'
        },
        {
            label: t({
                id: 'settings.social_links.platform.facebook',
                message: 'Facebook'
            }),
            value: 'facebook'
        },
        {
            label: t({
                id: 'settings.social_links.platform.telegram',
                message: 'Telegram'
            }),
            value: 'telegram'
        },
        {
            label: t({
                id: 'settings.social_links.platform.instagram',
                message: 'Instagram'
            }),
            value: 'instagram'
        },
        {
            label: t({
                id: 'settings.social_links.platform.linkedin',
                message: 'LinkedIn'
            }),
            value: 'linkedin'
        },
        {
            label: t({
                id: 'settings.social_links.platform.youtube',
                message: 'YouTube'
            }),
            value: 'youtube'
        },
        {
            label: t({
                id: 'settings.social_links.platform.other',
                message: 'Other'
            }),
            value: 'other'
        }
    ];

    const currentPlatform = platformOptions.find(opt => opt.value === social.name);
    const socialLinkLabel = t({
        id: 'settings.social_links.item.label',
        message: 'Social link'
    });
    const currentPlatformLabel = currentPlatform?.label || socialLinkLabel;
    const reorderLabel = i18n._({
        id: 'settings.social_links.item.reorder',
        message: 'Change order of social link {position}',
        values: { position: index + 1 }
    });
    const removeLabel = i18n._({
        id: 'settings.social_links.item.remove',
        message: 'Remove {platform}',
        values: { platform: currentPlatformLabel }
    });
    const PlatformIcon = getPlatformIcon(social.name);
    const platformInputId = `social-platform-${social.id}`;
    const linkInputId = `social-link-${social.id}`;

    return (
        <div ref={setNodeRef} style={style} className="mb-4">
            <div className="bg-surface border border-line rounded-2xl transition-all duration-300 group overflow-hidden">
                {/* Mobile item header */}
                <div className="flex items-center justify-between p-4 sm:hidden bg-surface-subtle border-b border-line/60">
                    <div className="flex items-center gap-3">
                        <div
                            className="flex min-h-11 min-w-11 cursor-grab touch-none items-center justify-center rounded-lg text-content-hint transition-colors hover:bg-surface-subtle hover:text-content-secondary active:cursor-grabbing"
                            style={{ touchAction: 'none' }}
                            {...attributes}
                            {...listeners}
                            aria-label={reorderLabel}>
                            <GripVertical aria-hidden="true" className="h-4 w-4" />
                        </div>
                        <div className="w-8 h-8 flex items-center justify-center bg-surface rounded-lg shadow-sm">
                            <PlatformIcon aria-hidden="true" className="h-4 w-4 text-content-secondary" />
                        </div>
                        <span className="text-sm font-medium text-content">
                            <Trans id="settings.social_links.item.label">Social link</Trans>
                        </span>
                    </div>
                    <button
                        type="button"
                        aria-label={removeLabel}
                        className="flex min-h-11 min-w-11 items-center justify-center rounded-lg text-content-hint transition-all duration-200 hover:bg-surface-subtle hover:text-content-secondary"
                        onClick={() => onRemove(social.id)}>
                        <X aria-hidden="true" className="h-4 w-4" />
                    </button>
                </div>

                {/* Item controls */}
                <div className="p-4 flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-3">
                    {/* Desktop drag handle */}
                    <div
                        className="hidden min-h-11 min-w-11 flex-shrink-0 cursor-grab items-center justify-center rounded-lg text-content-hint transition-colors hover:bg-surface-subtle hover:text-content-secondary group-hover:text-content-secondary active:cursor-grabbing sm:flex [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:min-w-9"
                        style={{ touchAction: 'none' }}
                        {...attributes}
                        {...listeners}
                        aria-label={reorderLabel}>
                        <GripVertical aria-hidden="true" className="h-4 w-4" />
                    </div>

                    {/* Desktop platform icon */}
                    <div className="hidden sm:flex w-10 h-10 items-center justify-center bg-gradient-to-br from-surface-subtle to-surface-subtle rounded-lg shadow-sm group-hover:from-surface-subtle group-hover:to-surface-subtle transition-all duration-200 flex-shrink-0">
                        <PlatformIcon
                            aria-hidden="true"
                            className="h-5 w-5 text-content-secondary transition-colors group-hover:text-content-secondary"
                        />
                    </div>

                    {/* Platform selector */}
                    <div className="w-full sm:w-44 flex-shrink-0">
                        <label htmlFor={platformInputId} className="block text-xs font-medium text-content-secondary mb-2 sm:hidden">
                            <Trans id="settings.social_links.platform.label">Platform</Trans>
                        </label>
                        <Dropdown
                            density="compact"
                            trigger={
                                <button id={platformInputId} type="button" className={`${settingsCompactSelectTriggerStyles} flex items-center justify-between`}>
                                    <span className={!social.name ? 'text-content-hint' : 'text-content'}>
                                        {currentPlatform?.label || platformOptions[0].label}
                                    </span>
                                    <ChevronDown aria-hidden="true" className="h-4 w-4 text-content-hint" />
                                </button>
                            }
                            items={platformOptions.map(opt => ({
                                label: opt.label,
                                onClick: () => onChange(index, 'name', opt.value),
                                checked: social.name === opt.value
                            }))}
                            align="start"
                        />
                    </div>

                    {/* Link URL */}
                    <div className="flex-1">
                        <label htmlFor={linkInputId} className="block text-xs font-medium text-content-secondary mb-2 sm:hidden">
                            <Trans id="settings.social_links.url.label">Link URL</Trans>
                        </label>
                        <Input
                            id={linkInputId}
                            type="url"
                            density="compact"
                            placeholder="https://example.com"
                            value={social.value}
                            onChange={(e) => onChange(index, 'value', e.target.value)}
                        />
                    </div>

                    {/* Desktop remove button */}
                    <button
                        type="button"
                        aria-label={removeLabel}
                        className="hidden min-h-11 min-w-11 flex-shrink-0 items-center justify-center rounded-lg text-content-hint transition-all duration-200 hover:bg-surface-subtle hover:text-content-secondary group/btn sm:flex [@media(pointer:fine)]:min-h-9 [@media(pointer:fine)]:min-w-9"
                        onClick={() => onRemove(social.id)}>
                        <X
                            aria-hidden="true"
                            className="h-4 w-4 transition-transform group-hover/btn:scale-110"
                        />
                    </button>
                </div>
            </div>
        </div>
    );
};

const SocialLinks = () => {
    const { t } = useLingui();
    const [socials, setSocials] = useState<SocialLink[]>([]);
    const [originalSocials, setOriginalSocials] = useState<SocialLink[]>([]);
    const [isLoading, setIsLoading] = useState(false);
    const hasPendingDeletion = originalSocials.some(
        (original) => !socials.some((current) => current.id === original.id)
    );
    const shouldShowActions = socials.length > 0 || hasPendingDeletion;

    const { data: socialData } = useSuspenseQuery({
        queryKey: ['social-links-setting'],
        queryFn: async () => {
            const { data } = await getSocialLinks();
            if (data.status === 'DONE') {
                return data.body.social || [];
            }
            throw new Error(t({
                id: 'settings.social_links.load_failed',
                message: 'Could not load social links.'
            }));
        }
    });

    useEffect(() => {
        if (socialData) {
            const mappedSocials = socialData.map((social: SocialLink) => ({
                ...social,
                prepare: false
            }));
            setSocials(mappedSocials);
            setOriginalSocials(mappedSocials);
        }
    }, [socialData]);

    const sensors = useSensors(
        useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
        useSensor(TouchSensor, {
            activationConstraint: {
                delay: 200,
                tolerance: 5
            }
        }),
        useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates })
    );

    const handleDragEnd = (event: DragEndEvent) => {
        const { active, over } = event;

        if (active.id !== over?.id) {
            setSocials((items) => {
                const oldIndex = items.findIndex(item => item.id === active.id);
                const newIndex = items.findIndex(item => item.id === over?.id);

                const newItems = arrayMove(items, oldIndex, newIndex);
                return newItems.map((item, index) => ({
                    ...item,
                    order: index + 1
                }));
            });
        }
    };

    const handleSocialChange = (index: number, field: 'name' | 'value', value: string) => {
        setSocials(prev => {
            const newSocials = [...prev];
            newSocials[index][field] = value;
            return newSocials;
        });
    };

    const handleSocialAdd = () => {
        setSocials([...socials, {
            id: Math.random(),
            name: '',
            value: '',
            order: socials.length + 1,
            prepare: true
        }]);
    };

    const handleSocialRemove = (id: number) => {
        setSocials(socials.filter(social => social.id !== id));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setIsLoading(true);

        try {
            if (socials.some((social) => !social.name)) {
                toast.error(t({
                    id: 'settings.social_links.validation.platform_required',
                    message: 'Select a platform for every social link.'
                }));
                setIsLoading(false);
                return;
            }

            if (socials.some((social) => !social.value)) {
                toast.error(t({
                    id: 'settings.social_links.validation.url_required',
                    message: 'Enter a URL for every social link.'
                }));
                setIsLoading(false);
                return;
            }

            if (socials.some((social) => !social.value.startsWith('https://'))) {
                toast.error(t({
                    id: 'settings.social_links.validation.https_required',
                    message: 'Social link URLs must start with https://.'
                }));
                setIsLoading(false);
                return;
            }

            if (socials.some((social) => social.value.includes(',') || social.value.includes('&'))) {
                toast.error(t({
                    id: 'settings.social_links.validation.forbidden_separators',
                    message: 'Social link URLs cannot contain commas or ampersands.'
                }));
                setIsLoading(false);
                return;
            }

            const updateItems = socials.filter((social) => !social.prepare);
            const createItems = socials.filter((social) => social.prepare);

            // Find persisted items that were removed locally.
            const deletedItems = originalSocials.filter(
                (original) => !socials.some((current) => current.id === original.id)
            );

            const { data } = await updateSocialLinks({
                update: updateItems.map((item) => `${item.id},${item.name},${item.value},${item.order}`).join('&'),
                create: createItems.map((item) => `${item.name},${item.value},${item.order}`).join('&'),
                delete: deletedItems.map((item) => item.id).join('&')
            });

            if (data.status === 'DONE') {
                toast.success(t({
                    id: 'settings.social_links.update_success',
                    message: 'Social links updated.'
                }));
                const updatedSocials = (data.body as SocialLink[]).map((social) => ({
                    ...social,
                    prepare: false
                }));
                setSocials(updatedSocials);
                setOriginalSocials(updatedSocials);
            } else {
                toast.error(data.errorMessage || t({
                    id: 'settings.social_links.update_failed',
                    message: 'Could not update social links.'
                }));
            }
        } catch {
            toast.error(t({
                id: 'settings.social_links.update_failed',
                message: 'Could not update social links.'
            }));
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div>
            <SettingsHeader
                title={t({
                    id: 'settings.social_links.title',
                    message: 'Social links'
                })}
                description={t({
                    id: 'settings.social_links.description',
                    message: 'Displayed on your profile. Drag to change the order.'
                })}
            />

            <form onSubmit={handleSubmit}>
                <div className="mb-6">
                    {socials.length === 0 ? (
                        <SettingsEmptyState
                            icon={<Share2 aria-hidden="true" className="h-5 w-5" />}
                            title={t({
                                id: 'settings.social_links.empty',
                                message: 'No social links yet'
                            })}
                            action={(
                                <Button
                                    density="compact"
                                    type="button"
                                    variant="secondary"
                                    size="md"
                                    className="min-h-11! [@media(pointer:fine)]:min-h-10!"
                                    onClick={handleSocialAdd}>
                                    <Trans id="settings.social_links.add_first">
                                        Add a social link
                                    </Trans>
                                </Button>
                            )}
                        />
                    ) : (
                        <DndContext
                            sensors={sensors}
                            modifiers={[restrictToVerticalAxis, restrictToFirstScrollableAncestor]}
                            collisionDetection={closestCenter}
                            onDragEnd={handleDragEnd}>
                            <SortableContext
                                items={socials.map(social => social.id)}
                                strategy={verticalListSortingStrategy}>
                                {socials.map((social, index) => (
                                    <SocialLinkItem
                                        key={social.id}
                                        social={social}
                                        index={index}
                                        onRemove={handleSocialRemove}
                                        onChange={handleSocialChange}
                                    />
                                ))}
                            </SortableContext>
                        </DndContext>
                    )}
                </div>

                {shouldShowActions && (
                    <div className="flex flex-col sm:flex-row gap-3 sm:justify-between border-t border-line pt-6">
                        <Button
                            density="compact"
                            type="button"
                            variant="secondary"
                            size="md"
                            leftIcon={<Plus aria-hidden="true" className="h-4 w-4" />}
                            onClick={handleSocialAdd}
                            className="min-h-11! [@media(pointer:fine)]:min-h-10! sm:w-auto">
                            <Trans id="settings.social_links.add">Add link</Trans>
                        </Button>
                        <Button
                            density="compact"
                            type="submit"
                            variant="primary"
                            size="md"
                            isLoading={isLoading}
                            leftIcon={!isLoading ? <Save aria-hidden="true" className="h-4 w-4" /> : undefined}
                            className="min-h-11! [@media(pointer:fine)]:min-h-10! sm:w-auto">
                            {isLoading
                                ? t({
                                    id: 'settings.social_links.saving',
                                    message: 'Saving...'
                                })
                                : t({
                                    id: 'settings.social_links.save',
                                    message: 'Save changes'
                                })}
                        </Button>
                    </div>
                )}
            </form>
        </div>
    );
};

export default SocialLinks;
