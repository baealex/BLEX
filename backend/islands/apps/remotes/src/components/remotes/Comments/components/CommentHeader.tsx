import { getStaticPath } from '~/modules/static.module';
import { Pencil } from '@blex/ui/icons';

interface CommentHeaderProps {
    author: string;
    authorImage: string;
    createdDate: string;
    isEdited: boolean;
}

export const CommentHeader = ({
    author,
    authorImage,
    createdDate,
    isEdited
}: CommentHeaderProps) => {
    return (
        <div className="flex items-start gap-4">
            <a
                href={`/@${author}`}
                className="flex-shrink-0 group/avatar transition-transform hover:scale-105 duration-200"
                aria-label={`${author}의 프로필 보기`}>
                {authorImage ? (
                    <img
                        src={getStaticPath(authorImage)}
                        alt={`${author}의 프로필 이미지`}
                        className="w-11 h-11 rounded-full object-cover ring-2 ring-line-light group-hover/avatar:ring-line transition-all duration-200"
                    />
                ) : (
                    <div className="w-11 h-11 rounded-full bg-action flex items-center justify-center text-content-inverted font-semibold text-sm ring-2 ring-line-light group-hover/avatar:ring-line transition-all duration-200">
                        {author.charAt(0).toUpperCase()}
                    </div>
                )}
            </a>
            <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <a
                        href={`/@${author}`}
                        className="font-semibold text-content hover:text-content text-sm transition-colors duration-150">
                        {author}
                    </a>
                    <time className="text-content-secondary text-xs font-medium" dateTime={createdDate}>
                        {createdDate}
                    </time>
                    {isEdited && (
                        <span className="inline-flex items-center gap-1 text-xs text-content-hint">
                            <Pencil className="w-3 h-3" />
                            수정됨
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
