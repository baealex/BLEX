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
                        <div className="h5 font-weight-bold noto">‘{props.name}’ 시리즈</div>
                        <span className="ns noto">{props.createdDate}</span>
                    </div>
                </a>
            </Link>
        </div>
    )
}