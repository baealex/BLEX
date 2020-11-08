import Link from 'next/link';

interface SereisProps {
    series: SereisCardProps[];
    children: JSX.Element;
}

interface SereisCardProps {
    url: string;
    image: string;
    owner: string;
    name: string;
    createdDate: string;
}

export default function Series(props: SereisProps) {
    return (
        <>
            {props.series.map((item: SereisCardProps, idx: number) => (
                <SeriesCard key={idx} {...item}/>
            ))}
            {props.children}
        </>
    )
}

function SeriesCard(props: SereisCardProps) {
    return (
        <div className="post-list" style={{backgroundImage: `url(${props.image})`}}>
            <Link href="/[author]/series/[seriesurl]" as={`/@${props.owner}/series/${props.url}`}>
                <a className="post-title">
                    <div className="post-mask">
                        <h3 className="serif">'{props.name}' 시리즈</h3>
                        <span className="date">{props.createdDate}</span>
                    </div>
                </a>
            </Link>
        </div>
    )
}