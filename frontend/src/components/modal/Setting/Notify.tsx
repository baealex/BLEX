import React from 'react';
import Link from 'next/link';

import { toast } from 'react-toastify';

import API, { SettingNotifyData } from '../../../modules/api';

interface TabData extends SettingNotifyData {
    isTelegramSync: boolean;
}

interface Props {
    username: string;
    tabname: string;
    tabdata: TabData,
    fetchData: Function;
}

interface State {
    telegramToken: string;
}

class NotifySetting extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            telegramToken: '',
        };
    }

    async componentDidMount() {
        if(this.props.tabdata === undefined) {
            const { username, tabname } = this.props;
            let { data } = await API.getSetting('@' + username, tabname.toLowerCase());
            this.props.fetchData(tabname, data);
        }
    }

    async onReadNotify(pk: number) {
        const { username, tabname, tabdata } = this.props;
        const { data } = await API.putSetting('@' + username, tabname.toLowerCase(), { pk: pk });
        if(data == 'DONE') {
            let newData = tabdata;
            newData.notify = newData.notify.map(noti => {
                return noti.pk == pk ? {
                    ...noti,
                    isRead: true
                } : noti;
            });
            this.props.fetchData(tabname, newData);
        }
    }

    async onTelegramSync() {
        if(this.state.telegramToken) {
            toast('😅 이미 토큰이 생성되었습니다.');
            return;
        }
        const {data} = await API.telegram('makeToken');
        this.setState({
            ...this.state,
            telegramToken: data
        });
    }

    async onTelegramUnsync() {
        const {data} = await API.telegram('unsync');
        if(data == 'DONE') {
            toast('😀 텔레그램과 연동이 해제되었습니다.');
            const { tabname, tabdata } = this.props;
            if(data == 'DONE') {
                this.props.fetchData(tabname, {
                    ...tabdata,
                    isTelegramsync: false
                });
            }
        }
    }

    render() {
        if(!this.props.tabdata) return <>Loading...</>;

        return (
            <>
                {this.props.tabdata.isTelegramSync ? (
                    <div className="p-3 btn-primary c-pointer" onClick={() => this.onTelegramUnsync()}>
                        <i className="fab fa-telegram-plane"></i> 텔레그램과 연동을 해제할까요?
                    </div>
                ) : (
                    <div className="p-3 btn-primary c-pointer" onClick={() => this.onTelegramSync()}>
                        <i className="fab fa-telegram-plane"></i> 텔레그램으로 실시간 알림받기
                    </div>
                )}
                {this.state.telegramToken ? (
                    <div className="blex-card p-3">
                        텔레그램과 연동하면 어떤 효과가 있나요?
                        <ul>
                            <li>실시간으로 회원님의 알림을 전달해 드립니다.</li>
                            <li>오늘 하루를 마무리하는 일간 보고서를 전달해 드립니다.</li>
                        </ul>
                        어떻게 연동하나요?
                        <ul>
                            <li>텔레그램을 실행하시고 <a href="http://t.me/blex_bot" className="shallow-dark">@blex_bot</a>을 추가해주세요!</li>
                            <li>봇에게 <strong>{this.state.telegramToken}</strong>라고 말해주세요!</li>
                        </ul>
                        해당 토큰은 회원님을 위해 생성된 일회성 토큰이며 연동을 완료되거나 오늘이 지나면 파기됩니다.
                    </div>
                ) : ''}
                {this.props.tabdata.notify.length == 0 ? (
                    <div className="blex-card p-3">
                        최근 생성된 알림이 없습니다.
                    </div>
                ) : this.props.tabdata.notify.map((item, idx) => (
                    <Link key={idx} href={item.url}>
                        <a className={item.isRead ? 'deep-dark' : 'shallow-dark'} onClick={() => this.onReadNotify(item.pk)}>
                            <div className="blex-card p-3">{item.content} <span className="ns shallow-dark">{item.createdDate}전</span></div>
                        </a>
                    </Link>
                ))}

                <style jsx>{`
                    div.blex-card {
                        margin-top: 10px;
                    }
                `}</style>
            </>
        );
    }
}

export default NotifySetting;