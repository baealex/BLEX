type inputType = 'text' | 'password';

interface Props {
    title: string;
    type: inputType;
    name: string;
    maxLength: number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    value: string;
    placeholder: string;
}

export function InputForm(props: Props) {
    return (
        <div className="input-group mb-2 mr-sm-2 mt-3">
            <div className="input-group-prepend">
                <div className="input-group-text">{props.title}</div>
            </div>
            <input
                type={props.type ? props.type : 'text'}
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