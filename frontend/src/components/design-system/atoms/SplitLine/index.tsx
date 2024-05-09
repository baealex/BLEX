import styles from './SplitLine.module.scss';

interface SplitLineProps {
    hasText?: boolean;
}

export function SplitLine({ hasText }: SplitLineProps) {
    return (
        <div className={styles.group}>
            <div className={styles.line} />
            {hasText && (
                <span>또는</span>
            )}
        </div>
    );
}