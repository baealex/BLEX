import Config from './config.json'
import axios from 'axios'

class API {
    async getAllPosts(sort, page) {
        return await axios.get(`${Config.API_SERVER}/v1/posts/${sort}?page=${page}`);
    }

    async getPost(url) {
        return await axios.get(`${Config.API_SERVER}/v1/post/${encodeURIComponent(url)}`);
    }
}

export default new API();