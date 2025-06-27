// app/api/auth/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('github_user');

    if (!userCookie?.value) {
      return NextResponse.json({ user: null });
    }

    const userData = JSON.parse(userCookie.value);
    
    // Remove sensitive data before sending to client
    const { access_token, ...safeUserData } = userData;
    
    return NextResponse.json({ user: safeUserData });
  } catch (error) {
    console.error('Session error:', error);
    return NextResponse.json({ user: null });
  }
}

export async function DELETE(request: NextRequest) {
  const response = NextResponse.json({ success: true });
  
  // Clear the auth cookie
  response.cookies.set('github_user', '', {
    expires: new Date(0),
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
  });

  return response;
}