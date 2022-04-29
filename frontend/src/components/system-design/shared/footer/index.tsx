import classNames from 'classnames/bind';
import styles from './Footer.module.scss';
const cn = classNames.bind(styles);

export interface FooterProps {
    isDark?: boolean;
    children?: JSX.Element;
}

export function Footer({
    isDark = false,
    children,
}: FooterProps) {
    return (
        <footer className={cn('footer', {
            isDark 
        })}>
            {children && (
                <div className={cn('content')}>
                    {children}
                </div>
            )}
            <div className={cn('items')}>
                <div>
                    <a target="_blank" href="https://www.notion.so/edfab7c5d5be4acd8d10f347c017fcca">
                        서비스 소개
                    </a>
                </div>
                <div>
                    <a target="_blank" href="https://discord.gg/d4vCnB3CSr">
                        커뮤니티 참여
                    </a>
                </div>
                <div>
                    <a target="_blank" href="https://github.com/baealex/BLEX">
                        오픈소스
                    </a>
                </div>
                <div>
                    <a href="mailto:im@baejino.com">
                        연락처
                    </a>
                </div>
            </div>
        </footer>
    );
}