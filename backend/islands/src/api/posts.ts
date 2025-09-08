import { http, type Response } from '~/modules/http.module';

interface Series {
    id: string;
    name: string;
}

interface DashboardStatsData {
    totalPosts: number;
    totalViews: number;
    totalLikes: number;
    totalComments: number;
}

interface Activity {
    id: string;
    type: 'comment' | 'like' | 'view';
    postTitle: string;
    postUrl: string;
    username: string;
    userImage?: string;
    createdDate: string;
}

interface RelatedPost {
    title: string;
    url: string;
    authorUsername: string;
    metaDescription: string;
    image?: string;
    createdDate: string;
    readTime: number;
}

interface AutoSaveData {
    title: string;
    content: string;
    tags: string;
}

interface AutoSaveOptions {
    tempToken?: string;
    csrfToken: string;
}

interface SlashCommandItem {
    id: string;
    title: string;
    description: string;
    icon: string;
    command: string;
}

interface HeatmapData {
    date: string;
    count: number;
}

export const postsApi = {
    // Get series list
    getSeries: async () => {
        const { data } = await http<Response<Series[]>>('v1/series');
        if (data.status === 'DONE') {
            return data.body;
        }
        throw new Error('Failed to fetch series list');
    },

    // Get temp post data
    getTempPost: async (tempToken: string) => {
        const { data } = await http<Response<any>>(`v1/temp/posts/${tempToken}`);
        if (data.status === 'DONE') {
            return data.body;
        }
        throw new Error('Failed to fetch temp post');
    },

    // Auto-save post
    autoSavePost: async (data: AutoSaveData, options: AutoSaveOptions) => {
        const formData = new URLSearchParams();
        formData.append('title', data.title);
        formData.append('content', data.content);
        formData.append('tags', data.tags);
        formData.append('csrfmiddlewaretoken', options.csrfToken);

        const url = options.tempToken 
            ? `/v1/temp/posts/${options.tempToken}`
            : '/v1/temp/posts';

        const response = await fetch(url, {
            method: options.tempToken ? 'PUT' : 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            body: formData
        });

        const result = await response.json() as Response<{ token?: string }>;
        return result;
    },

    // Get dashboard stats
    getDashboardStats: async () => {
        const { data } = await http<Response<DashboardStatsData>>('/v1/dashboard/stats', { method: 'GET' });
        if (data.status === 'DONE') {
            return data.body;
        }
        throw new Error('Failed to fetch dashboard stats');
    },

    // Get dashboard activities
    getDashboardActivities: async () => {
        const { data } = await http<Response<{ activities: Activity[] }>>('/v1/dashboard/activities', { method: 'GET' });
        if (data.status === 'DONE') {
            return data.body;
        }
        throw new Error('Failed to fetch dashboard activities');
    },

    // Get related posts
    getRelatedPosts: async (username: string, postUrl: string) => {
        const { data } = await http<Response<{ posts: RelatedPost[] }>>(`v1/users/@${username}/posts/${postUrl}/related`);
        if (data.status === 'DONE') {
            return data.body.posts || [];
        }
        throw new Error('Failed to fetch related posts');
    },

    // Get slash command items (for TiptapEditor)
    getSlashCommands: async (query?: string) => {
        const params = query ? `?q=${encodeURIComponent(query)}` : '';
        const { data } = await http<Response<{ items: SlashCommandItem[] }>>(`v1/posts/slash-commands${params}`);
        if (data.status === 'DONE') {
            return data.body.items;
        }
        throw new Error('Failed to fetch slash commands');
    },

    // Get heatmap data
    getHeatmapData: async (username: string, year?: number) => {
        const params = year ? `?year=${year}` : '';
        const { data } = await http<Response<{ data: HeatmapData[] }>>(`v1/users/@${username}/heatmap${params}`);
        if (data.status === 'DONE') {
            return data.body.data;
        }
        throw new Error('Failed to fetch heatmap data');
    }
};