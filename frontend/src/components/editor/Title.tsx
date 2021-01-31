interface Props {
    title: string;
    onChange: Function;
};

export default function EditorTitle(props: Props) {
    return (
        <>
            <input
                name="title"
                className="noto"
                placeholder="제목을 입력하세요."
                maxLength={50}
                value={props.title}
                onChange={(e) => props.onChange(e)}
            />
            <style jsx>{`
                input {
                    width: 100%;
                    border: none;
                    display: block;
                    font-size: 2rem;
                    font-weight: bold;
                    margin-bottom: 15px;
                    background: none;
                    color: #000;
            
                    &:focus {
                        outline: none;
                    }
            
                    &::placeholder {
                        color: #ccc;
                    }

                    @media (prefers-color-scheme: dark) {
                        color: #fff;
                    }
                }
            `}</style>
        </>
    );
}