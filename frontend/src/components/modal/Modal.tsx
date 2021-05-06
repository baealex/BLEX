import styles from './styles.module.scss';

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
                            <div className={styles.modal}>
                                <Title text={this.props.title}/>
                                <CloseButton onClick={() => this.props.close()}/>
                                {this.props.children}
                            </div>
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