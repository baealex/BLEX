import React from 'react'

class Modal extends React.Component {
    constructor(props) {
        super(props);
    }

    onClose() {
        this.props.close();
    }

    render() {
        return (
            <>
                {this.props.show ? (
                    <>
                        <div onClick={() => this.onClose()} className="modal-overlay"/>
                        <div className="modal-b">
                            {this.props.title ? <div className="title">{this.props.title}</div> : ''}
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