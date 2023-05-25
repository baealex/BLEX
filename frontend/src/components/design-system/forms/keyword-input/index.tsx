import { Badge, BaseInput } from '~/components/design-system';
import { slugify } from '~/modules/utility/string';

interface Props {
    name: string;
    maxLength: number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    value: string;
    placeholder?: string;
}

export function KeywordInput(props: Props) {
    const badges = [...new Set(slugify(props.value).split('-').filter(x => !!x))];

    return (
        <>
            <BaseInput
                tag="input"
                name={props.name}
                maxLength={props.maxLength}
                onChange={(e) => props.onChange(e)}
                placeholder={props.placeholder}
                value={props.value}
            />
            <div className="mt-2">
                {badges.map((badge) => (
                    <Badge className="mr-2" isRounded hasHash>
                        {badge}
                    </Badge>
                ))}
            </div>
        </>
    );
}
