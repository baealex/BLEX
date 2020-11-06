export interface SocialProps {
    username: string;
    github?: string;
    twitter?: string;
    youtube?: string;
    facebook?: string;
    instagram?: string;
};

export interface AuthorProps {
    profile: {
        username: string;
        realname: string;
        image: string;
        bio: string;
    };
    social: SocialProps;
};

export interface ArticleCardProps {
    author: string;
    url: string;
    image: string;
    title: string;
    authorImage: string;
    createdDate: string;
    readTime: number;
}