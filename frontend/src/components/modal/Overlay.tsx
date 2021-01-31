import React from 'react';

interface Props {
    onClick: Function;
}

export default function Overlay(props: Props) {
    return (
        <>
            <div onClick={() => props.onClick()}/>
            <style jsx>{`
                div {
                    z-index: 999;
                    position: fixed;
                    top: 0;
                    left: 0;
                    bottom: 0;
                    right: 0;
                    background-color: rgba(0, 0, 0, 0.48);

                    @media (prefers-color-scheme: dark) {
                        background-color: rgba(255, 255, 255, .1);
                    }
                }
            `}</style>
        </>
    )
}