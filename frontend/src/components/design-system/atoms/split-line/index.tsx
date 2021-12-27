import styles from './SplitLine.module.scss';

export function SplitLine() {
    return (
        <div className={styles.group}>
            <div className={styles.line}/>
            <span>또는</span>
        </div>
    )
}