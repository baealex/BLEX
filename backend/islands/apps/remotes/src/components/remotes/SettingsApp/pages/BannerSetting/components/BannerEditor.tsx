import BannerEditorBase from '../../shared/BannerEditorBase';

interface BannerEditorProps {
    bannerId?: number;
}

const BannerEditor = ({ bannerId }: BannerEditorProps) => {
    return (
        <BannerEditorBase
            scope="user"
            bannerId={bannerId}
        />
    );
};

export default BannerEditor;
