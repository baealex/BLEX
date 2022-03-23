import styles from './EditorTitle.module.scss';

export interface EditorTitleProps {
    value: string;
    onChange: Function;
};

export function EditorTitle(props: EditorTitleProps) {
    return (
        <div className={styles.layout}>
            <button>
                <i className="far fa-image"/> 표지 이미지
            </button>
            <input
                name="title"
                placeholder="제목을 입력하세요."
                maxLength={50}
                value={props.value}
                onChange={(e) => props.onChange(e)}
            />
        </div>
    );
}