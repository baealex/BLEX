import styles from './EditorTitle.module.scss';

export interface EditorTitleProps {
    value: string;
    onChange: Function;
};

export function EditorTitle(props: EditorTitleProps) {
    return (
        <>
            <input
                name="title"
                className={styles.title}
                placeholder="제목을 입력하세요."
                maxLength={50}
                value={props.value}
                onChange={(e) => props.onChange(e)}
            />
        </>
    );
}