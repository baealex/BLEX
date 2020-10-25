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
    async alive(cookie=undefined) {
        return await axios({
            url: `${Config.API_SERVER}/v1/alive`,
            method: 'GET',
            headers: cookie ? {
                'Cookie': cookie
            } : {}
        });
    }

    async getAllPosts(sort, page) {
        return await axios({
            url: `${Config.API_SERVER}/v1/posts/${sort}?page=${page}`,
            method: 'GET',
        });
    }

    async getAllTempPosts() {
        return await axios({
            url: `${Config.API_SERVER}/v1/posts/temp?get=list`,
            method: 'GET',
            withCredentials: true,
        });
    }

    async getTempPosts(token) {
        return await axios({
            url: `${Config.API_SERVER}/v1/posts/temp?token=${token}`,
            method: 'GET',
            withCredentials: true,
        });
    }

    async postTempPosts(title, text_md, tag) {
        return await axios({
            url: `${Config.API_SERVER}/v1/posts/temp`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: serializeObject({
                title,
                text_md,
                tag
            }),
            withCredentials: true,
        });
    }

    async putTempPosts(token, title, text_md, tag) {
        return await axios({
            url: `${Config.API_SERVER}/v1/posts/temp`,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: serializeObject({
                token,
                title,
                text_md,
                tag
            }),
            withCredentials: true,
        });
    }

    async deleteTempPosts(token) {
        return await axios({
            url: `${Config.API_SERVER}/v1/posts/temp`,
            method: 'DELETE',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: serializeObject({
                token
            }),
            withCredentials: true,
        });
    }
    
    async getUserPosts(author, page, tag='') {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts?tag=${encodeURIComponent(tag)}&page=${page}`,
            method: 'GET',
        });
    }

    async getPost(author, url, mode, cookie=undefined) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}?mode=${mode}`,
            method: 'GET',
            headers: cookie ? {
                'Cookie': cookie
            } : {}
        });
    }

    async postPost(author, data) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data,
            withCredentials: true,
        });
    }

    async putPost(author, url, item, data={}) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}?${serializeObject({[item]: item})}`,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: serializeObject(data),
            withCredentials: true,
        });
    }

    async deletePost(author, url) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}`,
            method: 'DELETE',
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

    async putAbout(author, about_md, about_html) {
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
                    about_md,
                    about_html
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

    async postComment(url, comment, comment_md) {
        NProgress.start();
        try {
            const response = await axios({
                url: `${Config.API_SERVER}/v1/comments?url=${url}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: serializeObject({
                    comment,
                    comment_md
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

    async putComment(pk, comment, comment_md) {
        NProgress.start();
        try {
            const response = await axios({
                url: `${Config.API_SERVER}/v1/comments/${pk}`,
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: serializeObject({
                    comment,
                    comment_md
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

    async postSeries(author, title) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/series`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: serializeObject({
                title
            }),
            withCredentials: true,
        });
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

    async deleteSeries(author, url) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/series/${encodeURIComponent(url)}`,
            method: 'DELETE',
            withCredentials: true,
        });
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

    async uploadImage(file) {
        const formData = new FormData();
        formData.append('image', file);

        NProgress.start();
        try {
            const formData = new FormData();
            formData.append('image', file);

            const response = await axios({
                url: `${Config.API_SERVER}/v1/image/upload`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: formData,
                withCredentials: true,
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