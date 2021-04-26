import { useEffect, useRef, useState } from 'react';

export interface ArcodianProps {
    minHeight?: number;
    children?: JSX.Element | JSX.Element[];
}

export function Arcodian(props: ArcodianProps) {
    const {
        minHeight = 130
    } = props;

    const [isOpen, setIsOpen] = useState(false);
    const [maxHeight, setMaxHeight] = useState(0);
    const divRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        if (divRef.current) {
            setMaxHeight(divRef.current.clientHeight + 30);
        }
    }, [divRef]);

    return (
        <>
            <div className="arcodian" style={{
                height: isOpen 
                    ? `${maxHeight}px`
                    : `${maxHeight < minHeight ? maxHeight : minHeight}px`
            }}>
                <div ref={divRef}>
                    {props.children}
                </div>
                <button onClick={() => setIsOpen(!isOpen)}>
                    <i className="fas fa-chevron-up"></i>
                </button>
            </div>
            <style jsx>{`
                .arcodian {
                    transition: height 1s;
                    overflow: hidden;
                    position: relative;

                    div {
                        display: block;
                    }

                    button {
                        background: none;
                        color: #ccc;
                        border: none;
                        outline: none;
                        width: 100%;
                        position: absolute;
                        bottom: 0;
                        left: 0;

                        i {
                            transition: transform 0.5s;
                            transform: rotateZ(${isOpen ? '0deg' : '-180deg'})
                        }
                    }
                }
            `}</style>
        </>
    );
}