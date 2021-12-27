import { Badge } from '@design-system';

export interface TagBadgeProps {
    items: JSX.Element[];
    disableSharp?: boolean;
}

export function TagBadge(props: TagBadgeProps) {
    return (
        <div className="mb-3">
            {props.items.map((item, idx) => (
                item && (
                    <Badge hasSharp={!props.disableSharp} key={idx}>
                        {item}
                    </Badge>
                )
            ))}
        </div>
    );
}