import React from 'react'
import Link from 'next/link'

class ArticleSereis extends React.Component {
    render() {
        return (
            <div className="my-5 noto posts-sereis">
                <Link href="/[author]/series/[seriesurl]" as={`/@${this.props.author}/series/${this.props.url}`}>
                    <a className="deep-dark">
                        <h4 className="serif font-weight-bold mb-3">
                            '{this.props.title}' 시리즈
                        </h4>
                    </a>
                </Link>
                <div className="series-desc mb-3">
                    <blockquote className="noto">
                    {this.props.description ? this.props.description : '이 시리즈에 대한 설명이 없습니다.'}
                    </blockquote>
                    <div className="author">
                        <Link href="/[author]" as={`/@${this.props.author}`}>
                            <a><img src={this.props.authorImage}/></a>
                        </Link>
                    </div>
                </div>
                <ul>
                    {this.props.posts.length > 1 ? this.props.posts.map((post, idx) => (
                        this.props.activeSeries >= idx - 2 && this.props.activeSeries <= idx + 2 ? (
                            <li key={idx}>
                                <Link href="/[author]/[posturl]" as={`/@${this.props.author}/${post.url}`}>
                                    <a className={`${idx == this.props.activeSeries ? 'deep' : 'shallow'}-dark`}>{post.title}</a>
                                </Link>
                                <div className="series-count">{idx + 1}/{this.props.sereisLength}</div>
                            </li>
                        ) : ''
                    )) : <></>}
                </ul>
            </div>
        )
    }
}

export default ArticleSereis