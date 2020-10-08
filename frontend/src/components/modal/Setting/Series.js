import React from 'react';
import API from '../../../modules/api';

class SeriesSetting extends React.Component {
    constructor(props) {
        super(props);
    }

    async componentDidMount() {
        if(this.props.tabdata === undefined) {
            const { username, tabname } = this.props;
            let { data } = await API.getSetting('@' + username, tabname.toLowerCase());
            this.props.fetchData(tabname, data);
        }
    }

    render() {
        if(!this.props.tabdata) return <>Loading...</>;

        return (
            <>
                {this.props.tabdata.series.map((item, idx) => (
                    <div>{item.url}</div>
                ))}
            </>
        );
    }
}

export default SeriesSetting;