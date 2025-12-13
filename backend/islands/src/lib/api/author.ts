import { http, type Response } from '~/modules/http.module';

export const getAuthorHeatmap = async (username: string) => {
    return http.get<Response<{ [key: string]: number }>>(`v1/users/@${username}/heatmap`);
};
