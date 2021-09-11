import styles from './TopNavigation.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

import React, { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';

import { toast } from 'react-toastify';

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

import { authContext } from '@state/auth';
import { configContext } from '@state/config';
import { modalContext } from '@state/modal';
import { Card, Dropdown } from '@components/atoms';

export function TopNavigation() {
    const router = useRouter();

    const notifyBox = useRef<HTMLDivElement>(null);
    const notifyToggle = useRef<HTMLLIElement>(null);

    const [path, setPath] = useState(router.pathname);
    const [isRollup, setIsRollup] = useState(false);
    const [isMenuOpen, setisMenuOpen] = useState(false);
    const [isNotifyOpen, setIsNotifyOpen] = useState(false);
    const [state, setState] = useState({
        ...authContext.state,
        ...modalContext.state,
        theme: configContext.state.theme,
    });

    useEffect(() => {
        const authUpdateKey = authContext.appendUpdater((nextState) => {
            setState((prevState) => ({
                ...prevState,
                ...nextState,
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
                ...nextState,
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
                        configContext.setTheme('dark');
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
        let ticking = false;
        let lastScrollY = window.scrollY;

        if (path.lastIndexOf('/write') > -1 || path.lastIndexOf('/edit') > -1) {
            setIsRollup(false);
            return;
        }

        const event = () => {
            if (!ticking) {
                window.requestAnimationFrame(() => {
                    if (lastScrollY < window.scrollY && lastScrollY > 0) {
                        setIsRollup(true);
                        setIsNotifyOpen(false);
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
                authContext.initState();
                toast('😀 로그아웃 되었습니다.');
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
                toast(API.EMOJI.AFTER_REQ_ERR + data.errorMessage);
                return;
            }
            toast('😀 텔레그램과 연동이 해제되었습니다.');
            setState((prevState) => ({
                ...prevState,
                isTelegramSync: false
            }));
        }
    }

    const onReadNotify = async (pk: number) => {
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
                                        <div ref={notifyBox} className={cn('notify-contnet', { isOpen: isNotifyOpen })}>
                                            {state.notify.length == 0 ? (
                                                <Card hasShadow shadowLevel="sub" fillBack isRounded className="my-2 p-3">
                                                    최근 생성된 알림이 없습니다.
                                                </Card>
                                            ) : state.notify.map((item, idx) => (
                                                <Link key={idx} href={item.url}>
                                                    <a className={item.isRead ? 'shallow-dark' : 'deep-dark'} onClick={() => onReadNotify(item.pk)}>
                                                        <Card hasShadow shadowLevel="sub" fillBack isRounded className="my-2 p-3">
                                                            <>
                                                                {item.content} <span className="ns shallow-dark">{item.createdDate}전</span>
                                                            </>
                                                        </Card>
                                                    </a>
                                                </Link>
                                            ))}
                                            {state.isTelegramSync ? (
                                                <div className={cn('sync-btn')} onClick={() => unsync()}>
                                                    <i className="fab fa-telegram-plane"/> 텔레그램 연동 해제
                                                </div>
                                            ) : (
                                                <div className={cn('sync-btn')} onClick={() => modalContext.onOpenModal('isTelegramSyncModalOpen')}>
                                                    <i className="fab fa-telegram-plane"/> 텔레그램 연동
                                                </div>
                                            )}
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
                                                    name: state.theme === 'default' ? '라이트 모드' : '다크 모드',
                                                    icon: state.theme === 'default' ?  'fas fa-sun' : 'far fa-moon',
                                                    onClick: () => {
                                                        if (state.theme === 'default') {
                                                            configContext.setTheme('dark');
                                                        }
                                                        else if (state.theme === 'dark') {
                                                            configContext.setTheme('default');
                                                        }
                                                    },
                                                },
                                                {
                                                    name: '설정',
                                                    icon: 'fas fa-cog',
                                                    onClick: () => router.push(`/setting/account`),
                                                },
                                                {
                                                    name: '전체 메뉴',
                                                    icon: 'fas fa-th-large',
                                                    onClick: () => setisMenuOpen(true),
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
                <div className={cn('all-menu', { 'isOpen': isMenuOpen })}>
                    <div className={cn('close')} onClick={() => setisMenuOpen(false)}>
                        <i className="fas fa-times"/>
                    </div>
                    <div className="container">
                        <div className={cn('header')}>포스트 조회</div>
                        <ul>
                            <li>
                                <Link href="/search">
                                    <a>검색</a>
                                </Link>
                            </li>
                            <li>
                                <Link href="/">
                                    <a>주간 트렌드</a>
                                </Link>
                            </li>
                            <li>
                                <Link href="/">
                                    <a>최신 포스트</a>
                                </Link>
                            </li>
                            <li>
                                <Link href="/popular">
                                    <a>인기 포스트</a>
                                </Link>
                            </li>
                            <li>
                                <Link href="/tags">
                                    <a>태그 클라우드</a>
                                </Link>
                            </li>
                            <li>내가 추천한 포스트</li>
                            <li>구독한 블로거 피드</li>
                        </ul>
                        <div className={cn('header')}>댓글 조회</div>
                        <ul>
                            <li>내가 작성한 댓글</li>
                            <li>내가 추천한 댓글</li>
                        </ul>
                        <div className={cn('header')}>블로그</div>
                        <ul>
                            <li>
                                <Link href={`/@${state.username}`}>
                                    <a>내 블로그</a>
                                </Link>
                            </li>
                            <li>
                                <Link href="/write">
                                    <a>새 글 작성</a>
                                </Link>
                            </li>
                            <li>
                                <Link href="/setting/posts">
                                    <a>포스트 관리</a>
                                </Link>
                            </li>
                            <li>
                                <Link href="/setting/series">
                                    <a>시리즈 관리</a>
                                </Link>
                            </li>
                            <li>
                                <Link href="/setting/forms">
                                    <a>글 서식 관리</a>
                                </Link>
                            </li>
                            <li>
                                <Link href="/setting/analytics">
                                    <a>조회수 및 유입 분석</a>
                                </Link>
                            </li>
                        </ul>
                        <div className={cn('header')}>계정</div>
                        <ul>
                            <li>
                                <Link href="/setting/account">
                                    <a>아이디 / 패스워드 변경</a>
                                </Link>
                            </li>
                            <li>
                                <Link href="/setting/account">
                                    <a>2차 인증</a>
                                </Link>
                            </li>
                            <li>
                                <Link href="/setting/profile">
                                    <a>포스트 관리</a>
                                </Link>
                            </li>
                            <li>
                                <Link href="/setting/account">
                                    <a>회원탈퇴</a>
                                </Link>
                            </li>
                        </ul>
                    </div>
                </div>
            )}
        </>
    )
}