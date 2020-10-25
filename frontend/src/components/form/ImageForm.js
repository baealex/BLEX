export default function ImageForm(props) {
    let thumbnail;

    const onSelectImage = () => {
        thumbnail.click();
    };

    return (
        <div className="custom-file">
            <input
                ref={(el) => {thumbnail = el}}
                type="file"
                name={props.name}
                style={{display: 'none'}}
                className="form-control"
                accept="image/*"
                onChange={(e) => props.onChange(e)}
            />
            <label className="custom-file-label" onClick={() => onSelectImage()}>
                {props.imageName ? props.imageName : '대표 이미지 선택'}
			</label>
        </div>
    );
}