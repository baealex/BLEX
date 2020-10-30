import Link from 'next/link';

import PurpleBorder from "../common/PurpleBorder";

export default function RecentActivity(props) {
    return (
        <>
            <div className="h5 serif font-weight-bold mt-5">Recent Activity</div>
            {props.data.length > 0 ? (
                <ul className="profile-activity p-0 noto mt-4">
                    {props.data.map((item, idx) => (
                        <ActivityItem key={idx} {...item}/>
                    ))}
                </ul>
            ) : (
                <PurpleBorder text="최근 활동이 없습니다"/>
            )}
        </>
    )
}

function ActivityItem(props) {
    const className = `fas fa-${props.type}`;
    
    let desc = '';
    switch(props.type) {
        case 'edit':
            desc = '포스트를 작성하였습니다.'
            break;
        case 'comment':
            desc = '포스트에 댓글을 남겼습니다.'
            break;
        case 'bookmark':
            desc = '시리즈를 생성하였습니다.'
            break;
    }
    return (
        <>
            <li><i className={className}></i> <Link href={props.url}><a className="shallow-dark">'{props.text}'</a></Link> {desc}</li>
        </>
    )
}