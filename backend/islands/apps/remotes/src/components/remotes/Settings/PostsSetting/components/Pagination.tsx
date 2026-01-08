import { Button } from '~/components/shared';

interface PaginationProps {
    page: string;
    lastPage: number;
    onPageChange: (page: string) => void;
}

const Pagination = ({ page, lastPage, onPageChange }: PaginationProps) => {
    const currentPage = parseInt(page);

    if (lastPage <= 1) return null;

    return (
        <div className="flex justify-center items-center gap-3 mt-6">
            <Button
                variant="secondary"
                size="sm"
                onClick={() => onPageChange(String(Math.max(1, currentPage - 1)))}
                disabled={currentPage === 1}
                leftIcon={<i className="fas fa-chevron-left" />}>
                이전
            </Button>
            <div className="px-4 py-2 text-sm text-gray-700 font-medium">
                {page} / {lastPage}
            </div>
            <Button
                variant="secondary"
                size="sm"
                onClick={() => onPageChange(String(Math.min(lastPage, currentPage + 1)))}
                disabled={currentPage === lastPage}
                rightIcon={<i className="fas fa-chevron-right" />}>
                다음
            </Button>
        </div>
    );
};

export default Pagination;
