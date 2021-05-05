import axios from 'axios';

axios.defaults.withCredentials = true;

import Config from '../config.json';

import {
    ResponseData,
    serializeObject,
} from './index';

export async function getUserSeries(author: string, page: number) {
    return await axios.request<ResponseData<GetUserSeriesData>>({
        url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/series?page=${page}`,
        method: 'GET'
    });
}

export interface GetUserSeriesData {
    series: {
        url: string;
        name: string;
        image: string;
        createdDate: string;
        owner: string;
    }[];
    lastPage: number;
}

export async function postUserSeries(author: string, title: string) {
    return await axios.request<ResponseData<PostUserSeriesData>>({
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

export interface PostUserSeriesData {
    url: string;
}

export async function getAnUserSeries(author: string, url: string) {
    return await axios.request<ResponseData<GetAnUserSeriesData>>({
        url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/series/${encodeURIComponent(url)}`,
        method: 'GET'
    });
}

export interface GetAnUserSeriesData {
    name: string;
    url: string;
    image: string;
    owner: string;
    ownerImage: string;
    description: string;
    posts: GetAnUserSeriesDataPosts[];
}

export interface GetAnUserSeriesDataPosts {
    url: string;
    title: string;
    readTime: number;
    description: string;
    createdDate: string;
}

export async function putUserSeries(author: string, url: string, data: object) {
    return await axios.request<ResponseData<putUserSeriesData>>({
        url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/series/${encodeURIComponent(url)}`,
        method: 'PUT',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        data: serializeObject(data),
        withCredentials: true,
    });
}

export interface putUserSeriesData {
    url: string;
}

export async function deleteUserSeries(author: string, url: string) {
    return await axios.request<ResponseData<any>>({
        url: `${Config.API_SERVER}/v1/users/${encodeURIComponent(author)}/series/${encodeURIComponent(url)}`,
        method: 'DELETE',
        withCredentials: true,
    });
}