type AvailableSticker = 'blank';

interface Props {
    name: AvailableSticker;
}

export default function Sticker(props: Props) {
    const SVG_FILE = `https://static.blex.me/assets/sticker/${props.name}.svg`
    return (
        <>
            <img className="w-100" src={SVG_FILE}/>
        </>
    );
}