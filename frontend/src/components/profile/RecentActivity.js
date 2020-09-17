import PurpleBorder from "../common/PurpleBorder";

export default function RecentActivity(props) {
    let items = [];
    for(const active of props.data) {
        const className = `fas fa-${active.type}`;
        let text = `'${active.text}' `;
        switch(active.type) {
            case 'edit':
                text += '포스트를 작성하였습니다.'
                break;
            case 'comment':
                text += '포스트에 댓글을 남겼습니다.'
                break;
            case 'bookmark':
                text += '시리즈를 생성하였습니다.'
                break;
        }
        items.push(
            <li><i className={className}></i>{text}</li>
        )
    }
    return (
        <>
            <div className="h5 serif font-weight-bold mt-5">Recent Activity</div>
            {props.data.length > 0 ? (
                <ul className="p-0 noto profile-activity mt-4">
                    {items}
                </ul>
            ) : (
                <PurpleBorder text="아직 아무런 활동이 없습니다"/>
            )}
        </>
    )
}