import App from 'next/app'
import Head from 'next/head'
import Link from 'next/link'
import styles from '../styles/main.scss'

// Bottom Top Nav 넣을 곳

class Main extends App {
    state = {
        onNav: false,
    }

    onClickNavigation() {
        let newState = this.state;
        newState.onNav = !newState.onNav;
        this.setState(newState);
    }

    render() {
        const {Component, pageProps} = this.props;

        return (
            <>
                <Head>
                    <title>BLOG EXPRESS ME</title>
                    <link rel="icon" href="/favicon.ico" />
                    <link rel="stylesheet" href="https://use.fontawesome.com/releases/v5.0.13/css/all.css" integrity="sha384-DNOHZ68U8hZfKXOrtjWvjxusGo9WQnrNx2sqG0tfsghAvtVlRW3tvkXWZh58N9jp" crossorigin="anonymous"/>
                    <link rel="stylesheet" href="https://fonts.googleapis.com/css?family=Noto+Serif+KR|Noto+Sans+KR|Black+Han+Sans"/>
                    <link
                        rel="stylesheet"
                        href="https://maxcdn.bootstrapcdn.com/bootstrap/4.5.0/css/bootstrap.min.css"
                        integrity="sha384-9aIt2nRpC12Uk9gS9baDl411NQApFmC26EwAOH8WgZl5MYYxFfc+NcPb1dKGj7Sk"
                        crossorigin="anonymous"
                    />
                </Head>

                <nav
                    onClick={() => this.onClickNavigation()}
                    className={`menu ${this.state.onNav ? 'on' : 'off' }`}
                >
                    <img src="https://static.blex.me/assets/images/logo.png"/>
                </nav>
                <div className={`side-menu serif ${this.state.onNav ? 'on' : 'off' }`}>
                    <div className="inner">
                        <ul className="menu-item">
                            <Link href="/">
                                <a><li>인기 포스트</li></a>
                            </Link>
                            <Link href="/newest">
                                <a><li>최신 포스트</li></a>
                            </Link>
                            <Link href="/tags">
                                <a><li>태그 클라우드</li></a>
                            </Link>
                        </ul>
                        <ul className="menu-item">
                            <a href="">
                                <li><i className="fas fa-user"></i> 내 블로그</li>
                            </a>
                            <a href="javascript:void(0)">
                                <li><i className="fas fa-pencil-alt"></i> 포스트 작성</li>
                            </a>
                        </ul>
                        <ul className="menu-footer-item">
                            <li>
                                <a href="javascript:night()">
                                    <i className="fas fa-moon"></i>
                                </a>
                            </li>
                            <li>
                                <a href=""><i className="fas fa-sign-in-alt"></i> 로그인</a> / <a href="">회원가입</a>
                            </li>
                        </ul>
                    </div>
                </div>

                <div className="content">
                    <Component {...pageProps}/>
                </div>

                <style jsx>{`${styles}`}</style>
            </>
        )
    }
}

export default Main