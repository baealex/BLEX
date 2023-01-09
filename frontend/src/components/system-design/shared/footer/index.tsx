import classNames from 'classnames/bind';
import styles from './Footer.module.scss';
const cn = classNames.bind(styles);

export interface FooterProps {
    isDark?: boolean;
    children?: JSX.Element;
}

export function Footer({
    isDark = false,
    children
}: FooterProps) {
    return (
        <footer
            className={cn('footer', { isDark })}>
            {children && (
                <div className={cn('content')}>
                    {children}
                </div>
            )}
            <div className={cn('items')}>
                <div className={cn('item')}>
                    <a
                        href="https://www.notion.so/edfab7c5d5be4acd8d10f347c017fcca"
                        target="_blank"
                        rel="noreferrer">
                        <i className="far fa-star"/> 서비스 소개
                    </a>
                </div>
                <div className={cn('item')}>
                    <a
                        href="https://github.com/baealex/BLEX"
                        target="_blank"
                        rel="noreferrer">
                        <i className="fab fa-github"/> 오픈소스
                    </a>
                </div>
                <div className={cn('item')}>
                    <a
                        href="https://discord.gg/cs2XcEwSr9"
                        target="_blank"
                        rel="noreferrer">
                        <i className="fab fa-discord"/> 커뮤니티
                    </a>
                </div>
                <div className={cn('item')}>
                    <a
                        href="mailto:im@baejino.com"
                        target="_blank"
                        rel="noreferrer">
                        <i className="fas fa-at"/> 연락처
                    </a>
                </div>
            </div>
        </footer>
    );
}
