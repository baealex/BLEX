import { Dropdown } from '@blex/ui';
import type { Editor } from '@tiptap/react';
import type { NodeViewProps } from '@tiptap/react';
import { SUPPORTED_LANGUAGES, getLanguageLabel } from '~/utils/languages';

interface CodeBlockLanguageSelectorProps {
    editor: Editor;
    node: NodeViewProps['node'];
    updateAttributes: (attributes: Record<string, unknown>) => void;
}

const CodeBlockLanguageSelector = ({
    node,
    updateAttributes
}: CodeBlockLanguageSelectorProps) => {
    const currentLanguage = node.attrs.language || 'plaintext';

    const handleLanguageChange = (language: string) => {
        updateAttributes({ language });
    };

    const getCurrentLanguageLabel = () => {
        return getLanguageLabel(currentLanguage);
    };

    const dropdownItems = SUPPORTED_LANGUAGES.map((language) => ({
        label: language.label,
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
                    className="inline-flex items-center px-2 py-1 text-xs font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-gray-500">
                    {getCurrentLanguageLabel()}
                    <svg className="w-3 h-3 ml-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                    </svg>
                </button>
            }
        />
    );
};

export default CodeBlockLanguageSelector;
