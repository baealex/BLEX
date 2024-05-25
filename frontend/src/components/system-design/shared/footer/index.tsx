import classNames from 'classnames/bind';
import styles from './Footer.module.scss';
const cx = classNames.bind(styles);

export interface FooterProps {
    isDark?: boolean;
    className?: string;
    children?: React.ReactNode;
}

export function Footer({
    isDark = false,
    className,
    children
}: FooterProps) {
    return (
        <footer
            className={cx('footer', { isDark }, className)}>
            {children && (
                <div className={cx('content')}>
                    {children}
                </div>
            )}
            <div className={cx('items')}>
                <div className={cx('item')}>
                    <a
                        href="https://about.blex.me"
                        target="_blank"
                        rel="noreferrer">
                        <i className="fas fa-info-circle" /> 서비스 소개
                    </a>
                </div>
                <div className={cx('item')}>
                    <a
                        href="https://github.com/baealex/BLEX"
                        target="_blank"
                        rel="noreferrer">
                        <i className="fab fa-github" /> 오픈소스
                    </a>
                </div>
                <div className={cx('item')}>
                    <a
                        href="https://discord.gg/cs2XcEwSr9"
                        target="_blank"
                        rel="noreferrer">
                        <i className="fab fa-discord" /> 커뮤니티
                    </a>
                </div>
            </div>
        </footer>
    );
}
