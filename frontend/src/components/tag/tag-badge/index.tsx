import { Badge } from '../../atoms';

export interface TagBadgeProps {
    items: JSX.Element[];
    disableSharp?: boolean;
}

export function TagBadge(props: TagBadgeProps) {
    return (
        <>
            {props.items.map((item, idx) => (
                item && (
                    <Badge hasSharp={!props.disableSharp} key={idx}>
                        {item}
                    </Badge>
                )
            ))}
        </>
    );
}