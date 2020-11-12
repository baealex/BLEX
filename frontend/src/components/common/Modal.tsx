import React from 'react';

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
                        <div onClick={() => this.onClose()} className="modal-overlay"/>
                        <div className="modal-b">
                            {this.props.title ? <div className="title serif font-weight-bold">{this.props.title}</div> : ''}
                            <div onClick={() => this.onClose()} className="close-button">
                                <i className="fas fa-times"></i>
                            </div>
                            {this.props.children}
                        </div>
                    </>
                ) : (
                    <></>
                )}
            </>
        )
    }
}

export default Modal