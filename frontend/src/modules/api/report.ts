import axiosRequest, {
    ResponseData,
    serializeObject
} from './index';

export interface PostReportErrorRequestData {
  user?: string;
  path: string;
  content: string;
}

export async function postReportError(data: PostReportErrorRequestData) {
    return await axiosRequest<ResponseData<unknown>>({
        url: '/v1/report/error',
        method: 'POST',
        data: serializeObject(data)
    });
}
