import styles from './TopNavigation.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { snackBar } from '@modules/snack-bar';

import * as API from '@modules/api';
import { getUserImage } from '@modules/image';
import {
    LoginModal,
    SignupModal,
    SignoutModal,
    TelegramSyncModal,
    TwoFactorAuthModal,
    TwoFactorAuthSyncModal,
} from './modals';
import { DayNight } from './day-night';
import { AllPages } from './all-pages';

import { Dropdown } from '@components/integrated';

import { optimizedEvent } from '@modules/event';

import { authContext } from '@state/auth';
import { configContext } from '@state/config';
import { modalContext } from '@state/modal';

export function TopNavigation() {
    const router = useRouter();

    const notifyBox = useRef<HTMLDivElement>(null);
    const notifyToggle = useRef<HTMLLIElement>(null);

    const [path, setPath] = useState(router.pathname);
    const [isRollup, setIsRollup] = useState(false);
    const [isMenuOpen, setisMenuOpen] = useState(false);
    const [isNotifyOpen, setIsNotifyOpen] = useState(false);
    const [isNight, setIsNight] = useState(false);
    const [state, setState] = useState({
        ...authContext.state,
        ...modalContext.state,
    });

    useEffect(() => {
        setIsNight(configContext.state.theme === 'dark');
    }, [])

    useEffect(() => {
        if (isNight) {
            configContext.setTheme('dark');
        } else {
            configContext.setTheme('default');
        }
    }, [isNight])

    useEffect(() => {
        const authUpdateKey = authContext.append((nextState) => {
            setState((prevState) => ({
                ...prevState,
                ...nextState,
            }));
        });
        const configUpdateKey = configContext.append((nextState) => {
            setState((prevState) => ({
                ...prevState,
                theme: nextState.theme,
            }))
        });
        const modalUpdateKey = modalContext.append((nextState) => {
            setState((prevState) => ({
                ...prevState,
                ...nextState,
            }));
        });

        return () => {
            authContext.pop(authUpdateKey);
            configContext.pop(configUpdateKey);
            modalContext.pop(modalUpdateKey);
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
                    setIsNight(true);
                }
            } else {
                document.body.classList.add(configContext.state.theme);
            }

            systemDark.addEventListener('change', e => {
                if (configContext.state.theme === 'default' || configContext.state.theme === 'dark') {
                    if (e.matches) {
                        configContext.setTheme('dark');
                        setIsNight(true);
                    } else {
                        configContext.setTheme('default');
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
        let accScrollY = 0;
        let lastScrollY = window.scrollY;

        if (path.lastIndexOf('/write') > -1 || path.lastIndexOf('/edit') > -1) {
            setIsRollup(false);
            return;
        }

        const event = optimizedEvent(() => {
            if (window.scrollY > 0) {
                accScrollY += lastScrollY - window.scrollY;
            }

            if (window.scrollY == 0 || accScrollY > 0) {
                setIsRollup(false);
                accScrollY = 0;
            }
            
            if (accScrollY < -80) {
                setIsNotifyOpen(false);
                setIsRollup(true);
                accScrollY = -80;
            }

            lastScrollY = window.scrollY;
        });

        document.addEventListener('scroll', event);

        return () => document.removeEventListener('scroll', event);
    }, [path]);

    useEffect(() => {
        const handleClick = (e: MouseEvent) => {
            const path = e.composedPath && e.composedPath();

            if (
                !path.includes(notifyBox.current as EventTarget) &&
                !path.includes(notifyToggle.current as EventTarget)
            ) {
                setIsNotifyOpen(false);
            }
        };

        document.addEventListener('click', handleClick);
        return () => {
            document.removeEventListener('click', handleClick);
        }
    }, []);

    useEffect(() => {
        router.events.on('routeChangeStart', () => {
            setisMenuOpen(false);
        });

        router.events.on('routeChangeComplete', (url) => {
            setPath(url);
        });
    }, []);

    useEffect(() => {
        if (isMenuOpen) {
            document.body.style.overflow = 'hidden';
        } else {
            document.body.style.overflow = '';
        }
    }, [isMenuOpen]);

    const onClickLogout = async () => {
        if(confirm('😮 정말 로그아웃 하시겠습니까?')) {
            const { data } = await API.postLogout();
            if(data.status === 'DONE') {
                authContext.logout();
                snackBar('😀 로그아웃 되었습니다.');
            }
        }
    }

    const notifyCount = useMemo(() => {
        return state.notify.filter(item => !item.isRead).length;
    }, [state.notify]);

    const unsync = async () => {
        if(confirm('😥 정말 연동을 해제할까요?')) {
            const { data } = await API.postTelegram('unsync');
            if (data.status === 'ERROR') {
                snackBar(API.EMOJI.AFTER_REQ_ERR + data.errorMessage);
                return;
            }
            snackBar('😀 텔레그램과 연동이 해제되었습니다.');
            setState((prevState) => ({
                ...prevState,
                isTelegramSync: false
            }));
        }
    }

    const onReadNotify = async (pk: number, url: string) => {
        const { data } = await API.putSetting('notify', { pk: pk });
        if(data.status === 'DONE') {
            setState((prevState) => ({
                ...prevState,
                notify : prevState.notify.map(item => {
                    return item.pk == pk
                        ? { ...item, isRead: true }
                        : item;
                })
            }));
            router.push(url);
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
            <SignoutModal
                isOpen={state.isSignoutModalOpen}
                onClose={() => modalContext.onCloseModal('isSignoutModalOpen')}
            />
            <TelegramSyncModal
                isOpen={state.isTelegramSyncModalOpen}
                onClose={() => modalContext.onCloseModal('isTelegramSyncModalOpen')}
            />
            <TwoFactorAuthModal
                isOpen={state.isTwoFactorAuthModalOpen}
                onClose={() => modalContext.onCloseModal('isTwoFactorAuthModalOpen')}
            />
            <TwoFactorAuthSyncModal
                isOpen={state.isTwoFactorAuthSyncModalOpen}
                onClose={() => modalContext.onCloseModal('isTwoFactorAuthSyncModalOpen')}
            />
            <nav className={cn('top-nav', { isRollup })}>
                <div className={cn('container', 'h-100')}>
                    <div className={cn('d-flex', 'justify-content-between', 'align-items-center', 'h-100')}>
                        <div className={cn('logo')}>
                            <Link href="/">
                                <a>
                                    <img src="/logob.svg"/>
                                </a>
                            </Link>
                        </div>
                        <ul className={cn('items')}>
                            <li onClick={() => router.push('/search')}>
                                <i className="fas fa-search"/>
                            </li>
                            {state.isLogin ? (
                                <>
                                    <li
                                        ref={notifyToggle}
                                        onClick={() => setIsNotifyOpen((prev) => !prev)}
                                        className={cn('notify')}
                                    >
                                        <i className="far fa-bell"/>
                                        {notifyCount > 0 && (
                                            <span>
                                                {notifyCount}
                                            </span>
                                        )}
                                        <div ref={notifyBox} className={cn('notify-box', { isOpen: isNotifyOpen })}>
                                            {state.isTelegramSync ? (
                                                <div className={cn('telegram')} onClick={() => unsync()}>
                                                    <i className="fab fa-telegram-plane"/> 텔레그램 연동 해제
                                                </div>
                                            ) : (
                                                <div className={cn('telegram')} onClick={() => modalContext.onOpenModal('isTelegramSyncModalOpen')}>
                                                    <i className="fab fa-telegram-plane"/> 텔레그램 연동
                                                </div>
                                            )}
                                            {state.notify.length == 0 ? (
                                                <div className={cn('card')}>
                                                    최근 생성된 알림이 없습니다.
                                                </div>
                                            ) : state.notify.map((item, idx) => (
                                                <div key={idx} className={cn('card')} onClick={() => onReadNotify(item.pk, item.url)}>
                                                    {item.content} <span className="ns shallow-dark">{item.createdDate}전</span>
                                                </div>
                                            ))}
                                        </div>
                                    </li>
                                    {path.lastIndexOf('/write') > -1 || path.lastIndexOf('/edit') > -1 ? (
                                        <li
                                            onClick={() => modalContext.onOpenModal('isPublishModalOpen')}
                                            className={cn('get-start')}
                                        >
                                            {path.lastIndexOf('/write') > -1
                                                ? '글 발행하기' 
                                                : '글 수정하기'}
                                        </li>
                                    ) : (
                                        <li
                                            onClick={() => router.push('/write')}
                                            className={cn('get-start', 'outline')}
                                        >
                                            글 작성하기
                                        </li>
                                    )}
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
                                                    icon: 'far fa-user',
                                                    onClick: () => router.push(`/@${state.username}`),
                                                },
                                                {
                                                    name: '전체 메뉴',
                                                    icon: 'fas fa-th-large',
                                                    onClick: () => setisMenuOpen(true),
                                                },
                                                {
                                                    name: '설정',
                                                    icon: 'fas fa-cog',
                                                    onClick: () => router.push(`/setting/account`),
                                                },
                                                {
                                                    name: '로그아웃',
                                                    icon: 'fas fa-sign-out-alt',
                                                    onClick: () => onClickLogout(),
                                                },
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
            {state.isLogin && (
                <AllPages
                    isOpen={isMenuOpen}
                    onClose={setisMenuOpen}
                    username={state.username}
                />
            )}
            <DayNight isNight={isNight} onChange={setIsNight}/>
        </>
    )
}