import { Trans } from '@lingui/react/macro';
import { MessageDots } from '@blex/ui/icons';

export const EmptyState = () => {
    return (
        <div className="py-8 text-center">
            <MessageDots aria-hidden="true" className="w-8 h-8 text-content-hint mx-auto mb-2" stroke={1.5} />
            <p className="text-content-secondary text-sm">
                <Trans id="comments.empty">No comments yet</Trans>
            </p>
        </div>
    );
};
