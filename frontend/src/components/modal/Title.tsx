import styles from './styles.module.scss';

interface Props {
    text: string;
}

export default function Title(props: Props) {
    return (
        <>
            <div className={`noto font-weight-bold ${styles.title}`}>
                {props.text}
            </div>
        </>
    );
}