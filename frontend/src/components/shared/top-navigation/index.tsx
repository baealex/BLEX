import styles from './TopNavigation.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import Router from 'next/router'

import { toast } from 'react-toastify';

import * as API from '@modules/api';
import { Search } from './search';
import {
    LoginModal,
    SignupModal,
    AuthModal,
} from './modals';

import { authContext } from '@state/auth';
import { configContext } from '@state/config';
import { modalContext } from '@state/modal';

export function TopNavigation() {
    const [state, setState] = useState({
        onNav: false,
        theme: configContext.state.theme,
        isLogin: authContext.state.isLogin,
        username: authContext.state.username,
        isLoginModalOpen: modalContext.state.isLoginModalOpen,
        isSignupModalOpen: modalContext.state.isSignupModalOpen,
        isTwoFactorAuthModalOpen: modalContext.state.isTwoFactorAuthModalOpen,
    });

    useEffect(() => {
        const authUpdateKey = authContext.appendUpdater((nextState) => {
            setState((prevState) => ({
                ...prevState,
                isLogin: nextState.isLogin,
                username: nextState.username,
            }));
        });
        const modalUpdateKey = modalContext.appendUpdater((nextState) => {
            setState((prevState) => ({
                ...prevState,
                isLoginModalOpen: nextState.isLoginModalOpen,
                isSignupModalOpen: nextState.isSignupModalOpen,
                isTwoFactorAuthModalOpen: nextState.isTwoFactorAuthModalOpen,
            }));
        });

        return () => {
            authContext.popUpdater(authUpdateKey);
            modalContext.popUpdater(modalUpdateKey);
        }
    }, []);

    useEffect(() => {
        try {
            const isFirstVisit = configContext.isFirstVisit();
            const systemDark = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)');

            if (systemDark && isFirstVisit) {
                if(systemDark.matches) {
                    document.body.classList.add('dark');
                    configContext.setState((state) => ({
                        ...state,
                        theme: 'dark',
                    }));
                }
            } else {
                document.body.classList.add(configContext.state.theme);
            }

            systemDark.addEventListener('change', e => {
                if (configContext.state.theme === 'default' || configContext.state.theme === 'dark') {
                    if (e.matches) {
                        document.body.classList.add('dark');
                        configContext.setState((prevState) => ({
                            ...prevState,
                            theme: 'dark',
                        }));
                    } else {
                        document.body.classList.remove('dark');
                        configContext.setState((prevState) => ({
                            ...prevState,
                            theme: 'default',
                        }));
                    }
                }
            });
        } catch(e) {
            document.body.classList.add(configContext.state.theme);
        }
    }, []);

    useEffect(() => {
        API.getLogin().then(({data}) => {
            authContext.setState({
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
            configContext.setState((prevState) => ({
                ...prevState,
                theme: 'default',
            }));
        } else {
            document.body.classList.add('dark');
            configContext.setState((prevState) => ({
                ...prevState,
                theme: 'dark',
            }));
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
                authContext.setState({
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
                onClose={() => modalContext.onCloseModal('isLoginModalOpen')}
            />
            <SignupModal
                isOpen={state.isSignupModalOpen}
                onClose={() => modalContext.onCloseModal('isSignupModalOpen')}
            />
            <AuthModal
                isOpen={state.isTwoFactorAuthModalOpen}
                onClose={() => modalContext.onCloseModal('isTwoFactorAuthModalOpen')}
            />
            <div className={cn('outer', { on : state.onNav })}>
                <nav
                    onClick={() => onClickNavigation()}
                    className={cn('button', { on : state.onNav })}>
                    <img src="/logo32.png" alt="logo"/>
                </nav>
                <div className={cn('inner')}>
                    <Search/>
                    <ul className={cn('items')}>
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
                        <ul className={cn('items')}>
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
                    <ul className={cn('footer')}>
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
                                    <a onClick={() => modalContext.onOpenModal('isLoginModalOpen')}>
                                        <i className="fas fa-sign-in-alt"></i> 로그인
                                    </a>
                                </li>
                                <li>
                                    <a onClick={() => modalContext.onOpenModal('isSignupModalOpen')}>
                                        <i className="fas fa-users"></i> 회원가입
                                    </a>
                                </li>
                            </>
                        )}
                    </ul>
                    <ul className={cn('items')}>
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