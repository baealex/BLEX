import styles from './Footer.module.scss';
import classNames from 'classnames';

export interface FooterProps {
    bgdark?: boolean;
    children?: JSX.Element;
};

export function Footer(props: FooterProps) {
    const {
        bgdark = false
    } = props;

    return (
        <footer
            className={classNames(
                styles.footer,
                bgdark && styles.bgDark,
            )}
        >
            {props.children}
            <div className="text-center py-3">
                Copyright 2021 &copy; <a href="https://baejino.com">BaeJino</a>.
            </div>
        </footer>
    );
}