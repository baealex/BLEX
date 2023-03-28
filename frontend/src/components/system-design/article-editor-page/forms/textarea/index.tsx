interface Props {
    className?: string;
    label: string;
    name: string;
    maxLength: number;
    onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
    value: string;
    placeholder: string;
}

export function TextareaForm(props: Props) {
    return (
        <>
            <div className={props.className}>
                <label>{props.label}</label>
                <div className="group">
                    <textarea
                        name={props.name}
                        className="form-control"
                        maxLength={props.maxLength}
                        onChange={(e) => props.onChange(e)}
                        value={props.value}
                        placeholder={props.placeholder}
                    />
                </div>
            </div>
            <style jsx>{`
                label {
                    font-size: 0.8rem;
                    font-weight: 500;
                    color: #333;

                    :global(body.dark) & {
                        color: #ccc;
                    }
                }

                textarea {
                    height: 100px;
                    resize: none;
                    line-height: 1.75;

                    &::placeholder {
                        color: #888;
                        font-size: 0.9em;
                    }
                }
            `}</style>
        </>
    );
}
