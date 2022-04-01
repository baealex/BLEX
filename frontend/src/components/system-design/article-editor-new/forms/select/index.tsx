interface Props {
    title: string;
    name: string;
    onChange: Function;
    children: JSX.Element;
};

export function SelectForm(props: Props) {
    return (
        <div className="input-group mb-2 mr-sm-2 mt-3">
            <div className="input-group-prepend">
                <div className="input-group-text">{props.title}</div>
            </div>
            <select
                name={props.name}
                className="form-control"
                onChange={(e) => props.onChange(e)}>
                {props.children}
            </select>
        </div>
    );
}