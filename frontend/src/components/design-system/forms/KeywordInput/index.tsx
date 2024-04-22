import { useMemo } from 'react';

import { BadgeGroup, BaseInput } from '~/components/design-system';

import { slugify } from '~/modules/utility/string';

interface Props {
    name: string;
    maxLength: number;
    onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
    value: string;
    placeholder?: string;
}

export function KeywordInput(props: Props) {
    const badges = useMemo(() => {
        return [...new Set(slugify(props.value).split('-').filter(x => !!x))];
    }, [props.value]);

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
            <BadgeGroup className="mt-2" items={badges} />
        </>
    );
}
