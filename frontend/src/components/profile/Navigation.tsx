import Link from 'next/link';

interface ProfileNavigationProps {
    username: string;
    active: string;
}

export default function ProfileNavigation(props: ProfileNavigationProps) {
    return (
        <div className="profile-tab back-image mt-5">
            <div className="mask">
                <ul className="noto">
                    <Link href="/[author]" as={`/@${props.username}`} scroll={false} prefetch={true}>
                        <a>
                            <li className={props.active === 'overview' ? 'active' : ''}>개요</li>
                        </a>
                    </Link>
                    <Link href="/[author]/posts" as={`/@${props.username}/posts`} scroll={false} prefetch={true}>
                        <a>
                            <li className={props.active === 'posts' ? 'active' : ''}>포스트</li>
                        </a>
                    </Link>
                    <Link href="/[author]/series" as={`/@${props.username}/series`} scroll={false} prefetch={true}>
                        <a>
                            <li className={props.active === 'series' ? 'active' : ''}>시리즈</li>
                        </a>
                    </Link>
                    <Link href="/[author]/about" as={`/@${props.username}/about`} scroll={false} prefetch={true}>
                        <a>
                            <li className={props.active === 'about' ? 'active' : ''}>소개</li>
                        </a>
                    </Link>
                </ul>
            </div>
        </div>
    )
}