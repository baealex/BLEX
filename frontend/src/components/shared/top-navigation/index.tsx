import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Router from 'next/router'

import { toast } from 'react-toastify';

import * as API from '@modules/api';
import Global from '@modules/global';
import Search from '@components/shared/Search';
import { LoginModal } from './login-modal';
import { SignupModal } from './signup-modal';
import { AuthModal } from './auth-modal';

export function TopNavigation() {
    const [state, setState] = useState({
        onNav: false,
        theme: Global.state.theme,
        isLogin: Global.state.isLogin,
        username: Global.state.username,
        isLoginModalOpen: Global.state.isLoginModalOpen,
        isSignupModalOpen: Global.state.isSignupModalOpen,
        isTwoFactorAuthModalOpen: Global.state.isTwoFactorAuthModalOpen,
    });

    useEffect(() => {
        const updateKey = Global.appendUpdater(() => setState((prevState) => ({
            ...prevState,
            theme: Global.state.theme,
            isLogin: Global.state.isLogin,
            username: Global.state.username,
            isLoginModalOpen: Global.state.isLoginModalOpen,
            isSignupModalOpen: Global.state.isSignupModalOpen,
            isTwoFactorAuthModalOpen: Global.state.isTwoFactorAuthModalOpen,
        })));

        return () => Global.popUpdater(updateKey);
    }, []);

    useEffect(() => {
        Global.configInit();

        if (Global.state.isFirstVisit) {
            const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');
            if(systemDark.matches) {
                document.body.classList.add('dark');
                Global.setState({
                    theme: 'dark',
                });
            }
        } else {
            document.body.classList.add(Global.state.theme);
        }

        window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', e => {
            if (Global.state.theme === 'default' || Global.state.theme === 'dark')
            if(e.matches) {
                document.body.classList.add('dark');
                Global.setState({
                    theme: 'dark',
                });
            } else {
                document.body.classList.remove('dark');
                Global.setState({
                    theme: 'default',
                });
            }
        });
    }, []);

    useEffect(() => {
        API.getLogin().then(({data}) => {
            Global.setState({
                isLogin: data.status === 'DONE' ? true : false,
                username: data.status === 'DONE' ? data.body.username : '',
            });
            if(data.status === 'DONE') {
                if(data.body.notifyCount != 0) {
                    toast(`😲 읽지 않은 알림이 ${data.body.notifyCount}개 있습니다.`, {
                        onClick:() => {
                            Router.push('/setting');
                        }
                    });
                }
            }
        });
    }, []);

    useEffect(() => {
        Router.events.on('routeChangeStart', () => {
            setState((prevState) => ({
                ...prevState,
                onNav: false
            }));
        });
    }, []);

    const onClickNightMode = () => {
        if (document.body.classList.contains('dark')) {
            document.body.classList.remove('dark');
            Global.setState({
                theme: 'default',
            });
        } else {
            document.body.classList.add('dark');
            Global.setState({
                theme: 'dark',
            });
        }
    }

    const onClickNavigation = () => {
        setState((prevState) => ({
            ...prevState,
            onNav: !state.onNav
        }));
    }

    const onClickLogout = async () => {
        if(confirm('😮 정말 로그아웃 하시겠습니까?')) {
            const { data } = await API.postLogout();
            if(data.status === 'DONE') {
                Global.setState({
                    isLogin: false,
                    username: ''
                });
                toast('😀 로그아웃 되었습니다.');
            }
        }
    }

    return (
        <>
            <LoginModal
                isOpen={state.isLoginModalOpen}
                onClose={() => Global.onCloseModal('isLoginModalOpen')}
            />
            <SignupModal
                isOpen={state.isSignupModalOpen}
                onClose={() => Global.onCloseModal('isSignupModalOpen')}
            />
            <AuthModal
                isOpen={state.isTwoFactorAuthModalOpen}
                onClose={() => Global.onCloseModal('isTwoFactorAuthModalOpen')}
            />
            <div
                className={`side-menu noto ${state.onNav ? 'on' : 'off' }`}>
                <nav
                    onClick={() => onClickNavigation()}
                    className={`menu ${state.onNav ? 'on' : 'off' }`}>
                    <img src="/logo32.png" alt="logo"/>
                </nav>
                <div className="inner">
                    <Search/>
                    <ul className="menu-item">
                        <li>
                            <Link href="/">
                                <a>인기 포스트</a>
                            </Link>
                        </li>
                        <li>
                            <Link href="/newest">
                                <a>최신 포스트</a>
                            </Link>
                        </li>
                        <li>
                            <Link href="/tags">
                                <a>태그 클라우드</a>
                            </Link>
                        </li>
                    </ul>
                    {state.isLogin ? (
                        <ul className="menu-item">
                            <li>
                                <Link href={`/[author]`} as={`/@${state.username}`}>
                                    <a><i className="fas fa-user"></i> 내 블로그</a>
                                </Link>
                            </li>
                            <li>
                                <Link href="/write">
                                    <a><i className="fas fa-pencil-alt"></i> 포스트 작성</a>
                                </Link>
                            </li>
                        </ul>
                    ) : (
                        <></>
                    )}
                    <ul className="menu-footer-item">
                        <li>
                            <a onClick={() => onClickNightMode()}>
                                <i className={`fas fa-${state.theme !== 'dark' ? 'sun' : 'moon'}`}></i>
                            </a>
                        </li>
                        {state.isLogin ? (
                            <>
                                <li>
                                    <Link href="/setting">
                                        <a><i className="fas fa-cogs"></i> 설정</a>
                                    </Link>
                                </li>
                                <li>
                                    <a onClick={() => onClickLogout()}>
                                        <i className="fas fa-sign-out-alt"></i> 로그아웃
                                    </a>
                                </li>
                            </>
                        ) : (
                            <>
                                <li>
                                    <a onClick={() => Global.onOpenModal('isLoginModalOpen')}>
                                        <i className="fas fa-sign-in-alt"></i> 로그인
                                    </a>
                                </li>
                                <li>
                                    <a onClick={() => Global.onOpenModal('isSignupModalOpen')}>
                                        <i className="fas fa-users"></i> 회원가입
                                    </a>
                                </li>
                            </>
                        )}
                    </ul>
                    <ul className="menu-item">
                        <li>
                            <a target="_blank" href="https://www.notion.so/edfab7c5d5be4acd8d10f347c017fcca">
                                <i className="fas fa-book"></i> 서비스 안내서
                            </a>
                        </li>
                        <li>
                            <a target="_blank" href="mailto:im@baejino.com">
                                <i className="fas fa-at"></i> 이메일 보내기
                            </a>
                        </li>
                    </ul>
                </div>
            </div>
        </>
    )
}