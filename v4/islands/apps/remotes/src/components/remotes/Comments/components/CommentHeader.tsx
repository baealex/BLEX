import { Trans, useLingui } from '@lingui/react/macro';
import { getStaticPath } from '~/modules/static.module';

interface CommentHeaderProps {
    author: string;
    authorImage: string | null;
    createdDate: string;
    isEdited: boolean;
    isDeleted: boolean;
}

export const CommentHeader = ({
    author,
    authorImage,
    createdDate,
    isEdited,
    isDeleted
}: CommentHeaderProps) => {
    const { i18n, t } = useLingui();
    const displayAuthor = isDeleted
        ? t({
            id: 'comments.deleted_author',
            message: 'Deleted user'
        })
        : author;
    const avatar = authorImage ? (
        <img
            src={getStaticPath(authorImage)}
            alt={i18n._({
                id: 'comments.author_avatar',
                message: 'Profile image for {author}',
                values: { author: displayAuthor }
            })}
            className="w-11 h-11 rounded-full object-cover ring-2 ring-line-light group-hover/avatar:ring-line transition-all duration-200"
        />
    ) : (
        <div className="w-11 h-11 rounded-full bg-action flex items-center justify-center text-content-inverted font-semibold text-sm ring-2 ring-line-light group-hover/avatar:ring-line transition-all duration-200">
            {displayAuthor.charAt(0).toUpperCase()}
        </div>
    );

    return (
        <div className="flex items-center gap-3">
            {isDeleted ? (
                <div className="flex-shrink-0 group/avatar">
                    {avatar}
                </div>
            ) : (
                <a
                    href={`/@${author}`}
                    className="flex-shrink-0 group/avatar transition-transform hover:scale-105 duration-200"
                    aria-label={i18n._({
                        id: 'comments.author_profile',
                        message: 'View profile for {author}',
                        values: { author }
                    })}>
                    {avatar}
                </a>
            )}
            <div className="flex min-h-11 min-w-0 flex-1 flex-col justify-center">
                {isDeleted ? (
                    <span className="truncate text-sm font-semibold leading-5 text-content">
                        {displayAuthor}
                    </span>
                ) : (
                    <a
                        href={`/@${author}`}
                        className="truncate text-sm font-semibold leading-5 text-content hover:text-content transition-colors duration-150">
                        {author}
                    </a>
                )}
                <div className="mt-0.5 flex items-center gap-1.5 text-xs font-medium leading-4 text-content-secondary">
                    <time dateTime={createdDate}>
                        {createdDate}
                    </time>
                    {isEdited && (
                        <>
                            <span aria-hidden="true">·</span>
                            <span><Trans id="comments.edited">Edited</Trans></span>
                        </>
                    )}
                </div>
            </div>
        </div>
    );
};
