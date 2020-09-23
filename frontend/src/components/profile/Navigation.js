import Link from 'next/link';
import React from 'react';

class Navigation extends React.Component {
    render() {
        return (
            <div className="profile-tab back-image mt-5">
                <div className="mask">
                    <ul className="serif">
                        <Link href="/[author]" as={`/@${this.props.username}`} scroll={false} prefetch={true}>
                            <li>개요</li>
                        </Link>
                        <Link href="/[author]/posts" as={`/@${this.props.username}/posts`} scroll={false} prefetch={true}>
                            <li>포스트</li>
                        </Link>
                        <Link href="/[author]/series" as={`/@${this.props.username}/series`} scroll={false} prefetch={true}>
                            <li>시리즈</li>
                        </Link>
                        <Link href="/[author]/about" as={`/@${this.props.username}/about`} scroll={false} prefetch={true}>
                            <li>소개</li>
                        </Link>
                    </ul>
                </div>
            </div>
        )
    }
}

export default Navigation;