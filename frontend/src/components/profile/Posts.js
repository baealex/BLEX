export default function Posts(props) {
    console.log(props)
    return (
        <div className="row">
            <Topics topic={props.topic}/>
        </div>
    )
}

function Topics(props) {
    return (
        <div class="profile-tags col-lg-3">
            <ul class="mt-4 noto">
                <h5>카테고리</h5>
                <li>전체<span class="ns">({props.topic.reduce((acc, cur) => acc += cur.count, 0)})</span></li>
                {props.topic.map((item, idx) => (
                    <li key={idx}>{item.name}<span class="ns">({item.count})</span></li>
                ))}
            </ul>
        </div>
    );
}

function ArticleCard(props) {
    return (
        <div class="col-lg-8 mt-4">
        </div>
    );
}