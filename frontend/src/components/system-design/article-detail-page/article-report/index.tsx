import classNames from 'classnames/bind';
import styles from './ArticleReport.module.scss';
const cx = classNames.bind(styles);

import { useEffect, useState } from 'react';

import { Checkbox, Flex, Modal, Text } from '~/components/design-system';

import { message } from '~/modules/utility/message';
import { snackBar } from '~/modules/ui/snack-bar';

import { postReportArticle } from '~/modules/api';
import { Warning } from '@baejino/icon';

interface Props {
    url: string;
}

const REASONS = [
    '단순 홍보',
    '저작권 침해',
    '선정적',
    '폭력적',
    '혐오 유발',
    '기타'
];

export function ArticleReport(props: Props) {
    const [isReportModalOpen, setIsReportModalOpen] = useState(false);
    const [reportReasons, setReportReasons] = useState<string[]>([]);
    const [reportText, setReportText] = useState('');

    const handleCheck = (e: React.ChangeEvent<HTMLInputElement>) => {
        if (e.target.checked) {
            setReportReasons(prev => prev.concat(e.target.value));
        } else {
            setReportReasons(prev => prev.filter(reason => reason !== e.target.value));
        }
    };

    const handleSubmit = async () => {
        await postReportArticle({
            url: props.url,
            content: reportReasons.join(', ').replace('기타', `기타: ${reportText}`)
        });
        setIsReportModalOpen(false);
        snackBar(message('AFTER_REQ_DONE', '신고가 접수되었습니다.'));
    };

    useEffect(() => {
        setReportReasons([]);
        setReportText('');
    }, [isReportModalOpen]);

    return (
        <>
            <Flex className="c-pointer shallow-dark" align="center" gap={2} onClick={() => setIsReportModalOpen(true)}>
                <Warning width={20} height={20} />
                <Text fontSize={3}>신고</Text>
            </Flex>
            <Modal
                title="포스트 신고"
                isOpen={isReportModalOpen}
                submitText="제출합니다"
                onSubmit={handleSubmit}
                onClose={() => setIsReportModalOpen(false)}>
                <div className={cx('report-reasons')}>
                    {REASONS.map(reason => (
                        <Checkbox
                            key={reason}
                            label={reason}
                            value={reason}
                            onChange={handleCheck}
                        />
                    ))}
                </div>
                {reportReasons.includes('기타') && (
                    <div className={cx('report-reasons')}>
                        <textarea
                            className={cx('textarea')}
                            placeholder="기타 사유를 입력해주세요."
                            value={reportText}
                            onChange={e => setReportText(e.target.value)}
                        />
                    </div>
                )}
            </Modal>
        </>
    );
}
