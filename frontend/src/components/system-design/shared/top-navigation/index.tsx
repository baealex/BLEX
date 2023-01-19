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
    const path = router.pathname;

    const notifyToggle = useRef<HTMLLIElement>(null);

    const [isRollup, setIsRollup] = useState(false);

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

        if (path.endsWith('/write') || path.endsWith('/edit')) {
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
                setIsRollup(true);
                accScrollY = -80;
            }

            lastScrollY = window.scrollY;
        });

        document.addEventListener('scroll', event);

        return () => document.removeEventListener('scroll', event);
    }, [path]);

    const onClickLogout = async () => {
        if (confirm(message('CONFIRM', '정말 로그아웃 하시겠습니까?'))) {
            const { data } = await API.postLogout();
            if (data.status === 'DONE') {
                authStore.logout();
                snackBar(message('AFTER_REQ_DONE', '로그아웃 되었습니다.'));
            }
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
                                    <img alt="logo" src={'/logob.svg'}/>
                                </a>
                            </Link>
                        </div>
                        <nav>
                            <ul className={cn('items')}>
                                <li>
                                    <button aria-label="search" onClick={() => router.push('/search')}>
                                        <i className="fas fa-search"/>
                                    </button>
                                </li>
                                {auth.isLogin ? (
                                    <>
                                        <li
                                            ref={notifyToggle}
                                            className={cn('notify')}>
                                            <button aria-label="notify" onClick={() => router.push('/setting/notify')}>
                                                <i className="far fa-bell"/>
                                            </button>
                                            {auth.notifyCount > 0 && (
                                                <span>
                                                    {auth.notifyCount}
                                                </span>
                                            )}
                                        </li>
                                        {path.endsWith('/write') || path.endsWith('/edit') ? (
                                            <li className={cn('get-start')}>
                                                <button aria-label="submit" onClick={() => modalStore.open('isPublishModalOpen')}>
                                                    {path.lastIndexOf('/write') > -1
                                                        ? '글 발행하기'
                                                        : '글 수정하기'}
                                                </button>
                                            </li>
                                        ) : (
                                            <li className={cn('get-start', 'outline')}>
                                                <button aria-label="write" onClick={() => router.push('/write')}>
                                                    글 작성하기
                                                </button>
                                            </li>
                                        )}
                                        <li className={cn('profile')}>
                                            <Dropdown
                                                position="left"
                                                button={
                                                    <>
                                                        <img alt={auth.username} src={getUserImage(auth.avatar)}/>
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
                                        <button aria-label="get-start" onClick={() => modalStore.open('isLoginModalOpen')}>
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
