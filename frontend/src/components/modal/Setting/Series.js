import React from 'react';
import Link from 'next/link';

import { toast } from 'react-toastify';

import API from '@modules/api';

class SeriesSetting extends React.Component {
    constructor(props) {
        super(props);
        this.state = {
            newSeriesName: ''
        }
    }

    async componentDidMount() {
        const state = this.state;
        if(this.props.tabdata === undefined) {
            const { username, tabname } = this.props;
            const { data } = await API.getSetting('@' + username, tabname.toLowerCase());
            this.props.fetchData(tabname, data);
            this.setState({
                ...data,
                ...state
            });
        } else {
            const { tabdata } = this.props;
            this.setState({
                ...tabdata,
                ...state
            });
        }
    }

    async onSeriesCreate() {
        const { newSeriesName } = this.state;
        if(!newSeriesName) {
            toast('😅 시리즈의 이름을 입력하세요.');
            return;
        }
        const { data } = await API.postSeries('@' + this.props.username, newSeriesName);
        toast('😀 시리즈가 생성되었습니다.');
        const { series } = this.state;
        series.unshift({
            url: data,
            title: newSeriesName,
            totalPosts: 0
        });
        this.setState({
            newSeriesName: '',
            series
        });
    }

    async onSeriesDelete(url) {
        if(confirm('😮 정말 이 시리즈를 삭제할까요?')) {
            const { tabname, username } = this.props;
            const { data } = await API.deleteSeries('@' + username, url);
            if(data == 'DONE') {
                let newState = this.state;
                newState.series = newState.series.filter(series => (
                    series.url !== url
                ));
                this.props.fetchData(tabname, newState);
                toast('😀 시리즈가 삭제되었습니다.');
            }   
        }
    }

    onInputChange(e) {
        let newState = this.state;
        newState[e.target.name] = e.target.value;
        this.setState(newState);
    }

    render() {
        if(!this.props.tabdata) return <>Loading...</>;

        return (
            <>
                <div className="input-group mb-3">
                    <input
                        type="text"
                        name="newSeriesName"
                        placeholder="시리즈의 이름"
                        className="form-control"
                        maxLength="50"
                        onChange={(e) => this.onInputChange(e)}
                        value={this.state.newSeriesName}
                    />
                    <div className="input-group-prepend">
                        <button type="button" className="btn btn-dark" onClick={() => this.onSeriesCreate()}>새 시리즈 만들기</button>
                    </div>
                </div>
                {this.props.tabdata.series.map((item, idx) => (
                    <div key={idx} className="blex-card p-3 mb-3 d-flex justify-content-between">
                        <Link href="/[author]/series/[seriesurl]" as={`/@${this.props.username}/series/${item.url}`}>
                            <a className="deep-dark">
                                {item.title} <span className="vs">{item.totalPosts}</span>
                            </a>
                        </Link>
                        <a onClick={() => this.onSeriesDelete(item.url)}>
                            <i className="fas fa-times"></i>
                        </a>
                    </div>
                ))}
            </>
        );
    }
}

export default SeriesSetting;