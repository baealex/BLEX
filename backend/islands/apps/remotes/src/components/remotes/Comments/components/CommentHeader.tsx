import { getStaticPath } from '~/modules/static.module';
import { Pencil } from '@blex/ui';

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
                        className="w-11 h-11 rounded-full object-cover ring-2 ring-gray-100 group-hover/avatar:ring-gray-300 transition-all duration-200"
                    />
                ) : (
                    <div className="w-11 h-11 rounded-full bg-gray-900 flex items-center justify-center text-white font-semibold text-sm ring-2 ring-gray-100 group-hover/avatar:ring-gray-300 transition-all duration-200">
                        {author.charAt(0).toUpperCase()}
                    </div>
                )}
            </a>
            <div className="flex-1 min-w-0 pt-1">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <a
                        href={`/@${author}`}
                        className="font-semibold text-gray-900 hover:text-gray-700 text-sm transition-colors duration-150">
                        {author}
                    </a>
                    <time className="text-gray-500 text-xs font-medium" dateTime={createdDate}>
                        {createdDate}
                    </time>
                    {isEdited && (
                        <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                            <Pencil className="w-3 h-3" />
                            수정됨
                        </span>
                    )}
                </div>
            </div>
        </div>
    );
};
