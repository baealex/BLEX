import Link from 'next/link'

export default function ArticleCard(props) {
    return (
        <div className="col-lg-4 mt-4">
            <Link href="/[author]/[posturl]" as={`/@${props.author}/${props.url}`}>
                <a className="blex-card dee-dark">
                    <img className="list-image" src={`https://static.blex.me/${props.image}`}/>
                </a>
            </Link>
            <h5 className="card-title serif font-weight-bold mt-3">
                {props.title}
            </h5>
            <p>
                {props.author}
            </p>
        </div>
    )
}