import { NextRequest, NextResponse } from 'next/server';

export async function middleware(req: NextRequest) {
    const cookie = req.headers.get('Cookie');
    
    if (!cookie || !cookie.includes('sessionid')) {
        return NextResponse.redirect('/');    
    }

    return NextResponse.next();
}