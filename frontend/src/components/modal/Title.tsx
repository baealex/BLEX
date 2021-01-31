interface Props {
    text: string;
}

export default function Title(props: Props) {
    return (
        <>
            <div className="noto font-weight-bold">{props.text}</div>
            <style jsx>{`
                div {
                    margin: 16px 0 0 16px;
                    font-size: 1.2rem;
                    color: #555;
                    position: absolute;
                    top: 0;
                    left: 0;

                    @media (prefers-color-scheme: dark) {
                        color: #ccc;
                    }
                }
            `}</style>
        </>
    );
}