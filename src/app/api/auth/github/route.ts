// app/api/auth/github/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const state = searchParams.get('state');

  // If no code, redirect to GitHub OAuth
  if (!code) {
    const githubClientId = process.env.GITHUB_CLIENT_ID;
    
    if (!githubClientId) {
      return NextResponse.json(
        { error: 'GitHub OAuth not configured' },
        { status: 500 }
      );
    }

    const params = new URLSearchParams({
      client_id: githubClientId,
      redirect_uri: `${request.nextUrl.origin}/api/auth/github`,
      scope: 'read:user user:email read:org',
      state: 'random-state-string', // In production, use a proper state value
    });

    const githubUrl = `https://github.com/login/oauth/authorize?${params}`;
    return NextResponse.redirect(githubUrl);
  }

  // Handle OAuth callback
  try {
    const tokenResponse = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Accept': 'application/json',
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        client_id: process.env.GITHUB_CLIENT_ID!,
        client_secret: process.env.GITHUB_CLIENT_SECRET!,
        code: code,
      }),
    });

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error_description || 'OAuth error');
    }

    // Get user data with the access token
    const userResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    const userData = await userResponse.json();

    // Get user organizations
    const orgsResponse = await fetch('https://api.github.com/user/orgs', {
      headers: {
        'Authorization': `token ${tokenData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
      },
    });

    const orgsData = await orgsResponse.json();

    // In a real app, you'd store this in a database or session
    // For now, we'll redirect back to the main page with user data
    const response = NextResponse.redirect(`${request.nextUrl.origin}/?authenticated=true`);
    
    // Set a cookie with user data (in production, use proper session management)
    response.cookies.set('github_user', JSON.stringify({
      ...userData,
      organizations: orgsData,
      access_token: tokenData.access_token
    }), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });

    return response;
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    return NextResponse.redirect(`${request.nextUrl.origin}/?error=auth_failed`);
  }
}