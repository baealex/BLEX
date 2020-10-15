import React from 'react';

import { toast } from 'react-toastify';
import ReactFrappeChart from 'react-frappe-charts';

import API from '../../../modules/api';
import Link from 'next/link';

class PostsSetting extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            posts: [],
            analytics: {
                data: {}
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
        if(analytics.data[url] == undefined) {
            const { username } = this.props;
            const { data } = await API.getAnalytics('@' + username, url);
            
            const dates = [];
            const counts = [];
            for(const item of data.items) {
                dates.push(item.date.slice(-2) + 'th');
                counts.push(item.count);
            }
            dates.reverse();
            counts.reverse();

            const { referers } = data;
            analytics.data[url] = {
                dates,
                counts,
                referers,
                isShow: false
            };
        }

        analytics.data[url].isShow = !analytics.data[url].isShow;

        this.setState({
            ...this.state,
            analytics
        });
    }

    async onPostsHide(url) {
        const { tabname, username } = this.props;
        const { data } = await API.putPost('@' + username, url, 'hide');
        let newState = this.state;
        newState.posts = newState.posts.map(post => (
            post.url == url ? ({
                ...post,
                hide: JSON.stringify(data)
            }) : post
        ));
        this.props.fetchData(tabname, newState);
    }

    async onDeletePosts(url) {
        if(confirm('😮 정말 이 포스트를 삭제할까요?')) {
            const { tabname, username } = this.props;
            const { data } = await API.deletePost('@' + username, url);
            if(data == 'DONE') {
                let newState = this.state;
                newState.posts = newState.posts.filter(post => (
                    post.url !== url
                ));
                this.props.fetchData(tabname, newState);
                toast('😀 포스트가 삭제되었습니다.');
            }   
        }
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
                        <p className="d-flex justify-content-between">
                            <Link href="/[author]/[posturl]" as={`/@${this.props.username}/${post.url}`}>
                                <a className="deep-dark">
                                    {post.title}
                                </a>
                            </Link>
                            <a onClick={() => this.onDeletePosts(post.url)}>
                                <i className="fas fa-times"></i>
                            </a>
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
                        {this.state.analytics.data[post.url] && this.state.analytics.data[post.url].isShow ? (
                            this.state.analytics.data[post.url].dates.length != 0 ? (
                                <div>
                                    <ReactFrappeChart
                                        type="axis-mixed"
                                        data={{
                                            labels: this.state.analytics.data[post.url].dates,
                                            datasets: [
                                                {
                                                    name: 'View',
                                                    values: this.state.analytics.data[post.url].counts,
                                                    chartType: 'line'
                                                }
                                            ]
                                        }}
                                        colors={['purple']}
                                    />
                                    <ul>
                                        {this.state.analytics.data[post.url].referers.map((item, idx) => (
                                            <li key={idx}>{item.time} - <a className="shallow-dark" href={item.from} target="blank">{item.from}</a></li>
                                        ))}
                                    </ul>
                                </div>
                            ) : (
                                <div className="mt-3">데이터가 존재하지 않습니다.</div>
                            )
                        ) : ''}
                    </li>
                ))}
                </ul>
            </>
        );
    }
}

export default PostsSetting;