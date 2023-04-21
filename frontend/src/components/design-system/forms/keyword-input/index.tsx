import { Badge, BaseInput } from '~/components/design-system';

interface Props {
    name: string;
    maxLength: number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    value: string;
    placeholder?: string;
}

export function KeywordInput(props: Props) {
    const badges = [...new Set(props.value.replace(/[\s\\,\\.]/g, '-').split('-').filter(x => !!x))];

    return (
        <>
            <div className="group">
                <BaseInput
                    tag="input"
                    name={props.name}
                    maxLength={props.maxLength}
                    onChange={(e) => props.onChange(e)}
                    placeholder={props.placeholder}
                    value={props.value}
                />
            </div>
            <div className="mt-2">
                {badges.map((badge) => (
                    <Badge>{badge}</Badge>
                ))}
            </div>
        </>
    );
}
