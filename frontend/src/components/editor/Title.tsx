import styles from './styles.module.scss';

interface Props {
    value: string;
    onChange: Function;
};

export default function EditorTitle(props: Props) {
    return (
        <>
            <input
                name="title"
                className={`noto ${styles.title}`}
                placeholder="제목을 입력하세요."
                maxLength={50}
                value={props.value}
                onChange={(e) => props.onChange(e)}
            />
        </>
    );
}