import { Dropdown } from '~/ui/dropdown';
import type { Editor } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { SUPPORTED_LANGUAGES, getLanguageLabel } from '~/features/editor/tiptap/utils/languages';
import { useEditorI18n } from '../../i18n';
import { ChevronDown } from '~/ui/icons';

interface CodeBlockLanguageSelectorProps {
    editor: Editor;
    node: NodeViewProps['node'];
    updateAttributes: (attributes: Record<string, unknown>) => void;
}

const CodeBlockLanguageSelector = ({ node, updateAttributes }: CodeBlockLanguageSelectorProps) => {
    const { t } = useEditorI18n();
    const currentLanguage = node.attrs.language || 'plaintext';

    const handleLanguageChange = (language: string) => {
        updateAttributes({ language });
    };

    const getCurrentLanguageLabel = () => {
        if (currentLanguage === 'plaintext') {
            return t('code.language.plain_text');
        }
        return getLanguageLabel(currentLanguage);
    };

    const dropdownItems = SUPPORTED_LANGUAGES.map((language) => ({
        id: language.value,
        label: language.value === 'plaintext' ? t('code.language.plain_text') : language.label,
        onClick: () => handleLanguageChange(language.value),
        checked: currentLanguage === language.value
    }));

    return (
        <Dropdown
            items={dropdownItems}
            align="start"
            trigger={
                <button
                    type="button"
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500"
                >
                    {getCurrentLanguageLabel()}
                    <ChevronDown className="w-3 h-3 ml-1" />
                </button>
            }
        />
    );
};

export default CodeBlockLanguageSelector;
