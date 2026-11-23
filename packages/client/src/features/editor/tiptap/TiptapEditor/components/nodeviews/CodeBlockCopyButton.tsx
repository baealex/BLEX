import { useState } from 'react';
import { useEditorI18n } from '../../i18n';
import { Check, Copy } from '~/ui/icons';

interface CodeBlockCopyButtonProps {
    code: string;
}

const CodeBlockCopyButton = ({ code }: CodeBlockCopyButtonProps) => {
    const { t } = useEditorI18n();
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        try {
            await navigator.clipboard.writeText(code);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch (err) {
            console.error('Failed to copy code:', err);
        }
    };

    return (
        <button
            type="button"
            onClick={handleCopy}
            className="code-copy-button"
            title={copied ? t('code.copied') : t('code.copy')}
        >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
        </button>
    );
};

export default CodeBlockCopyButton;
