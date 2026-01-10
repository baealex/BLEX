import { useState } from 'react';
import { Modal, Button } from '@blex/ui';

interface MarkdownPasteModalProps {
    isOpen: boolean;
    html: string;
    onInsertHtml: () => void;
    onInsertText: () => void;
    onClose: () => void;
}

const MarkdownPasteModal = ({
    isOpen,
    html,
    onInsertHtml,
    onInsertText,
    onClose
}: MarkdownPasteModalProps) => {
    const [showPreview, setShowPreview] = useState(false);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="마크다운 감지됨" maxWidth="md">
            <div className="p-6">
                <p className="mb-4 text-gray-600">
                    붙여넣은 텍스트에서 마크다운 문법이 감지되었습니다.
                </p>

                <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="text-sm text-blue-600 hover:underline mb-4">
                    {showPreview ? '▼ 미리보기 숨기기' : '▶ 변환 미리보기 보기'}
                </button>

                {showPreview && (
                    <div className="mb-4 border rounded-lg p-4 max-h-48 overflow-auto bg-gray-50">
                        <div
                            className="prose prose-sm blog-post-content"
                            dangerouslySetInnerHTML={{ __html: html }}
                        />
                    </div>
                )}

                <div className="flex justify-end gap-2">
                    <Button variant="secondary" onClick={onClose}>
                        취소
                    </Button>
                    <Button variant="secondary" onClick={onInsertText}>
                        텍스트로 붙여넣기
                    </Button>
                    <Button variant="primary" onClick={onInsertHtml}>
                        마크다운으로 변환
                    </Button>
                </div>
            </div>
        </Modal>
    );
};

export default MarkdownPasteModal;
