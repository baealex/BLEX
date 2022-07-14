import { Badge } from '@design-system';

export interface TagBadgesProps {
    items: JSX.Element[];
    disableSharp?: boolean;
}

export function TagBadges(props: TagBadgesProps) {
    return (
        <div className="mb-3">
            {props.items.map((item, idx) => (
                item && (
                    <Badge isRounded hasSharp={!props.disableSharp} key={idx}>
                        {item}
                    </Badge>
                )
            ))}
        </div>
    );
}