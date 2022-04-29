import Link from 'next/link';

export interface ActivityItemProps {
    url: string;
    type: string;
    text: string;
}

export function ActivityItem(props: ActivityItemProps) {
    const className = `fas fa-${props.type}`;
    
    let desc = '';
    switch (props.type) {
    case 'edit':
        desc = '포스트를 작성하였습니다.';
        break;
    case 'comment':
        desc = '포스트에 댓글을 남겼습니다.';
        break;
    case 'bookmark':
        desc = '시리즈를 생성하였습니다.';
        break;
    }

    return (
        <>
            <li>
                <i className={className}/> <Link href={props.url}><a className="shallow-dark">'{props.text}'</a></Link> {desc}
            </li>
        </>
    );
}