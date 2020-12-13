import React from 'react';

import Modal from '../../common/Modal';
import NotifySetting from './Notify';
import AccountSetting from './Account';
import ProfileSetting from './Profile';
import PostsSetting from './Posts';
import SeriesSetting from './Series';

import Global from '../../../modules/global';

type tabName = 'Notify' | 'Account' | 'Profile' | 'Posts' | 'Series';

interface Props {
    isOpen: boolean;
    onClose: Function;
}

interface State {
    username: string;
    activateTab: tabName;
    data: any;
}

class SettingModal extends React.Component<Props, State> {
    constructor(props: Props) {
        super(props);
        this.state = {
            username: Global.state.username,
            activateTab: 'Notify',
            data: {}
        };
        Global.appendUpdater('SettingModal', () => {
            this.setState({
                username: Global.state.username,
                activateTab: 'Notify',
                data: {},
            });
        });
    }

    fetchData(tab: tabName, data: any) {
        let newState = this.state;
        newState.data[tab] = data;
        this.setState(newState);
    }
    
    render() {
        const tabList = [
            'Notify',
            'Account',
            'Profile',
            'Posts',
            'Series'
        ];

        const tabCheck = (tab: tabName) => {
            if(tabList.indexOf(tab) > -1) {
                return this.state.activateTab == tab ? true : false;
            }
        }

        const tabChange = (tab: tabName) => {
            if(tabList.indexOf(tab) > -1) {
                if(this.state.activateTab != tab) {
                    this.setState({...this.state, activateTab: tab});
                }
            }
        }

        const tab = () => {
            const porps = {
                username: this.state.username,
                tabname: this.state.activateTab,
                tabdata: this.state.data[this.state.activateTab],
                fetchData: (tab: tabName, data: any) => this.fetchData(tab, data)
            };

            switch(this.state.activateTab) {
                case 'Notify':
                    return (
                        <NotifySetting {...porps}/>
                    );
                case 'Account':
                    return (
                        <AccountSetting {...porps}/>
                    );
                case 'Profile':
                    return (
                        <ProfileSetting {...porps}/>
                    );
                case 'Posts':
                    return (
                        <PostsSetting {...porps}/>
                    );
                case 'Series':
                    return (
                        <SeriesSetting {...porps}/>
                    );
            }
        }

        return (
            <>
                <Modal title='설정' isOpen={this.props.isOpen} close={() => this.props.onClose()}>
                    <div className="content noto">
                        {tab()}
                    </div>
                    <div className="row-navigator noto">
                        <ul>
                            <li
                                className={tabCheck('Notify') ? 'active' : ''}
                                onClick={() => tabChange('Notify')}>
                                <i className="far fa-envelope"></i>알림
                            </li>
                            <li
                                className={tabCheck('Account') ? 'active' : ''}
                                onClick={() => tabChange('Account')}>
                                <i className="far fa-user"></i>계정
                            </li>
                            <li
                                className={tabCheck('Profile') ? 'active' : ''}
                                onClick={() => tabChange('Profile')}>
                                <i className="far fa-id-badge"></i>프로필
                            </li>
                            <li
                                className={tabCheck('Posts') ? 'active' : ''}
                                onClick={() => tabChange('Posts')}>
                                <i className="fas fa-book"></i>포스트
                            </li>
                            <li
                                className={tabCheck('Series') ? 'active' : ''}
                                onClick={() => tabChange('Series')}>
                                <i className="fas fa-pencil-alt"></i>시리즈
                            </li>
                        </ul>
                    </div>
                </Modal>
            </>
        );
    }
}

export default SettingModal;