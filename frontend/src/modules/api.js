import Config from './config.json'
import axios from 'axios'

function serializeObject(obj) {
    return Object.keys(obj).reduce((acc, cur) => {
        return acc += obj[cur] ? `${cur}=${obj[cur]}&` : '';
    }, '').slice(0, -1);
}

axios.defaults.withCredentials = true;

class API {
    async alive() {
        return await axios({
            url: `${Config.API_SERVER}/v1/alive`,
            method: 'GET',
        });
    }

    async getAllPosts(sort, page) {
        return await axios({
            url: `${Config.API_SERVER}/v1/posts/${sort}?page=${page}`,
            method: 'GET',
        });
    }

    async getPost(url, cookie=undefined) {
        return await axios({
            url: `${Config.API_SERVER}/v1/post/${encodeURIComponent(url)}`,
            method: 'GET',
            headers: cookie ? {
                'Cookie': cookie
            } : {}
        });
    }

    async putPostLike(url) {
        return await axios({
            url: `${Config.API_SERVER}/v1/post/${encodeURIComponent(url)}`,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: serializeObject({
                like: 'like'
            }),
            withCredentials: true,
        });
    }

    async postComment(url, comment) {
        return await axios({
            url: `${Config.API_SERVER}/v1/comments?url=${url}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: serializeObject({
                comment
            }),
            withCredentials: true,
        })
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

    async logout() {
        return await axios({
            url: `${Config.API_SERVER}/v1/logout`,
            method: 'POST'
        });
    }
}

export default new API();