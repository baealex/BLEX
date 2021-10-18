import styles from './Footer.module.scss';
import classNames from 'classnames/bind';
const cn = classNames.bind(styles);

export interface FooterProps {
    bgdark?: boolean;
    children?: JSX.Element;
};

export function Footer({
    bgdark = false,
    children,
}: FooterProps) {
    return (
        <footer className={cn('footer', { bgdark })}>
            {children && (
                <div className={cn('content')}>
                    {children}
                </div>
            )}
            <div className={cn('text-center')}>
                <div className={cn('items')}>
                    <div>
                        <a target="_blank" href="https://www.notion.so/58e7e6ab9a2d441d8f824ef852e77059">
                            Terms
                        </a>
                    </div>
                    <div>
                        <a target="_blank" href="https://www.notion.so/b3901e0837ec40e3983d16589314b59a">
                            Guide
                        </a>
                    </div>
                    <div>
                        <a target="_blank" href="https://discord.gg/d4vCnB3CSr">
                            Discord
                        </a>
                    </div>
                    <div>
                        <a target="_blank" href="https://github.com/baealex/BLEX">
                            GitHub
                        </a>
                    </div>
                    <div>
                        <a href="mailto:im@baejino.com">
                            Contact
                        </a>
                    </div>
                </div>
            </div>
        </footer>
    );
}