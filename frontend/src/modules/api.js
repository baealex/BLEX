import Config from './config.json'
import axios from 'axios'

function serializeObject(obj) {
    return Object.keys(obj).reduce((acc, cur) => {
        return acc += `${cur}=${obj[cur]}&`
    }, '').slice(0, -1);
}

class API {
    async getAllPosts(sort, page) {
        return await axios.get(`${Config.API_SERVER}/v1/posts/${sort}?page=${page}`);
    }

    async getPost(url) {
        return await axios.get(`${Config.API_SERVER}/v1/post/${encodeURIComponent(url)}`);
    }

    async getSeries(pk) {
        return await axios.get(`${Config.API_SERVER}/v1/series/${pk}`);
    }

    async login(username, password) {
        return await axios({
            url: `${Config.API_SERVER}/v1/login`,
            method: 'POST',
            headers: {
                'content-type': 'application/x-www-form-urlencoded'
            },
            data: serializeObject({
                username,
                password
            })
        });
    }
}

export default new API();