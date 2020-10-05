import Link from 'next/link';

export default function Posts(props) {
    return (
        <>
            {props.series.map((item, idx) => (
                <SeriesCard key={idx} {...item}/>
            ))}
            {props.children}
        </>
    )
}

function SeriesCard(props) {
    return (
        <div className="post-list" style={{backgroundImage: `url(${props.image})`}}>
            <Link href="/[author]/series/[seriesurl]" as={`/@${props.owner}/series/${props.url}`}>
                <a className="post-title">
                    <div className="post-mask">
                        <h3 className="serif">'{props.name}' 시리즈</h3>
                        <span className="date">{props.created_date}</span>
                    </div>
                </a>
            </Link>
        </div>
    )
}