import styles from './TopNavigation.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import React, { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import Router from 'next/router';

import { toast } from 'react-toastify';

import * as API from '@modules/api';
import { getUserImage } from '@modules/image';
import {
    LoginModal,
    SignupModal,
    AuthModal,
} from './modals';

import { authContext } from '@state/auth';
import { configContext } from '@state/config';
import { modalContext } from '@state/modal';
import { Dropdown } from '@components/atoms';

export function TopNavigation() {
    const [isRollup, setIsRollup] = useState(false);
    const [state, setState] = useState({
        theme: configContext.state.theme,
        isLogin: authContext.state.isLogin,
        username: authContext.state.username,
        avatar: authContext.state.avatar,
        notify: authContext.state.notify,
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
                avatar: nextState.avatar,
                notify: nextState.notify,
            }));
        });
        const configUpdateKey = configContext.appendUpdater((nextState) => {
            setState((prevState) => ({
                ...prevState,
                theme: nextState.theme,
            }))
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
            configContext.popUpdater(configUpdateKey);
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
            if (data.status === 'DONE') {
                authContext.setState({
                    isLogin: true,
                    ...data.body,
                });
            }
        });
    }, []);

    useEffect(() => {
        let ticking = false;
        let lastScrollY = window.scrollY;

        const event = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    if (lastScrollY < window.scrollY && lastScrollY > 0) {
                        setIsRollup(true);
                    } else {
                        setIsRollup(false);
                    }
                    lastScrollY = window.scrollY;
                    ticking = false;
                });
                ticking = true;
            }
        };

        document.addEventListener('scroll', event);

        return () => document.removeEventListener('scroll', event);
    }, []);

    const onClickLogout = async () => {
        if(confirm('😮 정말 로그아웃 하시겠습니까?')) {
            const { data } = await API.postLogout();
            if(data.status === 'DONE') {
                authContext.setState({
                    isLogin: false,
                    username: '',
                    avatar: '',
                    notify: [],
                });
                toast('😀 로그아웃 되었습니다.');
            }
        }
    }

    const notifyCount = useMemo(() => {
        return state.notify.filter(item => !item.isRead).length;
    }, [state.notify]);

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
            <nav className={cn('top-nav', { isRollup })}>
                <div className={cn('container', 'h-100')}>
                    <div className={cn('d-flex', 'justify-content-between', 'align-items-center', 'h-100')}>
                        <Link href="/">
                            <a className={cn('logo')}>
                                {state.theme === 'dark' ? (
                                    <img src="/logow.svg"/>
                                ) : (
                                    <img src="/logob.svg"/>
                                )}
                            </a>
                        </Link>
                        <ul className={cn('items')}>
                            <li onClick={() => Router.push('/search')}>
                                <i className="fas fa-search"/>
                            </li>
                            {state.isLogin ? (
                                <>
                                    <li
                                        onClick={() => Router.push('/setting')}
                                        className={cn('notify')}
                                    >
                                        <i className="far fa-bell"/>
                                        {notifyCount > 0 && (
                                            <span>
                                                {notifyCount}
                                            </span>
                                        )}
                                    </li>
                                    <li
                                        onClick={() => Router.push('/write')}
                                        className={cn('get-start')}
                                    >
                                        글 작성하기
                                    </li>
                                    <li className={cn('profile')}>
                                        <Dropdown
                                            position="left"
                                            button={
                                                <>
                                                    <img src={getUserImage(state.avatar)}/>
                                                    <i className="fas fa-sort-down"/>
                                                </>
                                            }
                                            menus={[
                                                {
                                                    name: '내 블로그',
                                                    onClick: () => Router.push(`/@${state.username}`),
                                                },
                                                {
                                                    name: '설정',
                                                    onClick: () => Router.push(`/setting/account`),
                                                },
                                                {
                                                    name: '로그아웃',
                                                    onClick: () => onClickLogout(),
                                                }
                                            ]}
                                        />
                                    </li>
                                </>
                            ) : (
                                <>
                                    <li onClick={() => modalContext.onOpenModal('isLoginModalOpen')}>
                                        로그인
                                    </li>
                                    <li
                                        onClick={() => modalContext.onOpenModal('isSignupModalOpen')}
                                        className={cn('get-start')}
                                    >
                                        블로그 시작
                                    </li>
                                </>
                            )}
                        </ul>
                    </div>
                </div>
            </nav>
        </>
    )
}