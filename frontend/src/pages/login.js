import Head from 'next/head';
import React from 'react'

import API from '../modules/api'

class Post extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            username: '',
            password: ''
        }
    }

    componentDidMount() {
        
    }

    onInputChange(e) {
        let newState = this.state;
        newState[e.target.name] = e.target.value;
        this.setState(newState);
    }

    async onClickLogin() {
        const { data } = await API.login(this.state.username, this.state.password);
        if(data.login == 'success') {
            alert('로그인 완료!');
        } else {
            alert('로그인 실패!');
        }
    }

    render() {
        console.log(this.props);
        return (
            <>
                <Head>
                    <title></title>
                </Head>

                <div>
                    <input
                        name='username'
                        onChange={(e) => this.onInputChange(e)}
                        value={this.state.username}
                    />
                    <input
                        name='password'
                        type='password'
                        onChange={(e) => this.onInputChange(e)}
                        value={this.state.password}
                    />
                    <button onClick={() => this.onClickLogin()}>로그인</button>
                </div>
            </>
        )
    }
}

export default Post