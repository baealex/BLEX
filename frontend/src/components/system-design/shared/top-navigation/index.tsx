import classNames from 'classnames/bind';
import styles from './TopNavigation.module.scss';
const cn = classNames.bind(styles);

import React, {
    useEffect, useRef, useState
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

import {
    LoginModal,
    SignoutModal,
    SignupModal,
    TelegramSyncModal,
    TwoFactorAuthModal,
    TwoFactorAuthSyncModal
} from './modals';
import { DayNight } from './day-night';
import { Dropdown } from '@design-system';

import * as API from '@modules/api';
import { getUserImage } from '@modules/utility/image';
import { message } from '@modules/utility/message';
import { optimizedEvent } from '@modules/optimize/event';
import { snackBar } from '@modules/ui/snack-bar';
import { syncTheme } from '@modules/utility/darkmode';

import { authStore } from '@stores/auth';
import { configStore } from '@stores/config';
import { modalStore } from '@stores/modal';

export function TopNavigation() {
    const router = useRouter();

    const notifyBox = useRef<HTMLDivElement>(null);
    const notifyToggle = useRef<HTMLLIElement>(null);

    const [path, setPath] = useState(router.pathname);
    const [isRollup, setIsRollup] = useState(false);
    const [isNotifyOpen, setIsNotifyOpen] = useState(false);
    const [isNight, setIsNight] = useState(false);
    const [state, setState] = useState({
        ...authStore.state,
        ...modalStore.state
    });

    useEffect(() => {
        setIsNight(configStore.state.theme === 'dark');
    }, []);

    useEffect(() => {
        if (isNight) {
            configStore.setTheme('dark');
        } else {
            configStore.setTheme('default');
        }
    }, [isNight]);

    useEffect(() => {
        const authUpdateKey = authStore.subscribe((nextState) => {
            setState((prevState) => ({
                ...prevState,
                ...nextState
            }));
        });
        const configUpdateKey = configStore.subscribe((nextState) => {
            setState((prevState) => ({
                ...prevState,
                theme: nextState.theme
            }));
        });
        const modalUpdateKey = modalStore.subscribe((nextState) => {
            setState((prevState) => ({
                ...prevState,
                ...nextState
            }));
        });

        return () => {
            authStore.unsubscribe(authUpdateKey);
            configStore.unsubscribe(configUpdateKey);
            modalStore.unsubscribe(modalUpdateKey);
        };
    }, []);

    useEffect(() => {
        syncTheme((isDark) => {
            if (isDark) {
                configStore.setTheme('dark');
                setIsNight(true);
            } else {
                configStore.setTheme('default');
                setIsNight(false);
            }
        }, configStore.isFirstVisit());
    }, []);

    useEffect(() => {
        API.getLogin().then(({ data }) => {
            if (data.status === 'DONE') {
                authStore.set({
                    isConfirmed: true,
                    isLogin: true,
                    ...data.body
                });
            } else {
                authStore.set({ isConfirmed: true });
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
        };
    }, []);

    useEffect(() => {
        router.events.on('routeChangeComplete', (url) => {
            setPath(url);
        });
    }, []);

    const onClickLogout = async () => {
        if (confirm(message('CONFIRM', '정말 로그아웃 하시겠습니까?'))) {
            const { data } = await API.postLogout();
            if (data.status === 'DONE') {
                authStore.logout();
                snackBar(message('AFTER_REQ_DONE', '로그아웃 되었습니다.'));
            }
        }
    };

    const unsync = async () => {
        if (confirm(message('CONFIRM', '정말 연동을 해제할까요?'))) {
            const { data } = await API.postTelegram('unsync');
            if (data.status === 'ERROR') {
                snackBar(message('AFTER_REQ_ERR', data.errorMessage));
                return;
            }
            snackBar(message('AFTER_REQ_DONE', '연동이 해제되었습니다.'));
            setState((prevState) => ({
                ...prevState,
                isTelegramSync: false
            }));
        }
    };

    const onReadNotify = async (pk: number, url: string) => {
        const { data } = await API.putSetting('notify', { pk });
        if (data.status === 'DONE') {
            setState((prevState) => ({
                ...prevState,
                notify : prevState.notify.filter(item => pk != item.pk)
            }));
            router.push(url);
        }
    };

    return (
        <>
            <LoginModal
                isOpen={state.isLoginModalOpen}
                onClose={() => modalStore.close('isLoginModalOpen')}
            />
            <SignupModal
                isOpen={state.isSignupModalOpen}
                onClose={() => modalStore.close('isSignupModalOpen')}
            />
            <SignoutModal
                isOpen={state.isSignoutModalOpen}
                onClose={() => modalStore.close('isSignoutModalOpen')}
            />
            <TelegramSyncModal
                isOpen={state.isTelegramSyncModalOpen}
                onClose={() => modalStore.close('isTelegramSyncModalOpen')}
            />
            <TwoFactorAuthModal
                isOpen={state.is2FAModalOpen}
                onClose={() => modalStore.close('is2FAModalOpen')}
            />
            <TwoFactorAuthSyncModal
                isOpen={state.is2FASyncModalOpen}
                onClose={() => modalStore.close('is2FASyncModalOpen')}
            />
            <header className={cn('top-nav', { isRollup })}>
                <div className={cn('container', 'h-100')}>
                    <div className={cn('d-flex', 'justify-content-between', 'align-items-center', 'h-100')}>
                        <div className={cn('logo')}>
                            <Link href="/">
                                <a>
                                    <img src="/logob.svg"/>
                                </a>
                            </Link>
                        </div>
                        <nav>
                            <ul className={cn('items')}>
                                <li onClick={() => router.push('/search')}>
                                    <i className="fas fa-search"/>
                                </li>
                                {state.isLogin ? (
                                    <>
                                        <li
                                            ref={notifyToggle}
                                            onClick={() => setIsNotifyOpen((prev) => !prev)}
                                            className={cn('notify')}>
                                            <i className="far fa-bell"/>
                                            {state.notify.length > 0 && (
                                                <span>
                                                    {state.notify.length}
                                                </span>
                                            )}
                                            <div
                                                ref={notifyBox}
                                                className={cn('notify-box', { isOpen: isNotifyOpen })}>
                                                {state.isTelegramSync ? (
                                                    <div className={cn('telegram')} onClick={() => unsync()}>
                                                        <i className="fab fa-telegram-plane"/> 텔레그램 연동 해제
                                                    </div>
                                                ) : (
                                                    <div className={cn('telegram')} onClick={() => modalStore.open('isTelegramSyncModalOpen')}>
                                                        <i className="fab fa-telegram-plane"/> 텔레그램 연동
                                                    </div>
                                                )}
                                                {state.notify.length == 0 ? (
                                                    <div className={cn('card')}>
                                                        읽지 않은 알림이 없습니다.
                                                    </div>
                                                ) : state.notify.map((item, idx) => (
                                                    <div key={idx} className={cn('card')} onClick={() => onReadNotify(item.pk, item.url)}>
                                                        {item.content} <span className="ns shallow-dark">{item.createdDate} ago</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </li>
                                        {path.lastIndexOf('/write') > -1 || path.lastIndexOf('/edit') > -1 ? (
                                            <li
                                                onClick={() => modalStore.open('isPublishModalOpen')}
                                                className={cn('get-start')}>
                                                {path.lastIndexOf('/write') > -1
                                                    ? '글 발행하기'
                                                    : '글 수정하기'}
                                            </li>
                                        ) : (
                                            <li
                                                onClick={() => router.push('/write')}
                                                className={cn('get-start', 'outline')}>
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
                                                        onClick: () => router.push(`/@${state.username}`)
                                                    },
                                                    {
                                                        name: '관리',
                                                        icon: 'fas fa-cog',
                                                        onClick: () => router.push('/setting/account')
                                                    },
                                                    {
                                                        name: '전체',
                                                        icon: 'fas fa-th-large',
                                                        onClick: () => router.push('/map')
                                                    },
                                                    {
                                                        name: '로그아웃',
                                                        icon: 'fas fa-sign-out-alt',
                                                        onClick: onClickLogout
                                                    }
                                                ]}
                                            />
                                        </li>
                                    </>
                                ) : (
                                    <>
                                        <li onClick={() => modalStore.open('isLoginModalOpen')}>
                                            로그인
                                        </li>
                                        <li
                                            onClick={() => modalStore.open('isSignupModalOpen')}
                                            className={cn('get-start')}>
                                            블로그 시작
                                        </li>
                                    </>
                                )}
                            </ul>
                        </nav>
                    </div>
                </div>
            </header>
            <DayNight isNight={isNight} onChange={setIsNight}/>
        </>
    );
}
