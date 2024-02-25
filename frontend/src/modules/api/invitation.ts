import request from './request';

interface GetInvitationOwner {
    user: string;
    userImage: string;
    userDescription: string;
}

export async function getInvitationOwners() {
    return await request<GetInvitationOwner[]>({
        url: '/v1/invitation/owners',
        method: 'GET'
    });
}