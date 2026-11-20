import { useRef, useState } from 'react';
import { useLingui } from '@lingui/react/macro';
import { History } from '@blex/ui/icons';
import { cx } from '~/lib/classnames';
import TimelapseDialog from './TimelapseDialog';

interface PostTimelapseProps {
    username: string;
    postUrl: string;
    /** Matches the white meta text used on top of overlay covers. */
    inverted?: boolean;
}

const PostTimelapse = ({ username, postUrl, inverted = false }: PostTimelapseProps) => {
    const { t } = useLingui();
    const [isOpen, setIsOpen] = useState(false);
    const triggerRef = useRef<HTMLButtonElement>(null);

    return (
        <span className="inline-flex items-center gap-x-2">
            <span aria-hidden="true" className={cx('max-sm:hidden', inverted ? 'text-white/55' : 'text-line-strong')}>·</span>
            <button
                ref={triggerRef}
                type="button"
                onClick={() => setIsOpen(true)}
                className={cx(
                    '-my-2 inline-flex items-center gap-1 py-2 font-medium transition-all duration-150 active:scale-95',
                    inverted ? 'text-white/80 hover:text-white' : 'text-content-secondary hover:text-content'
                )}>
                <History aria-hidden="true" className="h-3.5 w-3.5" />
                {t({
                    id: 'post_timelapse.open',
                    message: 'How it was written'
                })}
            </button>
            {isOpen && (
                <TimelapseDialog
                    username={username}
                    postUrl={postUrl}
                    returnFocusRef={triggerRef}
                    onClose={() => setIsOpen(false)}
                />
            )}
        </span>
    );
};

export default PostTimelapse;
