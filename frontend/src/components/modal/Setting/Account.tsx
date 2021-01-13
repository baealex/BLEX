import React from 'react';

import { toast } from 'react-toastify';

import API, { SettingAccountData, ERROR } from '@modules/api';
import Global from '@modules/global';

interface Props {
    username: string;
    tabname: string;
    tabdata: SettingAccountData,
    fetchData: Function;
}

interface State {
    username: string;
    realname: string;
    password: string;
    passwordCheck: string;
    isChangeUsername: boolean;
    allowEmailShow: boolean;
    allowHistoryCollect: boolean;
}

class AccountSetting extends React.Component<Props, State> {
    state: State;

    constructor(props: Props) {
        super(props);
        this.state = {
            username: '',
            realname: '',
            password: '',
            passwordCheck: '',
            isChangeUsername: false,
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
            realname,
            username: this.props.username
        });
    }

    onInputChange(e: React.ChangeEvent<HTMLInputElement>) {
        this.setState({
            ...this.state,
            [e.target.name]: e.target.value
        });
    }

    onCheckBoxChange(e: React.ChangeEvent<HTMLInputElement>) {
        this.setState({
            ...this.state,
            [e.target.name]: e.target.checked
        });
    }

    async onSubmit() {
        let sendData: any = {};
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
            password: '',
            passwordCheck: ''
        });
    }

    onSignOut() {
        // TODO: SignOut
    }

    async onChangeUsername() {
        if(!this.state.isChangeUsername) {
            this.setState({
                isChangeUsername: true
            });
        } else {
            const { data } = await API.putUsername(
                this.props.username,
                this.state.username
            );
            if(data == ERROR.REJECT) {
                toast('😥 작성한 댓글과 포스트가 존재하여 변경할 수 없습니다.');
                this.setState({
                    isChangeUsername: false
                });
                return;
            }
            if(data == ERROR.ALREADY_EXISTS) {
                toast('😥 이미 존재하는 아이디입니다.');
                return;
            }
            if(data == 'DONE') {
                toast('😀 아이디가 변경되었습니다.');
                Global.setState({
                    username: this.state.username
                });
                this.setState({
                    isChangeUsername: false
                });
            }
        }
    }

    render() {
        if(!this.props.tabdata) return <>Loading...</>;

        return (
            <>
                {this.state.isChangeUsername ? (
                    <div className="input-group mb-3">
                        <input
                            type="text"
                            name="username"
                            placeholder="아이디"
                            className="form-control"
                            value={this.state.username}
                            onChange={(e) => this.onInputChange(e)}/>
                        <div className="input-group-prepend">
                            <button
                                type="button"
                                className="btn btn-dark"
                                onClick={() => this.onChangeUsername()}>
                                변경
                            </button>
                            <button
                                type="button"
                                className="btn btn-dark"
                                onClick={() => {
                                    this.setState({
                                        isChangeUsername: false,
                                        username: this.props.username
                                    })
                                }}>
                                취소
                            </button>
                        </div>
                    </div>
                ) : (
                    <div className="d-flex justify-content-between">
                        <h3 className="serif font-weight-bold">
                            @{this.props.username}
                        </h3>
                        <button
                            type="button"
                            className="btn btn-dark"
                            onClick={() => this.onChangeUsername()}>
                            아이디 변경
                        </button>
                    </div>
                )}
                <p className="serif">
                    {this.props.tabdata.createdDate}
                </p>
                <input
                    type="text"
                    name="realname"
                    value={this.state.realname}
                    placeholder="이름"
                    className="form-control"
                    maxLength={30}
                    onChange={(e) => this.onInputChange(e)}
                />
                <input
                    type="password"
                    name="password"
                    value={this.state.password}
                    placeholder="새 비밀번호"
                    className="form-control"
                    maxLength={200}
                    onChange={(e) => this.onInputChange(e)}
                />
                <input
                    type="password"
                    name="passwordCheck"
                    value={this.state.passwordCheck}
                    placeholder="비밀번호 확인"
                    className="form-control"
                    maxLength={200}
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