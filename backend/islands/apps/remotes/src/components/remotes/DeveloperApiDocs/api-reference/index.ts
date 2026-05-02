import { authOperations } from './auth';
import { mediaOperations } from './media';
import { postOperations } from './posts';
import { publishingOperations } from './publishing';
import type { ApiOperation } from './types';

export type { ApiExample, ApiField, ApiOperation, Requirement } from './types';

export const apiOperations: ApiOperation[] = [
    ...authOperations,
    ...postOperations,
    ...publishingOperations,
    ...mediaOperations
];

export const methodClassName = (method: ApiOperation['method']) => {
    if (method === 'GET') return 'border-line bg-surface text-content';
    if (method === 'POST') return 'border-line bg-surface text-content';
    if (method === 'PATCH') return 'border-line bg-surface text-content';
    return 'border-line bg-surface text-content';
};
