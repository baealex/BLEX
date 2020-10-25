import Link from 'next/link';
import React from 'react';

class Navigation extends React.Component {
    render() {
        return (
            <div className="profile-tab back-image mt-5">
                <div className="mask">
                    <ul className="serif">
                        <Link href="/[author]" as={`/@${this.props.username}`} scroll={false} prefetch={true}>
                            <a>
                                <li className={this.props.active === 'overview' ? 'active' : ''}>개요</li>
                            </a>
                        </Link>
                        <Link href="/[author]/posts" as={`/@${this.props.username}/posts`} scroll={false} prefetch={true}>
                            <a>
                                <li className={this.props.active === 'posts' ? 'active' : ''}>포스트</li>
                            </a>
                        </Link>
                        <Link href="/[author]/series" as={`/@${this.props.username}/series`} scroll={false} prefetch={true}>
                            <a>
                                <li className={this.props.active === 'series' ? 'active' : ''}>시리즈</li>
                            </a>
                        </Link>
                        <Link href="/[author]/about" as={`/@${this.props.username}/about`} scroll={false} prefetch={true}>
                            <a>
                                <li className={this.props.active === 'about' ? 'active' : ''}>소개</li>
                            </a>
                        </Link>
                    </ul>
                </div>
            </div>
        )
    }
}

export default Navigation;