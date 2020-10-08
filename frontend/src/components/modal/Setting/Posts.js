import React from 'react';

import { toast } from 'react-toastify';

import API from '../../../modules/api';
import Link from 'next/link';

class PostsSetting extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            posts: [],
            analytics: {
                now: undefined,
                data: []
            }
        };
    }

    async componentDidMount() {
        if(this.props.tabdata === undefined) {
            const { username, tabname } = this.props;
            const { data } = await API.getSetting('@' + username, tabname.toLowerCase());
            this.props.fetchData(tabname, data);
            this.setState(data);
        } else {
            this.setState(this.props.tabdata);
        }
    }

    sortArticle(item) {
        let newState = this.state;
        if(item == 'title') {
            newState.posts.sort((a, b) => {
                return a[item] < b[item] ? -1 : a[item] > b[item] ? 1 : 0;  
            });
        } else {
            newState.posts.sort((a, b) => { 
                return a[item] > b[item] ? -1 : a[item] < b[item] ? 1 : 0;  
            });
        }
        const { tabname } = this.props;
        this.props.fetchData(tabname, newState);
    }

    async onAnalytics(url) {        
        let analytics = {
            ...this.state.analytics
        };
        analytics.now = url;

        if(analytics.data[url] == undefined) {
            const { username } = this.props;
            const { data } = await API.getAnalytics('@' + username, url);
            analytics.data[url] = data;
        }

        this.setState({
            ...this.state,
            analytics
        });
    }

    async onPostsHide(url) {
        const { tabname, username } = this.props;
        const { data } = await API.putPostHide('@' + username, url);
        let newState = this.state;
        newState.posts = newState.posts.map(post => (
            post.url == url ? ({
                ...post,
                hide: JSON.stringify(data)
            }) : post
        ));
        this.props.fetchData(tabname, newState);
    }

    render() {
        if(!this.props.tabdata) return <>Loading...</>;

        return (
            <>
                <ul className="tag-list mb-0">
                    <li><a onClick={() => this.sortArticle('title')}>가나다</a></li>
                    <li><a onClick={() => this.sortArticle('created_date')}>최근 작성</a></li>
                    <li><a onClick={() => this.sortArticle('updated_date')}>최근 수정</a></li>
                    <li><a onClick={() => this.sortArticle('today')}>오늘 조회수 높은</a></li>
                    <li><a onClick={() => this.sortArticle('yesterday')}>어제 조회수 높은</a></li>
                    <li><a onClick={() => this.sortArticle('total')}>총 조회수 높은</a></li>
                    <li><a onClick={() => this.sortArticle('total_likes')}>추천 많은</a></li>
                    <li><a onClick={() => this.sortArticle('total_comments')}>댓글 많은</a></li>
                    <li><a onClick={() => this.sortArticle('hide')}>숨김 우선</a></li>
                </ul>
                <ul className="list-group">
                {this.state.posts.map((post, idx) => (
                    <li key={idx} className="blex-card p-3 mb-3">
                        <p>
                            <Link href="/[author]/[posturl]" as={`/@${this.props.username}/${post.url}`}>
                                <a className="deep-dark">
                                    {post.title}
                                </a>
                            </Link>
                        </p>
                        <ul className="setting-list-info">
                            <li>
                                <a onClick={() => this.onPostsHide(post.url)} className="element-lock">
                                    {post.hide == 'true' ? <i className="fas fa-lock"></i> : <i className="fas fa-lock-open"></i>}
                                </a>
                            </li>
                            <li>
                                <i className="far fa-eye"></i> <span className="ns">(Today : {post.today}, Yesterday : {post.yesterday}, Total : {post.total})</span></li>
                            <li>
                                <a onClick={() => this.onAnalytics(post.url)}>
                                    <i className="fas fa-chart-line"></i>
                                </a>
                            </li>
                            <li>
                                <i className="far fa-thumbs-up"></i> {post.total_likes}
                            </li>
                            <li>
                                <i className="far fa-comment"></i> {post.total_comments}
                            </li>
                        </ul>
                        {this.state.analytics.now == post.url ? (
                            <div>
                                <p>조회수</p>
                                <ul>
                                    {this.state.analytics.data[post.url].items.map((item, idx) => (
                                        <li key={idx}>{item.date} : {item.count}</li>
                                    ))}
                                </ul>
                                <p>유입경로</p>
                                <ul>
                                    {this.state.analytics.data[post.url].referers.map((item, idx) => (
                                        <li key={idx}>{item.time} - {item.from}</li>
                                    ))}
                                </ul>
                            </div>
                        ) : ''}
                    </li>
                ))}
                </ul>
            </>
        );
    }
}

export default PostsSetting;