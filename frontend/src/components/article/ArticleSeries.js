import React from 'react'
import Link from 'next/link'

class ArticleSereis extends React.Component {
    render() {
        return (
            <div className="my-4 noto posts-sereis">
                <h5 className="serif">'{this.props.title}' 시리즈</h5>
                <ul>
                    {this.props.posts.length > 1 ? this.props.posts.map((post, idx) => (
                        this.props.activeSeries >= idx - 2 && this.props.activeSeries <= idx + 2 ? (
                            <li key={idx}>
                                <Link href="/[author]/[posturl]" as={`/@${this.props.author}/${post.url}`}>
                                    <a className={`${idx == this.props.activeSeries ? 'deep' : 'shallow'}-dark`}>{post.title}</a>
                                </Link>
                                <div class="series-count">{idx + 1}/{this.props.sereisLength}</div>
                            </li>
                        ) : <></>
                    )) : <></>}
                </ul>
            </div>
        )
    }
}

export default ArticleSereis