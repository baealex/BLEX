import React from 'react';

import { toast } from 'react-toastify';

import API from '../../../modules/api';

class AccountSetting extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            realname: '',
            password: '',
            passwordCheck: '',
            allowEmailShow: false,
            allowHistoryCollect: false
        }
    }

    async componentDidMount() {
        let realname = '';
        if(this.props.tabdata === undefined) {
            const { username, tabname } = this.props;
            let { data } = await API.getSetting('@' + username, tabname.toLowerCase())
            this.props.fetchData(tabname, data);
            realname = data.realname;
        } else {
            realname = this.props.tabdata.realname;
        }
        this.setState({
            ...this.state,
            realname
        });
    }

    onInputChange(e) {
        let newState = this.state;
        newState[e.target.name] = e.target.value;
        this.setState(newState);
    }

    onCheckBoxChange(e) {
        let newState = this.state;
        newState[e.target.name] = e.target.checked;
        this.setState(newState);
    }

    async onSubmit() {
        let sendData = {};
        if(!this.state.realname) {
            toast('🤔 이름은 비워둘 수 없습니다.');
            return;
        }

        if(this.props.tabdata.realname != this.state.realname) {
            sendData.realname = this.state.realname;
        }

        if(this.state.password) {
            if(this.state.password != this.state.passwordCheck) {
                toast('🤔 입력한 패스워드가 서로 다릅니다.');
                return;
            }
            sendData.password = this.state.password;
        }

        const { username, tabname } = this.props; 
        const { data } = await API.putSetting('@' + username, tabname.toLowerCase(), sendData);
        if(data == 'DONE') {
            toast('😀 계정이 업데이트 되었습니다.');
        }
        this.props.fetchData(tabname, {
            ...this.props.tabdata,
            realname: sendData.realname,
        });
        this.setState({
            ...this.state,
            password: '',
            passwordCheck: ''
        });
    }

    onSignOut() {
        // TODO: SignOut
    }

    render() {
        if(!this.props.tabdata) return <>Loading...</>;

        return (
            <>
                <h3 className="serif font-weight-bold">
                    @{this.props.tabdata.username}
                </h3>
                <p className="serif">
                    {this.props.tabdata.created_date}
                </p>
                <input
                    type="text"
                    name="realname"
                    value={this.state.realname}
                    placeholder="이름"
                    className="form-control"
                    maxLength="30"
                    onChange={(e) => this.onInputChange(e)}
                />
                <input
                    type="password"
                    name="password"
                    value={this.state.password}
                    placeholder="새 비밀번호"
                    className="form-control"
                    maxLength="200"
                    onChange={(e) => this.onInputChange(e)}
                />
                <input
                    type="password"
                    name="passwordCheck"
                    value={this.state.passwordCheck}
                    placeholder="비밀번호 확인"
                    className="form-control"
                    maxLength="200"
                    onChange={(e) => this.onInputChange(e)}
                />
                {/*
                <div className="custom-control custom-checkbox mt-3">
                    <input
                        type="checkbox"
                        name="allowEmailShow"
                        className="custom-control-input"
                        id="emailCheckBox"
                        onChange={(e) => this.onCheckBoxChange(e)}
                    />
                    <label
                        className="custom-control-label"
                        htmlFor="emailCheckBox">이메일 노출 허용
                    </label>
                </div>
                <div className="custom-control custom-checkbox mt-3 mb-3">
                    <input
                        type="checkbox"
                        name="allowHistoryCollect"
                        className="custom-control-input"
                        id="historyCheckBox"
                        onChange={(e) => this.onCheckBoxChange(e)}
                    />
                    <label
                        className="custom-control-label"
                        for="historyCheckBox">사용자 활동 수집 허용
                    </label>
                </div>
                */}
                <button
                    type="button"
                    className="btn btn-dark"
                    onClick={() => this.onSubmit()}>정보 변경
                </button>
                <button
                    type="button"
                    className="btn btn-dark"
                    onClick={() => this.onSignOut()}>회원 탈퇴
                </button>

                <style jsx>{`
                    input {
                        margin-bottom: 15px;
                    }
                    button {
                        margin-right: 5px;
                    }
                `}</style>
            </>
        );
    }
}

export default AccountSetting;