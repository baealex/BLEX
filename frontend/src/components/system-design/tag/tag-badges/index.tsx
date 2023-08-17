import { Badge, Flex } from '@design-system';

export interface TagBadgesProps {
    className?: string;
    items: React.ReactNode[];
    disableSharp?: boolean;
}

export function TagBadges(props: TagBadgesProps) {
    return (
        <Flex wrap="wrap" gap={2} className={props.className}>
            {props.items.map((item, idx) => (
                item && (
                    <Badge key={idx} isRounded hasHash={!props.disableSharp}>
                        {item}
                    </Badge>
                )
            ))}
        </Flex>
    );
}