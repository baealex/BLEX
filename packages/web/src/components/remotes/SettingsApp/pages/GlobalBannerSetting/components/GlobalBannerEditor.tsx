import BannerEditorBase from '../../shared/BannerEditorBase';

interface GlobalBannerEditorProps {
    bannerId?: number;
}

const GlobalBannerEditor = ({ bannerId }: GlobalBannerEditorProps) => {
    return (
        <BannerEditorBase
            scope="global"
            bannerId={bannerId}
        />
    );
};

export default GlobalBannerEditor;
