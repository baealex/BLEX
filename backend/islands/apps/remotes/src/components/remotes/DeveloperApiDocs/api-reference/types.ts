export type Requirement = '필수' | '선택' | '조건부';

export interface ApiField {
    name: string;
    type: string;
    requirement: Requirement;
    description: string;
}

export interface ApiExample {
    title: string;
    code: string;
}

export interface ApiOperation {
    id: string;
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE';
    path: string;
    summary: string;
    scope: string;
    description: string;
    successStatus: string;
    pathParams?: ApiField[];
    queryParams?: ApiField[];
    requestBody?: ApiField[];
    responseBody: ApiField[];
    errors: string[];
    example?: ApiExample;
}
