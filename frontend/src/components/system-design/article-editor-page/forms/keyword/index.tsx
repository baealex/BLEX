import { Badge } from '~/components/design-system';

type inputType = 'text' | 'password';

interface Props {
    className?: string;
    label: string;
    type: inputType;
    name: string;
    maxLength: number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    value: string;
    placeholder: string;
}

export function KeywordForm(props: Props) {
    return (
        <>
            <div className={props.className}>
                <label>{props.label}</label>
                <div className="group">
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
                <div className="mt-2">
                    {props.value.replace(/[\s\\,\\.]/g, '-').split('-').filter(x => !!x).map((item) => (
                        <Badge>{item}</Badge>
                    ))}
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
            `}</style>
        </>
    );
}
