import classNames from 'classnames/bind';
import styles from './TopNavigation.module.scss';
const cn = classNames.bind(styles);

import React, {
    useEffect,
    useRef,
    useState
} from 'react';
import Link from 'next/link';
import { useRouter } from 'next/router';
import { useStore } from 'badland-react';

import {
    LoginModal,
    SignoutModal,
    SignupModal,
    TelegramSyncModal,
    TwoFactorAuthModal,
    TwoFactorAuthSyncModal
} from './modals';
import { Dropdown } from '@design-system';

import * as API from '~/modules/api';
import { getUserImage } from '~/modules/utility/image';
import { message } from '~/modules/utility/message';
import { optimizeEvent } from '~/modules/optimize/event';
import { snackBar } from '~/modules/ui/snack-bar';

import { authStore } from '~/stores/auth';
import { modalStore } from '~/stores/modal';

export function TopNavigation() {
    const router = useRouter();

    const notifyBox = useRef<HTMLDivElement>(null);
    const notifyToggle = useRef<HTMLLIElement>(null);

    const [path, setPath] = useState(router.pathname);
    const [isRollup, setIsRollup] = useState(false);
    const [isNotifyOpen, setIsNotifyOpen] = useState(false);

    const [auth, setAuth] = useStore(authStore);
    const [modal] = useStore(modalStore);

    useEffect(() => {
        API.getLogin().then(({ data }) => {
            if (data.status === 'DONE') {
                setAuth({
                    isConfirmed: true,
                    isLogin: true,
                    ...data.body
                });
            } else {
                setAuth({ isConfirmed: true });
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

        const event = optimizeEvent(() => {
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

        return () => document.removeEventListener('click', handleClick);
    }, []);

    useEffect(() => {
        const handleChangeRoute = (url: string) => {
            setPath(url);
        };
        router.events.on('routeChangeComplete', handleChangeRoute);

        return () => router.events.off('routeChangeComplete', handleChangeRoute);
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

    const handleUnsyncTelegram = async () => {
        if (confirm(message('CONFIRM', '정말 연동을 해제할까요?'))) {
            const { data } = await API.postTelegram('unsync');
            if (data.status === 'ERROR') {
                snackBar(message('AFTER_REQ_ERR', data.errorMessage));
                return;
            }
            snackBar(message('AFTER_REQ_DONE', '연동이 해제되었습니다.'));
            setAuth((prevState) => ({
                ...prevState,
                isTelegramSync: false
            }));
        }
    };

    const onReadNotify = async (pk: number, url: string) => {
        const { data } = await API.putSetting('notify', { pk });
        if (data.status === 'DONE') {
            setAuth((prevState) => ({
                ...prevState,
                notify : prevState.notify.filter(item => pk != item.pk)
            }));
            router.push(url);
        }
    };

    return (
        <>
            <LoginModal
                isOpen={modal.isLoginModalOpen}
                onClose={() => modalStore.close('isLoginModalOpen')}
            />
            <SignupModal
                isOpen={modal.isSignupModalOpen}
                onClose={() => modalStore.close('isSignupModalOpen')}
            />
            <SignoutModal
                isOpen={modal.isSignoutModalOpen}
                onClose={() => modalStore.close('isSignoutModalOpen')}
            />
            <TelegramSyncModal
                isOpen={modal.isTelegramSyncModalOpen}
                onClose={() => modalStore.close('isTelegramSyncModalOpen')}
            />
            <TwoFactorAuthModal
                isOpen={modal.is2FAModalOpen}
                onClose={() => modalStore.close('is2FAModalOpen')}
            />
            <TwoFactorAuthSyncModal
                isOpen={modal.is2FASyncModalOpen}
                onClose={() => modalStore.close('is2FASyncModalOpen')}
            />
            <header className={cn('top-nav', { isRollup })}>
                <div className={cn('container', 'h-100')}>
                    <div className={cn('d-flex', 'justify-content-between', 'align-items-center', 'h-100')}>
                        <div className={cn('logo')}>
                            <Link href="/">
                                <a>
                                    <img src={'/logob.svg'}/>
                                </a>
                            </Link>
                        </div>
                        <nav>
                            <ul className={cn('items')}>
                                <li>
                                    <button onClick={() => router.push('/search')}>
                                        <i className="fas fa-search"/>
                                    </button>
                                </li>
                                {auth.isLogin ? (
                                    <>
                                        <li
                                            ref={notifyToggle}
                                            className={cn('notify')}>
                                            <button onClick={() => setIsNotifyOpen((prev) => !prev)}>
                                                <i className="far fa-bell"/>
                                            </button>
                                            {auth.notify.length > 0 && (
                                                <span>
                                                    {auth.notify.length}
                                                </span>
                                            )}
                                            <div
                                                ref={notifyBox}
                                                className={cn('notify-box', { isOpen: isNotifyOpen })}>
                                                {auth.isTelegramSync ? (
                                                    <div className={cn('telegram')} onClick={handleUnsyncTelegram}>
                                                        <i className="fab fa-telegram-plane"/> 텔레그램 연동 해제
                                                    </div>
                                                ) : (
                                                    <div className={cn('telegram')} onClick={() => modalStore.open('isTelegramSyncModalOpen')}>
                                                        <i className="fab fa-telegram-plane"/> 텔레그램 연동
                                                    </div>
                                                )}
                                                {auth.notify.length == 0 ? (
                                                    <div className={cn('card')}>
                                                        읽지 않은 알림이 없습니다.
                                                    </div>
                                                ) : auth.notify.map((item, idx) => (
                                                    <div key={idx} className={cn('card')} onClick={() => onReadNotify(item.pk, item.url)}>
                                                        {item.content} <span className="ns shallow-dark">{item.createdDate} ago</span>
                                                    </div>
                                                ))}
                                            </div>
                                        </li>
                                        {path.lastIndexOf('/write') > -1 || path.lastIndexOf('/edit') > -1 ? (
                                            <li className={cn('get-start')}>
                                                <button onClick={() => modalStore.open('isPublishModalOpen')}>
                                                    {path.lastIndexOf('/write') > -1
                                                        ? '글 발행하기'
                                                        : '글 수정하기'}
                                                </button>
                                            </li>
                                        ) : (
                                            <li className={cn('get-start', 'outline')}>
                                                <button onClick={() => router.push('/write')}>
                                                    글 작성하기
                                                </button>
                                            </li>
                                        )}
                                        <li className={cn('profile')}>
                                            <Dropdown
                                                position="left"
                                                button={
                                                    <>
                                                        <img src={getUserImage(auth.avatar)}/>
                                                        <i className="fas fa-sort-down"/>
                                                    </>
                                                }
                                                menus={[
                                                    {
                                                        name: '내 블로그',
                                                        icon: 'far fa-user',
                                                        onClick: () => router.push(`/@${auth.username}`)
                                                    },
                                                    {
                                                        name: '관리',
                                                        icon: 'fas fa-cog',
                                                        onClick: () => router.push('/setting/account')
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
                                    <li className={cn('get-start')}>
                                        <button onClick={() => modalStore.open('isLoginModalOpen')}>
                                            블로그 시작
                                        </button>
                                    </li>
                                )}
                            </ul>
                        </nav>
                    </div>
                </div>
            </header>
        </>
    );
}
