import styles from './styles.module.scss';

interface Props {
    onClick: Function;
}

export default function CloseButton(props: Props) {
    return (
        <>
            <div className={styles.close} onClick={() => props.onClick()}>
                <i className="fas fa-times"></i>
            </div>
        </>
    );
}