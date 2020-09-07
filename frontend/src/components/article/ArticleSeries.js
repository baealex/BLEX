import React from 'react'
import Link from 'next/link'

class ArticleSereis extends React.Component {
    render() {
        return (
            <div className="my-5 noto posts-sereis">
                <div class="series-desc mb-3">
                    <blockquote class="noto">
                        <strong>'{this.props.title}' 시리즈</strong> {this.props.description}
                    </blockquote>
                    <div class="author">
                        <a><img src={this.props.authorImage}/></a>
                    </div>
                </div>
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