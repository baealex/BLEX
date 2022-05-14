import {
    NextRequest,
    NextResponse
} from 'next/server';

export async function middleware(req: NextRequest) {
    const cookie = req.headers.get('Cookie');

    if (!cookie || !cookie.includes('sessionid')) {
        const url = req.nextUrl.clone();
        url.search = '';
        url.pathname = '/';
        return NextResponse.redirect(url);
    }

    return NextResponse.next();
}