import Link from 'next/link';
import React from 'react';

class Navigation extends React.Component {
    render() {
        return (
            <div class="profile-tab back-image mt-5">
                <div class="mask">
                    <ul class="serif">
                        <Link href="/[author]" as={`/@${this.props.username}`}>
                            <li>개요</li>
                        </Link>
                        <Link href="/[author]" as={`/@${this.props.username}/posts`}>
                            <li>포스트</li>
                        </Link>
                        <Link href="/[author]" as={`/@${this.props.username}/series`}>
                            <li>시리즈</li>
                        </Link>
                        <Link href="/[author]/about" as={`/@${this.props.username}/about`}>
                            <li>소개</li>
                        </Link>
                    </ul>
                </div>
            </div>
        )
    }
}

export default Navigation;