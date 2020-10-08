import React from 'react';

import { toast } from 'react-toastify';

import API from '../../../modules/api';

class ProfileSetting extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            avatar: undefined,
            homepage: '',
            github: '',
            twitter: '',
            youtube: '',
            facebook: '',
            instagram: ''
        };
    }

    async componentDidMount() {
        if(this.props.tabdata === undefined) {
            const { username, tabname } = this.props;
            const { data } = await API.getSetting('@' + username, tabname.toLowerCase())
            this.props.fetchData(tabname, data);
            this.setState(data);
        } else {
            this.setState(this.props.tabdata);
        }
    }

    onInputChange(e) {
        let newState = this.state;
        newState[e.target.name] = e.target.value;
        this.setState(newState);
    }

    async onSubmit() {
        let sendData = {};
        const socialList = [
            'homepage',
            'github',
            'twitter',
            'facebook',
            'instagram',
            'youtube'
        ];
        socialList.forEach(item => {
            sendData[item] = this.state[item];
        });
        const { username, tabname } = this.props;
        const { data } = await API.putSetting('@' + username, tabname.toLowerCase(), sendData);
        if(data == 'DONE') {
            toast('😀 프로필이 업데이트 되었습니다.');
            this.props.fetchData(tabname, {
                ...this.props.tabdata,
                ...sendData
            });
        }
    }

    render() {
        return (
            <>
                <label>Homepage : </label>
                <div className="input-group mb-3">
                    <div className="input-group-prepend">
                        <span className="input-group-text">https://</span>
                    </div>
                    <input
                        type="text"
                        name="homepage"
                        className="form-control"
                        maxLength="100"
                        value={this.state.homepage}
                        onChange={(e) => this.onInputChange(e)}
                    />
                </div>
                <label>GitHub : </label>
                <div className="input-group mb-3">
                    <div className="input-group-prepend">
                        <span className="input-group-text">https://github.com/</span>
                    </div>
                    <input
                        type="text"
                        name="github"
                        className="form-control"
                        maxLength="100"
                        value={this.state.github}
                        onChange={(e) => this.onInputChange(e)}
                    />
                </div>
                <label>Twitter : </label>
                <div className="input-group mb-3">
                    <div className="input-group-prepend">
                        <span className="input-group-text">https://twitter.com/</span>
                    </div>
                    <input
                        type="text"
                        name="twitter"
                        className="form-control"
                        maxLength="100"
                        value={this.state.twitter}
                        onChange={(e) => this.onInputChange(e)}
                    />
                </div>
                <label>Facebook : </label>
                <div className="input-group mb-3">
                    <div className="input-group-prepend">
                        <span className="input-group-text">https://facebook.com/</span>
                    </div>
                    <input
                        type="text"
                        name="facebook"
                        className="form-control"
                        maxLength="100"
                        value={this.state.facebook}
                        onChange={(e) => this.onInputChange(e)}
                    />
                </div>
                <label>Instagram : </label>
                <div className="input-group mb-3">
                    <div className="input-group-prepend">
                        <span className="input-group-text">https://instagram.com/</span>
                    </div>
                    <input
                        type="text"
                        name="instagram"
                        className="form-control"
                        maxLength="100"
                        value={this.state.instagram}
                        onChange={(e) => this.onInputChange(e)}
                    />
                </div>
                <label>YouTube : </label>
                <div className="input-group mb-3">
                    <div className="input-group-prepend">
                        <span className="input-group-text">https://youtube.com/channel/</span>
                    </div>
                    <input
                        type="text"
                        name="youtube"
                        className="form-control"
                        maxLength="100"
                        value={this.state.youtube}
                        onChange={(e) => this.onInputChange(e)}
                    />
                </div>
                <button
                    type="button"
                    className="btn btn-block btn-dark"
                    onClick={() => this.onSubmit()}>프로필 변경</button>
            </>
        );
    }
}

export default ProfileSetting;