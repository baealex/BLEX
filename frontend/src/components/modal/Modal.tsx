import React from 'react';

import Overlay from '@components/modal/Overlay';
import Title from '@components/modal/Title';
import CloseButton from '@components/modal/CloseButton';

interface Props {
    isOpen: boolean;
    close: Function;
    title: string;
    children: JSX.Element | JSX.Element[];
}

class Modal extends React.Component<Props> {
    componentDidUpdate(prevProps: Props) {
        if(prevProps.isOpen !== this.props.isOpen) {
            if(this.props.isOpen) {
                document.body.style.overflow = 'hidden';
            } else {
                document.body.style.overflow = 'initial';
            }
        }
    }

    componentWillUnmount() {
        document.body.style.overflow = 'initial';
    }

    onClose() {
        this.props.close();
    }

    render() {
        return (
            <>
                {this.props.isOpen ? (
                    <>
                        <Overlay onClick={() => this.onClose()}/>
                        <>
                            <div>
                                <Title text={this.props.title}/>
                                <CloseButton onClick={() => this.props.close()}/>
                                {this.props.children}
                            </div>
                            <style jsx>{`
                                div {
                                    z-index: 1000;
                                    position: fixed;
                                    top: 50%;
                                    left: 50%;
                                    transform: translate(-50%, -50%);
                                    width: 500px;
                                    max-width: calc(100% - 16px);
                                    border-radius: 5px;
                                    background-color: #fff;
                                    box-shadow: 0px 3px 6px rgba(0, 0, 0, 0.45);

                                    @media (prefers-color-scheme: dark) {
                                        background-color: #000;
                                    }
                                }    
                            `}</style>
                        </>
                    </>
                ) : (
                    <></>
                )}
            </>
        )
    }
}

export default Modal;