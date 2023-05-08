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
                    <Badge key={idx} className="mr-2" isRounded hasHash={!props.disableSharp}>
                        {item}
                    </Badge>
                )
            ))}
        </div>
    );
}