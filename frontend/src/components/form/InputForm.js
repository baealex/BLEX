export default function InputForm(props) {
    return (
        <div className="input-group mb-2 mr-sm-2 mt-3">
            <div className="input-group-prepend">
                <div className="input-group-text">{props.title}</div>
            </div>
            <input
                type={props.type ? props.type : "text"}
                name={props.name}
                className="form-control"
                maxLength={props.maxLength}
                onChange={(e) => props.onChange(e)}
                value={props.value}
                placeholder={props.placeholder}
            />
        </div>
    );
}