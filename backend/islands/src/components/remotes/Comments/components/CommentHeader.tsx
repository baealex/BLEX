import { getStaticPath } from '~/modules/static.module';

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
        <div className="flex items-start gap-3">
            <a
                href={`/@${author}`}
                className="flex-shrink-0 group"
                aria-label={`${author}의 프로필 보기`}>
                {authorImage ? (
                    <img
                        src={getStaticPath(authorImage)}
                        alt={`${author}의 프로필 이미지`}
                        className="w-10 h-10 rounded-full object-cover"
                    />
                ) : (
                    <div className="w-10 h-10 rounded-full bg-gray-900 flex items-center justify-center text-white font-semibold text-sm">
                        {author.charAt(0).toUpperCase()}
                    </div>
                )}
            </a>
            <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-baseline gap-2 flex-wrap">
                    <a
                        href={`/@${author}`}
                        className="font-semibold text-gray-900 hover:text-gray-600 transition-colors text-sm">
                        {author}
                    </a>
                    <time className="text-gray-500 text-xs" dateTime={createdDate}>
                        {createdDate}
                    </time>
                    {isEdited && (
                        <span className="text-xs text-gray-500">· 수정됨</span>
                    )}
                </div>
            </div>
        </div>
    );
};
