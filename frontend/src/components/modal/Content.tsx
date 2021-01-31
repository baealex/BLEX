import React from 'react';

interface Props {
    children: JSX.Element | JSX.Element[];
}

export default function Overlay(props: Props) {
    return (
        <>
            <div className="noto">{props.children}</div>
            <style jsx>{`
                div {
                    margin: 8px;
                    padding: 8px;
                    margin-top: 48px;
                    max-height: 70vh;
                    overflow-y: auto;
                    overflow-x: hidden;
                }
            `}</style>
        </>
    )
}