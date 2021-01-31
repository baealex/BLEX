import React from 'react';

interface Props {
    text: string;
    onClick: Function;
}

export default function Overlay(props: Props) {
    return (
        <>
            <div onClick={() => props.onClick()}>
                <button>{props.text}</button>
            </div>
            <style jsx>{`
                div {
                    margin: 0;
                    margin-top: 8px;
                    
                    button {
                        width: 100%;
                        padding: 12px 0;
                        border-radius: 0 0 5px 5px;
                        background-color: #444;
                        font-size: 13pt;
                        color: white;
                        border: 0;
                        cursor: pointer;

                        &:hover {
                            background-color: #333;
                        }

                        &:active {
                            background-color: #111;
                        }

                        &:focus {
                            outline: none;
                        }
                    }
                }
            `}</style>
        </>
    )
}