import { Badge, Flex } from '~/components/design-system';

export interface BadgeGroupProps {
    className?: string;
    hasHash?: boolean;
    items: React.ReactNode[];
}

export function BadgeGroup(props: BadgeGroupProps) {
    return (
        <Flex wrap="wrap" gap={2} className={props.className}>
            {props.items.map((item, idx) => (
                item && (
                    <Badge key={idx} isRounded hasHash={!props.hasHash}>
                        {item}
                    </Badge>
                )
            ))}
        </Flex>
    );
}
