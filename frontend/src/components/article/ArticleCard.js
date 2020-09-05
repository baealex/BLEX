import Link from 'next/link'

export default function ArticleCard(props) {
    return (
        <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
            <a className="blex-card">
                <img className="list-image" src={`https://static.blex.me/${props.image}`}/>
                <h3>{props.title}</h3>
                <p>
                    {props.author}
                </p>
            </a>
        </Link>
    )
}