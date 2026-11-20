import {
 useEffect, useEffectEvent, useRef, useState, type RefObject
} from 'react';
import { useLingui } from '@lingui/react/macro';
import { IconButton } from '@blex/ui/icon-button';
import { Pause, Play, RotateCcw, X } from '@blex/ui/icons';
import { normalizeLocale } from '~/i18n/locale';
import type { PostTimelapse } from '~/lib/api/posts';
import { diffFrames, measureFrame, summarizeDiff } from './timelapseDiff';
import {
    focusChange,
    parseFrameHtml,
    playStep,
    renderDiff,
    renderFrame,
    wait,
    type TimelapseStage
} from './timelapseStage';
import TimelapseTrack from './TimelapseTrack';

interface TimelapsePlayerProps {
    timelapse: PostTimelapse;
    scrollerRef: RefObject<HTMLDivElement | null>;
    onClose: () => void;
}

/** Let the first save settle on screen before the replay starts. */
const AUTOPLAY_DELAY = 900;
const RESTART_DELAY = 700;

const prefersReducedMotion = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches;

const TimelapsePlayer = ({ timelapse, scrollerRef, onClose }: TimelapsePlayerProps) => {
    const { i18n, t } = useLingui();
    const { frames } = timelapse;
    const last = frames.length - 1;
    const parsedFrames = frames.map((frame) => parseFrameHtml(frame.title, frame.contentHtml));
    const lengths = parsedFrames.map(measureFrame);
    const publishIndexCandidate = frames.findIndex((frame, frameIndex) => (
        frameIndex > 0 && frame.stage === 'published' && frames[frameIndex - 1].stage === 'draft'
    ));
    const publishIndex = publishIndexCandidate === -1 ? null : publishIndexCandidate;

    const [index, setIndex] = useState(0);
    const [isPlaying, setIsPlaying] = useState(false);
    const [speed, setSpeed] = useState(1);
    const titleRef = useRef<HTMLHeadingElement>(null);
    const contentRef = useRef<HTMLDivElement>(null);
    const indexRef = useRef(0);
    const speedRef = useRef(1);
    const playbackRef = useRef<AbortController | null>(null);
    const autoplayTimerRef = useRef<number | null>(null);

    const getStage = (): TimelapseStage | null => {
        const title = titleRef.current;
        const content = contentRef.current;
        const scroller = scrollerRef.current;
        if (!title || !content || !scroller) return null;
        return {
            title,
            content,
            scroller
        };
    };

    const moveTo = (target: number) => {
        indexRef.current = target;
        setIndex(target);
    };

    /** Also cancels the pending autoplay, so a seek right after opening is not overridden. */
    const stopPlayback = () => {
        if (autoplayTimerRef.current !== null) {
            window.clearTimeout(autoplayTimerRef.current);
            autoplayTimerRef.current = null;
        }
        playbackRef.current?.abort();
        playbackRef.current = null;
    };

    const showFrame = (target: number) => {
        const stage = getStage();
        if (!stage) return;
        if (target === 0) {
            renderFrame(stage, frames[0].title, frames[0].contentHtml);
            stage.scroller.scrollTo({ top: 0 });
            return;
        }
        renderDiff(stage, diffFrames(parsedFrames[target - 1], parsedFrames[target]), 'static');
        focusChange(stage, prefersReducedMotion());
    };

    const seek = (target: number) => {
        stopPlayback();
        setIsPlaying(false);
        moveTo(target);
        showFrame(target);
    };

    const play = async () => {
        const stage = getStage();
        if (!stage || last < 1) return;
        stopPlayback();
        const controller = new AbortController();
        playbackRef.current = controller;
        setIsPlaying(true);

        const reducedMotion = prefersReducedMotion();
        const isRestart = indexRef.current >= last;
        let current = isRestart ? 0 : indexRef.current;
        moveTo(current);
        renderFrame(stage, frames[current].title, frames[current].contentHtml);
        if (isRestart) {
            stage.scroller.scrollTo({
                top: 0,
                behavior: reducedMotion ? 'auto' : 'smooth'
            });
            if (!await wait(RESTART_DELAY, controller.signal)) return;
        }

        while (current < last) {
            const next = current + 1;
            moveTo(next);
            const finished = await playStep({
                stage,
                diff: diffFrames(parsedFrames[current], parsedFrames[next]),
                signal: controller.signal,
                getSpeed: () => speedRef.current,
                reducedMotion
            });
            if (!finished) return;
            current = next;
        }

        renderFrame(stage, frames[last].title, frames[last].contentHtml);
        playbackRef.current = null;
        setIsPlaying(false);
    };

    const pause = () => seek(indexRef.current);

    const startOnOpen = useEffectEvent(() => {
        const stage = getStage();
        if (stage) renderFrame(stage, frames[0].title, frames[0].contentHtml);
        if (last < 1) return;
        autoplayTimerRef.current = window.setTimeout(() => {
            autoplayTimerRef.current = null;
            void play();
        }, AUTOPLAY_DELAY);
    });

    const stopOnClose = useEffectEvent(() => stopPlayback());

    useEffect(() => {
        startOnOpen();
        return () => stopOnClose();
    }, []);

    const locale = normalizeLocale(i18n.locale);
    const formatDate = (value: string, withTime: boolean) => {
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return value;
        return new Intl.DateTimeFormat(locale, {
            year: date.getFullYear() === new Date().getFullYear() ? undefined : 'numeric',
            month: 'short',
            day: 'numeric',
            hour: withTime ? 'numeric' : undefined,
            minute: withTime ? '2-digit' : undefined
        }).format(date);
    };

    const summary = index > 0 ? summarizeDiff(diffFrames(parsedFrames[index - 1], parsedFrames[index])) : null;
    const describeSave = () => {
        if (!summary) {
            return t({
                id: 'post_timelapse.change.first_save',
                message: 'First save'
            });
        }
        const parts: string[] = [];
        if (summary.titleChanged) {
            parts.push(t({
                id: 'post_timelapse.change.title',
                message: 'Changed the title'
            }));
        }
        const [firstSection] = summary.addedSections;
        if (summary.addedSections.length > 1) {
            parts.push(i18n._({
                id: 'post_timelapse.change.added_sections',
                message: '{count, plural, one {Added # section} other {Added # sections}}',
                values: { count: summary.addedSections.length }
            }));
        } else if (firstSection !== undefined) {
            parts.push(i18n._({
                id: 'post_timelapse.change.added_section',
                message: 'Added the “{name}” section',
                values: { name: firstSection }
            }));
        } else {
            if (summary.rewritten) {
                parts.push(i18n._({
                    id: 'post_timelapse.change.rewrote_paragraphs',
                    message: '{count, plural, one {Rewrote # paragraph} other {Rewrote # paragraphs}}',
                    values: { count: summary.rewritten }
                }));
            }
            if (summary.added) {
                parts.push(i18n._({
                    id: 'post_timelapse.change.added_paragraphs',
                    message: '{count, plural, one {Added # paragraph} other {Added # paragraphs}}',
                    values: { count: summary.added }
                }));
            }
        }
        if (summary.removed) {
            parts.push(i18n._({
                id: 'post_timelapse.change.removed_paragraphs',
                message: '{count, plural, one {Removed # paragraph} other {Removed # paragraphs}}',
                values: { count: summary.removed }
            }));
        }
        if (summary.edited) {
            parts.push(t({
                id: 'post_timelapse.change.polished',
                message: 'Polished the wording'
            }));
        }
        return parts.slice(0, 2).join(' · ') || t({
            id: 'post_timelapse.change.formatting',
            message: 'Adjusted the formatting'
        });
    };

    let badge: string | null = null;
    if (index === last) {
        badge = t({
            id: 'post_timelapse.badge.current',
            message: 'Current post'
        });
    } else if (frames[index].stage === 'draft') {
        badge = t({
            id: 'post_timelapse.badge.draft',
            message: 'Draft'
        });
    } else if (publishIndex !== null) {
        badge = t({
            id: 'post_timelapse.badge.after_publishing',
            message: 'After publishing'
        });
    }

    const insertedCharacters = summary ? summary.insertedCharacters : lengths[0];
    const deletedCharacters = summary ? summary.deletedCharacters : 0;
    const savePosition = i18n._({
        id: 'post_timelapse.save_position',
        message: 'Save {current} of {total}',
        values: {
 current: index + 1,
total: frames.length
}
    });
    const savedAt = formatDate(frames[index].savedAt, true);
    const isFinished = index === last && !isPlaying;

    let playLabel = t({
        id: 'post_timelapse.play',
        message: 'Play'
    });
    if (isPlaying) {
        playLabel = t({
            id: 'post_timelapse.pause',
            message: 'Pause'
        });
    } else if (isFinished) {
        playLabel = t({
            id: 'post_timelapse.replay',
            message: 'Replay from the first save'
        });
    }
    let PlayIcon = Play;
    if (isPlaying) PlayIcon = Pause;
    else if (isFinished) PlayIcon = RotateCcw;

    return (
        <>
            {/* Same layout classes as the post page, so the text wraps at the same width on every screen. */}
            <div className="post-timelapse-body post-detail-body px-4 md:px-6">
                <div className="post-detail-layout">
                    <div aria-hidden="true" className="post-detail-sidebar" />
                    <article className="post-detail-main">
                        <h1
                            ref={titleRef}
                            className="mb-8 break-words text-2xl font-bold leading-tight text-content sm:text-3xl lg:text-4xl"
                        />
                        <div ref={contentRef} className="post-timelapse-stage prose prose-lg max-w-none blog-post-content break-words" />
                        {last < 1 && (
                            <p className="mt-10 rounded-lg bg-surface-subtle p-4 text-sm text-content-secondary">
                                {t({
                                    id: 'post_timelapse.empty',
                                    message: 'There are no text changes to replay yet.'
                                })}
                            </p>
                        )}
                    </article>
                    <div aria-hidden="true" className="post-detail-sidebar" />
                </div>
            </div>

            <div className="post-timelapse-dock pointer-events-none fixed inset-x-0 bottom-0 px-4">
                <section
                    aria-label={t({
                        id: 'post_timelapse.controls',
                        message: 'Replay controls'
                    })}
                    className="post-timelapse-bar pointer-events-auto mx-auto w-full max-w-3xl rounded-2xl border border-line bg-surface px-4 pt-4 shadow-floating sm:px-5">
                    <div className="flex items-center gap-3">
                        <button
                            type="button"
                            disabled={last < 1}
                            aria-label={playLabel}
                            title={playLabel}
                            onClick={() => (isPlaying ? pause() : void play())}
                            className="grid h-11 w-11 shrink-0 place-items-center rounded-full bg-action text-content-inverted transition-all duration-150 hover:bg-action-hover active:scale-95 disabled:opacity-40">
                            <PlayIcon aria-hidden="true" className="h-5 w-5" fill={PlayIcon === RotateCcw ? 'none' : 'currentColor'} />
                        </button>
                        <div className="min-w-0 flex-1">
                            <div className="flex min-w-0 items-center gap-2">
                                <p className="truncate text-sm font-semibold text-content">{describeSave()}</p>
                                {badge && (
                                    <span className="shrink-0 rounded-md border border-line px-2 py-0.5 text-xs font-semibold text-content-secondary">
                                        {badge}
                                    </span>
                                )}
                            </div>
                            <p className="mt-0.5 flex flex-wrap items-center gap-x-2 text-xs text-content-secondary tabular-nums">
                                <span>{savedAt}</span>
                                <span aria-hidden="true" className="text-line-strong">·</span>
                                <span>{savePosition}</span>
                                <span aria-hidden="true" className="text-line-strong">·</span>
                                <span className="text-success">
                                    {i18n._({
                                        id: 'post_timelapse.inserted_characters',
                                        message: '{count, plural, one {+# char} other {+# chars}}',
                                        values: { count: insertedCharacters }
                                    })}
                                </span>
                                {deletedCharacters > 0 && (
                                    <span className="text-danger">
                                        {i18n._({
                                            id: 'post_timelapse.deleted_characters',
                                            message: '{count, plural, one {−# char} other {−# chars}}',
                                            values: { count: deletedCharacters }
                                        })}
                                    </span>
                                )}
                            </p>
                        </div>
                        <button
                            type="button"
                            aria-label={t({
                                id: 'post_timelapse.speed',
                                message: 'Playback speed'
                            })}
                            onClick={() => {
                                const nextSpeed = speed === 1 ? 2 : 1;
                                speedRef.current = nextSpeed;
                                setSpeed(nextSpeed);
                            }}
                            className="post-timelapse-speed h-9 shrink-0 rounded-lg px-2 text-sm font-semibold text-content-secondary tabular-nums transition-all duration-150 hover:bg-surface-subtle hover:text-content active:scale-95">
                            {speed}×
                        </button>
                        <IconButton
                            size="sm"
                            aria-label={t({
                                id: 'post_timelapse.close',
                                message: 'Close'
                            })}
                            onClick={() => {
                                stopPlayback();
                                onClose();
                            }}>
                            <X className="h-5 w-5" />
                        </IconButton>
                    </div>

                    {last > 0 && (
                        <>
                            <TimelapseTrack
                                lengths={lengths}
                                index={index}
                                publishIndex={publishIndex}
                                label={t({
                                    id: 'post_timelapse.timeline',
                                    message: 'Saved versions'
                                })}
                                publishLabel={t({
                                    id: 'post_timelapse.published_marker',
                                    message: 'Published'
                                })}
                                valueText={`${savePosition}, ${savedAt}`}
                                onSeek={seek}
                            />
                            <div className="mt-1 flex justify-between gap-3 text-xs text-content-hint">
                                <span>{formatDate(frames[0].savedAt, false)}</span>
                                {timelapse.totalCount > frames.length && (
                                    <span className="truncate">
                                        {i18n._({
                                            id: 'post_timelapse.sampled',
                                            message: 'Showing {shown} of {total} saves',
                                            values: {
 shown: frames.length,
total: timelapse.totalCount
}
                                        })}
                                    </span>
                                )}
                                <span>{formatDate(frames[last].savedAt, false)}</span>
                            </div>
                        </>
                    )}
                </section>
            </div>
        </>
    );
};

export default TimelapsePlayer;
