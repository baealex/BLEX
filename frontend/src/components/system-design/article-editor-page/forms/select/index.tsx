interface Props {
    className?: string;
    label: string;
    name: string;
    onChange: (e: React.ChangeEvent<HTMLSelectElement>) => void;
    children: JSX.Element;
}

export function SelectForm(props: Props) {
    return (
        <>
            <div className={props.className}>
                <label>{props.label}</label>
                <div className="group">
                    <select
                        name={props.name}
                        className="form-control"
                        onChange={props.onChange}>
                        <option value="">선택하지 않음</option>
                        {props.children}
                    </select>
                    <i className="fas fa-book"></i>
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

                .group {
                    position: relative;
                 
                    i {
                        position: absolute;
                        top: 50%;
                        left: 8px;
                        transform: translateY(-50%);
                        padding: 0.5rem;
                        color: #6c757d;
                        z-index: 5;
                    }
                    
                    select {
                        padding-left: 36px;
                    }
                }
            `}</style>
        </>
    );
}
