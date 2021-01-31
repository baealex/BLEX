interface Props {
    onClick: Function;
}

export default function CloseButton(props: Props) {
    return (
        <>
            <div onClick={() => props.onClick()}>
                <i className="fas fa-times"></i>
            </div>
            <style jsx>{`
                div {
                    margin: 16px 16px 0 0;
                    font-size: 1.2rem;
                    color: #999;
                    position: absolute;
                    top: 0;
                    right: 0;

                    &:hover {
                        color: #000;
                    }

                    @media (prefers-color-scheme: dark) {
                        color: #ccc;

                        &:hover {
                            color: #fff;
                        }
                    }
                }
            `}</style>
        </>
    );
}