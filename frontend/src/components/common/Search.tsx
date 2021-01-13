import React from 'react';

interface State {
    search: string;
}

class Search extends React.Component {
    state: State;

    constructor(props: any) {
        super(props);
        this.state = {
            search: ''
        };
    }

    onChange(e: React.ChangeEvent<HTMLInputElement>) {
        this.setState({
            [e.target.name]: e.target.value
        });
    }

    onKeyPress(e: React.KeyboardEvent<HTMLInputElement>) {
        if(e.key == 'Enter') {
            window.open('about:blank')!.location.href = `https://duckduckgo.com/?q=${encodeURIComponent(`${this.state.search} site:${location.host}`)}`;
        }
    }
    
    render() {
        return (
            <input
                autoComplete="off"
                className="search"
                name="search"
                type="text"
                value={this.state.search}
                placeholder="덕덕고에서 검색"
                onChange={(e) => this.onChange(e)}
                onKeyPress={(e) => this.onKeyPress(e)}
            />
        );
    }
}

export default Search;