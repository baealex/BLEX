import request, { objectToForm } from './request';

export interface GetInvitationOwnerResponse {
    user: string;
    userImage: string;
    userDescription: string;
}

export async function getInvitationOwners() {
    return await request<GetInvitationOwnerResponse[]>({
        url: '/v1/invitation/owners',
        method: 'GET'
    });
}

export interface GetInvitationRequestsResponse {
    sender: string;
    senderImage: string;
    content: string;
    createDate: string;
}

export async function getInvitationRequests() {
    return await request<GetInvitationRequestsResponse[]>({
        url: '/v1/invitation/requests',
        method: 'GET'
    });
}

export interface CreateRequestInvitationRequestData {
    receiver: string;
    content: string;
}

export async function createRequestInvitation(data: CreateRequestInvitationRequestData) {
    return await request<boolean>({
        url: '/v1/invitation/requests',
        method: 'POST',
        data: objectToForm(data)
    });
}