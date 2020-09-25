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
    
    async getUserPosts(author, page, tag='') {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts?tag=${encodeURIComponent(tag)}&page=${page}`,
            method: 'GET',
        });
    }

    async getPost(author, url, cookie=undefined) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}`,
            method: 'GET',
            headers: cookie ? {
                'Cookie': cookie
            } : {}
        });
    }

    async putPostLike(author, url) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}`,
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

    async getUserProfile(author, includes) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}?includes=${includes.join(',')}`,
            method: 'GET'
        });
    }

    async getAllTags(page) {
        return await axios({
            url: `${Config.API_SERVER}/v1/tags?page=${page}`,
            method: 'GET'
        });
    }

    async getTag(tag, page) {
        return await axios({
            url: `${Config.API_SERVER}/v1/tags/${encodeURIComponent(tag)}?page=${page}`,
            method: 'GET'
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

    async getUserSeries(author, page) {
        return await axios.get(`${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/series?page=${page}`);
    }

    async getSeries(author, url) {
        return await axios.get(`${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/series/${encodeURIComponent(url)}`);
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