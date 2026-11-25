import { useEffect, useEffectEvent } from 'react';
import { useLingui } from '@lingui/react/macro';
import { applicationHistory } from '~/application/history';
import { useConfirm } from '~/hooks/useConfirm';

interface LeaveWarningOptions {
    /** True while leaving would lose edits. */
    warns: () => boolean;
    /** Runs on every attempt to leave, as `beforeunload` does for a full page load. */
    beforeLeave?: () => void;
}

/**
 * Moves within the application keep the page loaded, so `beforeunload` never sees them.
 * The history the application shares with screens asks first instead, for links, form searches, and back or forward.
 * The application also reads `enableBeforeUnload` to send form posts natively, so the browser warns before they leave.
 */
export const useLeaveWarning = ({ warns, beforeLeave }: LeaveWarningOptions) => {
    const { t } = useLingui();
    const { confirm } = useConfirm();

    const staysOnPage = useEffectEvent(async () => {
        beforeLeave?.();
        if (!warns()) return false;
        const leaves = await confirm({
            title: t({
                id: 'editor.unsaved.title',
                message: 'Unsaved changes'
            }),
            message: t({
                id: 'editor.unsaved.leave_description',
                message: 'Your changes have not been saved. Leave this page?'
            }),
            confirmText: t({
                id: 'editor.unsaved.leave',
                message: 'Leave'
            }),
            variant: 'danger'
        });
        return !leaves;
    });
    const warnsNow = useEffectEvent(warns);

    useEffect(
        () =>
            applicationHistory().block({
                blockerFn: () => staysOnPage(),
                enableBeforeUnload: () => warnsNow()
            }),
        []
    );
};
