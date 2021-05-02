export * from './setting';

import axios from 'axios';

axios.defaults.withCredentials = true;

import NProgress from 'nprogress';

import Config from '../config.json';

export const ERROR = {
    REJECT: 'error:RJ',
    EXPIRE: 'error:EP',
    NOT_LOGIN: 'error:NL',
    SAME_USER: 'error:SU',
    DIFF_USER: 'error:DU',
    OVER_FLOW: 'error:OF',
    ALREADY_VERIFY: 'error:AV',
    ALREADY_UNSYNC: 'error:AU',
    ALREADY_EXISTS: 'error:AE',
    NEED_TELEGRAM: 'error:NT',
    EMAIL_NOT_MATCH: 'error:EN',
    USERNAME_NOT_MATCH: 'error:UN',
};

type ErrorCode =
    'RJ' | 'EP' | 'NL' | 'SU' |
    'DU' | 'OF' | 'AV' | 'AU' |
    'AE' | 'NT' | 'EN' | 'UN' ;

export interface ResponseData<T> {
    status: 'DONE' | 'ERROR',
    errorCode?: ErrorCode,
    body?: T
}

type DoneOrFail = 'DONE' | 'FAIL';

export function serializeObject(obj: {
    [key: string]: any
}) {
    return Object.keys(obj).reduce((acc, cur) => {
        return acc += `${cur}=${obj[cur] === undefined ? '' : encodeURIComponent(obj[cur])}&`;
    }, '').slice(0, -1);
}

export async function getAllPosts(sort: string, page: number) {
    return await axios({
        url: `${Config.API_SERVER}/v1/posts/${sort}?page=${page}`,
        method: 'GET',
    });
}

export async function getAllTempPosts() {
    return await axios({
        url: `${Config.API_SERVER}/v1/posts/temp?get=list`,
        method: 'GET',
        withCredentials: true,
    });
}

export async function getTempPosts(token: string) {
    return await axios({
        url: `${Config.API_SERVER}/v1/posts/temp?token=${token}`,
        method: 'GET',
        withCredentials: true,
    });
}

export async function postTempPosts(title: string, text_md: string, tag: string) {
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

export async function putTempPosts(token: string, title: string, text_md: string, tag: string) {
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

export async function deleteTempPosts(token: string) {
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

export async function getUserPosts(author: string, page: number, tag='') {
    return await axios({
        url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts?tag=${encodeURIComponent(tag)}&page=${page}`,
        method: 'GET',
    });
}

export async function getPost(author: string, url: string, mode: string, cookie?: string) {
    return await axios({
        url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}?mode=${mode}`,
        method: 'GET',
        headers: cookie ? { cookie } : undefined
    });
}

export async function getPostComments(author: string, url: string) {
    return await axios.request<GetPostCommentData>({
        url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}/comments`,
        method: 'GET',
    });
}

export interface GetPostCommentData {
    comments: {
        pk: number;
        author: string;
        authorImage: string;
        isEdit: boolean;
        isEdited: boolean;
        timeSince: string;
        textHtml: string;
        textMarkdown: string;
        totalLikes: number;
        isLiked: boolean;
    }[];
};

export async function postPost(author: string, data: FormData) {
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

export async function editPost(author: string, url: string, data: FormData) {
    return await axios({
        url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data,
        withCredentials: true,
    });
}

export async function putPost(author: string, url: string, item='', data={}) {
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

export async function deletePost(author: string, url: string) {
    return await axios({
        url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}`,
        method: 'DELETE',
        withCredentials: true,
    });
}

export async function getAnalytics(author: string, url: string) {
    return await axios({
        url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}/analytics`,
        method: 'GET'
    });
}

export async function postAnalytics(author: string, url: string, data: {}) {
    return await axios({
        url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/posts/${encodeURIComponent(url)}/analytics`,
        method: 'POST',
        data: serializeObject(data),
        withCredentials: true,
    });
}

/* PROFILE */

export async function getUserProfile(author: string, includes: string[]) {
    return await axios({
        url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}?includes=${includes.join(',')}`,
        method: 'GET'
    });
}

export interface ProfileData {
    profile: {
        image: string;
        username: string;
        realname: string;
        bio: string;
    },
    social?: {
        username: string;
        github?: string;
        twitter?: string;
        youtube?: string;
        facebook?: string;
        instagram?: string;
    },
    heatmap?: {
        [key: string]: number;
    };
    tags?: {
        name: string;
        count: number;
    }[],
    view?: {
        today: number;
        yesterday: number;
        total: number;
    },
    most?: {
        url: string;
        title: string;
        image: string;
        readTime: number;
        createdDate: string;
        authorImage: string;
        author: string;
    }[],
    recent?: {
        type: string;
        text: string;
        url: string;
    }[],
}

export async function getUserData(author: string, get: string, fields: string[]) {
    return await axios({
        url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}?get=${get}&fields=${fields.join(',')}`,
        method: 'GET'
    });
}

export async function putUsername(username: string, newUsername: string) {
    NProgress.start();
    try {
        const response = await axios({
            url: `${Config.API_SERVER}/v1/users/@${encodeURIComponent(username)}`,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: serializeObject({
                username: username,
                new_username: newUsername
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

export async function putAbout(author: string, aboutMarkdown: string, aboutMarkup: string) {
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

export async function getAllTags(page: number) {
    return await axios({
        url: `${Config.API_SERVER}/v1/tags?page=${page}`,
        method: 'GET'
    });
}

export async function getTag(tag: string, page: number) {
    return await axios({
        url: `${Config.API_SERVER}/v1/tags/${encodeURIComponent(tag)}?page=${page}`,
        method: 'GET'
    });
}

export async function postComment(url: string, content: string, contentMarkup: string) {
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

export async function likeComment(pk: number) {
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

export async function getCommentMd(pk: number) {
    return await axios({
        url: `${Config.API_SERVER}/v1/comments/${pk}`,
        method: 'GET'
    });
}

export async function putComment(pk: number, content: string, commentMarkup: string) {
    NProgress.start();
    try {
        const response = await axios({
            url: `${Config.API_SERVER}/v1/comments/${pk}`,
            method: 'PUT',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded'
            },
            data: serializeObject({
                comment: 'comment',
                comment_md: content,
                comment_html: commentMarkup,
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


export async function deleteComment(pk: number) {
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

export async function postSeries(author: string, title: string) {
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

export async function getUserSeries(author: string, page: string) {
    return await axios({
        url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/series?page=${page}`,
        method: 'GET'
    });
}

export async function getSeries(author: string, url: string) {
    return await axios({
        url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/series/${encodeURIComponent(url)}`,
        method: 'GET'
    });
}

export async function putSeries(author: string, url: string, data: object) {
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

export async function deleteSeries(author: string, url: string) {
    return await axios({
        url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/series/${encodeURIComponent(url)}`,
        method: 'DELETE',
        withCredentials: true,
    });
}

export async function changeAvatar(data: FormData) {
    return await axios.request<ChangeAvatarData>({
        url: `${Config.API_SERVER}/v1/setting/avatar`,
        method: 'POST',
        data: data,
        withCredentials: true,
    });
}

export interface ChangeAvatarData {
    url: string;
}

export async function telegram(parameter: 'unsync' | 'makeToken') {
    return await axios({
        url: `${Config.API_SERVER}/v1/telegram/${parameter}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        withCredentials: true,
    });
}

/* AUTH */

export async function alive(cookie='') {
    return await axios({
        url: `${Config.API_SERVER}/v1/login`,
        method: 'GET',
        headers: cookie ? {
            'Cookie': cookie
        } : {}
    });
}

export async function login(username: string, password: string) {
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

export async function signup(username: string, password: string, email: string, realname: string) {
    return await axios({
        url: `${Config.API_SERVER}/v1/signup`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject({
            username,
            realname,
            password,
            email
        }),
        withCredentials: true,
    });
}

export async function deleteSign() {
    return await axios({
        url: `${Config.API_SERVER}/v1/signup`,
        method: 'DELETE',
        withCredentials: true,
    });
}

export async function createTwoFactorAuth() {
    return await axios({
        url: `${Config.API_SERVER}/v1/auth`,
        method: 'POST',
        withCredentials: true,
    });
}

export async function deleteTwoFactorAuth() {
    return await axios({
        url: `${Config.API_SERVER}/v1/auth`,
        method: 'DELETE',
        withCredentials: true,
    });
}

export async function verifyTwoFactorAuth(authToken: string) {
    return await axios({
        url: `${Config.API_SERVER}/v1/auth/send`,
        method: 'POST',
        withCredentials: true,
        data: serializeObject({
            auth_token: authToken
        })
    });
}

export async function getVerifyToken(token: string) {
    return await axios({
        url: `${Config.API_SERVER}/v1/users/verify/${token}`,
        method: 'GET',
    });
}

export async function postVerifyToken(token: string, hctoken?: string) {
    return await axios({
        url: `${Config.API_SERVER}/v1/users/verify/${token}`,
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject({
            hctoken
        }),
        withCredentials: true,
    });
}

export async function socialLogin(social: string, code: string) {
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

export async function getFeaturePosts(username: string, exclude: string) {
    return await axios({
        url: `${Config.API_SERVER}/v1/feature/posts?${serializeObject({username, exclude})}`,
        method: 'GET',
    });
}

export async function getFeatureTagPosts(tag: string, exclude: string) {
    return await axios({
        url: `${Config.API_SERVER}/v1/feature/posts/${tag}?${serializeObject({exclude})}`,
        method: 'GET',
    });
}

export async function uploadImage(file: File) {
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

export async function logout() {
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


export interface FeaturePostsData {
    posts: {
        url: string;
        title: string;
        image: string;
        readTime: number;
        createdDate: string;
        authorImage: string;
        author: string;
    }[];
}

export interface FeatureTagPostsData {
    posts: {
        url: string;
        title: string;
        image: string;
        readTime: number;
        createdDate: string;
        authorImage: string;
        author: string;
    }[];
}

export async function postForms(title: string, content: string) {
    return axios.request({
        url: `${Config.API_SERVER}/v1/forms`,
        method: 'POST',
        data: serializeObject({
            title,
            content,
        })
    })
};

export async function deleteForms(id: number) {
    return axios.request<DoneOrFail>({
        url: `${Config.API_SERVER}/v1/forms/${id}`,
        method: 'DELETE',
    })
};

export async function getForm(id: number) {
    return axios.request<GetFormData>({
        url: `${Config.API_SERVER}/v1/forms/${id}`,
        method: 'GET',
    })
}

export interface GetFormData {
    title: string;
    content: string;
}