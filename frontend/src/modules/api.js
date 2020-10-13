import axios from 'axios';

import NProgress from 'nprogress';

import Config from './config.json';

function serializeObject(obj) {
    return Object.keys(obj).reduce((acc, cur) => {
        return acc += `${cur}=${obj[cur] === undefined ? '' : encodeURIComponent(obj[cur])}&`;
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

    async putPostHide(author, url) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}`,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: serializeObject({
                hide: 'hide'
            }),
            withCredentials: true,
        });
    }

    async getAnalytics(author, url) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}/analytics`,
            method: 'GET'
        });
    }

    async postAnalytics(author, url, cookie=undefined, data={}) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}/analytics`,
            method: 'POST',
            data: serializeObject(data),
            headers: cookie ? {
                'Cookie': cookie,
                'Content-Type': 'application/x-www-form-urlencoded'
            } : {
                'Content-Type': 'application/x-www-form-urlencoded'
            }
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

    async getUserData(author, get, fields) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}?get=${get}&fields=${fields.join(',')}`,
            method: 'GET'
        });
    }

    async putAbout(author, about_md) {
        NProgress.start();
        try {
            const response = await axios({
                url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}`,
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: serializeObject({
                    about: author,
                    about_md
                }),
                withCredentials: true,
            });
            NProgress.done();
            return response;
        } catch(e) {
            NProgress.done();
            return e;
        }
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
        NProgress.start();
        try {
            const response = await axios({
                url: `${Config.API_SERVER}/v1/comments?url=${url}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: serializeObject({
                    comment
                }),
                withCredentials: true,
            });
            NProgress.done();
            return response;
        } catch(e) {
            NProgress.done();
            return e;
        }
    }

    async likeComment(pk) {
        NProgress.start();
        try {
            const response = await axios({
                url: `${Config.API_SERVER}/v1/comments/${pk}`,
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: serializeObject({
                    like: pk
                }),
                withCredentials: true,
            });
            NProgress.done();
            return response;
        } catch(e) {
            NProgress.done();
            return e;
        }
    }

    async getCommentMd(pk) {
        return await axios({
            url: `${Config.API_SERVER}/v1/comments/${pk}`,
            method: 'GET'
        });
    }

    async putComment(pk, comment) {
        NProgress.start();
        try {
            const response = await axios({
                url: `${Config.API_SERVER}/v1/comments/${pk}`,
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: serializeObject({
                    comment
                }),
                withCredentials: true,
            });
            NProgress.done();
            return response;
        } catch(e) {
            NProgress.done();
            return e;
        }
    }

    async deleteComment(pk) {
        NProgress.start();
        try {
            const response = await axios({
                url: `${Config.API_SERVER}/v1/comments/${pk}`,
                method: 'DELETE',
                withCredentials: true,
            });
            NProgress.done();
            return response;
        } catch(e) {
            NProgress.done();
            return e;
        }
    }

    async getUserSeries(author, page) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/series?page=${page}`,
            method: 'GET'
        });
    }

    async getSeries(author, url) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/series/${encodeURIComponent(url)}`,
            method: 'GET'
        });
    }

    async putSeries(author, url, data) {
        NProgress.start();
        try {
            const response = await axios({
                url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/series/${encodeURIComponent(url)}`,
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: serializeObject(data),
                withCredentials: true,
            });
            NProgress.done();
            return response;
        } catch(e) {
            NProgress.done();
            return e;
        }
    }

    async getSetting(username, item) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(username)}/setting/${item}`,
            method: 'GET'
        });
    }

    async putSetting(username, item, data) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(username)}/setting/${item}`,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: serializeObject(data),
            withCredentials: true,
        });
    }

    async telegram(parameter) {
        return await axios({
            url: `${Config.API_SERVER}/v1/telegram/${parameter}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            withCredentials: true,
        });
    }

    async login(username, password) {
        NProgress.start();
        try {
            const response = await axios({
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
            NProgress.done();
            return response;
        } catch(e) {
            NProgress.done();
            return e;
        }
    }

    async socialLogin(social, code) {
        NProgress.start();
        try {
            const response = await axios({
                url: `${Config.API_SERVER}/v1/login`,
                method: 'POST',
                headers: {
                    'content-type': 'application/x-www-form-urlencoded'
                },
                data: serializeObject({
                    social,
                    code
                })
            });
            NProgress.done();
            return response;
        } catch(e) {
            NProgress.done();
            return e;
        }
    }

    async logout() {
        NProgress.start();
        try {
            const response = await axios({
                url: `${Config.API_SERVER}/v1/logout`,
                method: 'POST'
            });
            NProgress.done();
            return response;
        } catch(e) {
            NProgress.done();
            return e;
        }
    }
}

export default new API();