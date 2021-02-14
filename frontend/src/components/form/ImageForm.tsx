interface Props {
    title: string;
    name: string;
    imageName: string;
    onChange: Function;
};

export default function ImageForm(props: Props) {
    let thumbnail: HTMLInputElement;

    const onSelectImage = () => {
        thumbnail.click();
    };

    return (
        <div className="custom-file">
            <input
                ref={(el) => {thumbnail = el as HTMLInputElement}}
                type="file"
                name={props.name}
                style={{display: 'none'}}
                className="form-control"
                accept="image/*"
                onChange={(e) => props.onChange(e)}
            />
            <label className="custom-file-label" onClick={() => onSelectImage()}>
                {props.imageName ? props.imageName : props.title}
			</label>
        </div>
    );
}