import { useState } from 'react';
import { Modal } from '@blex/ui';

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
    const [showPreview, setShowPreview] = useState(true);

    return (
        <Modal isOpen={isOpen} onClose={onClose} title="마크다운 감지됨" maxWidth="md">
            <Modal.Body>
                <p className="mb-4 text-gray-600">
                    붙여넣은 텍스트에서 마크다운 문법이 감지되었습니다. 어떻게 붙여넣으시겠습니까?
                </p>

                <button
                    type="button"
                    onClick={() => setShowPreview(!showPreview)}
                    className="inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-900 font-medium mb-4 transition-colors">
                    <i className={`fas fa-chevron-${showPreview ? 'down' : 'right'} text-[10px]`} />
                    {showPreview ? '미리보기 숨기기' : '변환 미리보기'}
                </button>

                {showPreview && (
                    <div className="mb-6 border border-gray-200 rounded-xl p-4 max-h-48 overflow-auto bg-gray-50/50">
                        <div
                            className="prose prose-sm blog-post-content"
                            dangerouslySetInnerHTML={{ __html: html }}
                        />
                    </div>
                )}
            </Modal.Body>

            <Modal.Footer className="flex-col sm:flex-row">
                <Modal.FooterAction
                    type="button"
                    variant="ghost"
                    onClick={onClose}
                    className="w-full sm:w-auto text-gray-500 hover:!text-gray-700">
                    취소
                </Modal.FooterAction>
                <Modal.FooterAction
                    variant="secondary"
                    onClick={onInsertText}
                    className="w-full sm:w-auto">
                    <i className="fas fa-font mr-2 text-xs opacity-70" />
                    텍스트로 붙여넣기
                </Modal.FooterAction>
                <Modal.FooterAction
                    variant="primary"
                    onClick={onInsertHtml}
                    className="w-full sm:w-auto">
                    <i className="fas fa-code mr-2 text-xs opacity-70" />
                    마크다운으로 변환
                </Modal.FooterAction>
            </Modal.Footer>
        </Modal>
    );
};

export default MarkdownPasteModal;
