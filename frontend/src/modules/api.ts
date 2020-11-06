import axios from 'axios';

import NProgress from 'nprogress';

import Config from './config.json';

function serializeObject(obj: any) {
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

    async getAllPosts(sort: string, page: number) {
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

    async getTempPosts(token: string) {
        return await axios({
            url: `${Config.API_SERVER}/v1/posts/temp?token=${token}`,
            method: 'GET',
            withCredentials: true,
        });
    }

    async postTempPosts(title: string, text_md: string, tag: string) {
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

    async putTempPosts(token: string, title: string, text_md: string, tag: string) {
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

    async deleteTempPosts(token: string) {
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
    
    async getUserPosts(author: string, page: number, tag: '') {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts?tag=${encodeURIComponent(tag)}&page=${page}`,
            method: 'GET',
        });
    }

    async getPost(author: string, url: string, mode: string, cookie?: string) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}?mode=${mode}`,
            method: 'GET',
            headers: cookie ? {
                'Cookie': cookie
            } : {}
        });
    }

    async postPost(author: string, data: FormData) {
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

    async putPost(author: string, url: string, item='', data={}) {
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

    async deletePost(author: string, url: string) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}`,
            method: 'DELETE',
            withCredentials: true,
        });
    }

    async getAnalytics(author: string, url: string) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}/analytics`,
            method: 'GET'
        });
    }

    async postAnalytics(author: string, url: string, data: {}) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}/analytics`,
            method: 'POST',
            data: serializeObject(data),
            withCredentials: true,
        });
    }

    async getUserProfile(author: string, includes: string[]) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}?includes=${includes.join(',')}`,
            method: 'GET'
        });
    }

    async getUserData(author: string, get: string, fields: [string]) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}?get=${get}&fields=${fields.join(',')}`,
            method: 'GET'
        });
    }

    async putAbout(author: string, aboutMarkdown: string, aboutMarkup: string) {
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
                    about_md: aboutMarkdown,
                    about_html: aboutMarkup
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

    async getAllTags(page: number) {
        return await axios({
            url: `${Config.API_SERVER}/v1/tags?page=${page}`,
            method: 'GET'
        });
    }

    async getTag(tag: string, page: number) {
        return await axios({
            url: `${Config.API_SERVER}/v1/tags/${encodeURIComponent(tag)}?page=${page}`,
            method: 'GET'
        });
    }

    async postComment(url: string, content: string, contentMarkup: string) {
        NProgress.start();
        try {
            const response = await axios({
                url: `${Config.API_SERVER}/v1/comments?url=${url}`,
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: serializeObject({
                    comment_html: contentMarkup,
                    comment_md: content
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

    async likeComment(pk: number) {
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

    async getCommentMd(pk: number) {
        return await axios({
            url: `${Config.API_SERVER}/v1/comments/${pk}`,
            method: 'GET'
        });
    }

    async putComment(pk: number, content: string, commentMarkup: string) {
        NProgress.start();
        try {
            const response = await axios({
                url: `${Config.API_SERVER}/v1/comments/${pk}`,
                method: 'PUT',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                data: serializeObject({
                    comment_html: commentMarkup,
                    comment_md: content
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

    async deleteComment(pk: number) {
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

    async postSeries(author: string, title: string) {
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

    async getUserSeries(author: string, page: string) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/series?page=${page}`,
            method: 'GET'
        });
    }

    async getSeries(author: string, url: string) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/series/${encodeURIComponent(url)}`,
            method: 'GET'
        });
    }

    async putSeries(author: string, url: string, data: object) {
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

    async deleteSeries(author: string, url: string) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/series/${encodeURIComponent(url)}`,
            method: 'DELETE',
            withCredentials: true,
        });
    }

    async getSetting(username: string, item: string) {
        return await axios({
            url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(username)}/setting/${item}`,
            method: 'GET'
        });
    }

    async putSetting(username: string, item: string, data: object) {
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

    async telegram(parameter: string) {
        return await axios({
            url: `${Config.API_SERVER}/v1/telegram/${parameter}`,
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            withCredentials: true,
        });
    }

    async login(username: string, password: string) {
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

    async socialLogin(social: string, code: string) {
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

    async getFeaturePosts(username: string, exclude: string) {
        return await axios({
            url: `${Config.API_SERVER}/v1/feature/posts?${serializeObject({username, exclude})}`,
            method: 'GET',
        });
    }

    async getFeatureTagPosts(tag: string, exclude: string) {
        return await axios({
            url: `${Config.API_SERVER}/v1/feature/posts/${tag}?${serializeObject({exclude})}`,
            method: 'GET',
        });
    }

    async uploadImage(file: File) {
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