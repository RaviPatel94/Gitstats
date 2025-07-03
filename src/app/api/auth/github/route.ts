// app/api/auth/github/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const searchParams = request.nextUrl.searchParams;
  const code = searchParams.get('code');
  const error = searchParams.get('error');
  const state = searchParams.get('state');

  // Handle OAuth errors
  if (error) {
    console.error('GitHub OAuth error:', error);
    return NextResponse.redirect(`${request.nextUrl.origin}/?error=oauth_${error}`);
  }

  // If no code, initiate OAuth flow
  if (!code) {
    const githubClientId = process.env.GITHUB_CLIENT_ID;
    
    if (!githubClientId) {
      return NextResponse.json(
        { error: 'GitHub OAuth not configured' },
        { status: 500 }
      );
    }

    // Generate a random state for security
    const stateValue = generateRandomState();
    
    const params = new URLSearchParams({
      client_id: githubClientId,
      redirect_uri: `${request.nextUrl.origin}/api/auth/github`,
      scope: 'read:user repo user:email', // Minimal required scopes
      state: stateValue,
      allow_signup: 'true',
    });

    const githubUrl = `https://github.com/login/oauth/authorize?${params}`;
    
    // Store state in a cookie for verification
    const response = NextResponse.redirect(githubUrl);
    response.cookies.set('oauth_state', stateValue, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 600, // 10 minutes
    });
    
    return response;
  }

  // Handle OAuth callback
  try {
    // Verify state parameter (security check)
    const cookieStore = await cookies();
    const storedState = cookieStore.get('oauth_state')?.value;
    
    if (!storedState || storedState !== state) {
      console.error('OAuth state mismatch');
      return NextResponse.redirect(`${request.nextUrl.origin}/?error=invalid_state`);
    }

    // Exchange code for access token
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
        redirect_uri: `${request.nextUrl.origin}/api/auth/github`,
      }),
    });

    if (!tokenResponse.ok) {
      throw new Error(`Token exchange failed: ${tokenResponse.status}`);
    }

    const tokenData = await tokenResponse.json();

    if (tokenData.error) {
      throw new Error(tokenData.error_description || tokenData.error);
    }

    if (!tokenData.access_token) {
      throw new Error('No access token received');
    }

    // Get user data with the access token
    const [userResponse, emailResponse] = await Promise.all([
      fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${tokenData.access_token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GitHub-Card-Generator',
        },
      }),
      fetch('https://api.github.com/user/emails', {
        headers: {
          'Authorization': `token ${tokenData.access_token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GitHub-Card-Generator',
        },
      })
    ]);

    if (!userResponse.ok) {
      throw new Error(`Failed to get user data: ${userResponse.status}`);
    }

    const [userData, emailData] = await Promise.all([
      userResponse.json(),
      emailResponse.ok ? emailResponse.json() : []
    ]);

    // Find primary email
    const primaryEmail = Array.isArray(emailData) 
      ? emailData.find((email: any) => email.primary)?.email || userData.email
      : userData.email;

    // Parse token scopes
    const tokenScopes = tokenData.scope ? tokenData.scope.split(/[,\s]+/).filter(Boolean) : [];
    const canAccessPrivateRepos = tokenScopes.includes('repo');

    // Prepare user session data
    const sessionData = {
      // GitHub user data
      id: userData.id,
      login: userData.login,
      name: userData.name,
      email: primaryEmail,
      avatar_url: userData.avatar_url,
      bio: userData.bio,
      company: userData.company,
      location: userData.location,
      blog: userData.blog,
      public_repos: userData.public_repos,
      followers: userData.followers,
      following: userData.following,
      created_at: userData.created_at,
      
      // OAuth data
      access_token: tokenData.access_token,
      token_type: tokenData.token_type || 'bearer',
      token_scopes: tokenScopes,
      
      // Permissions
      can_access_private_repos: canAccessPrivateRepos,
      
      // Session metadata
      authenticated_at: new Date().toISOString(),
      expires_at: new Date(Date.now() + (tokenData.expires_in ? tokenData.expires_in * 1000 : 8 * 60 * 60 * 1000)).toISOString(), // 8 hours default
    };

    // Create response and set secure cookie
    const response = NextResponse.redirect(`${request.nextUrl.origin}/?authenticated=true&user=${encodeURIComponent(userData.login)}`);
    
    // Set authentication cookie
    response.cookies.set('github_user', JSON.stringify(sessionData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    // Clear the state cookie
    response.cookies.delete('oauth_state');

    return response;
    
  } catch (error) {
    console.error('GitHub OAuth error:', error);
    
    // Clear any cookies
    const response = NextResponse.redirect(`${request.nextUrl.origin}/?error=auth_failed`);
    response.cookies.delete('oauth_state');
    response.cookies.delete('github_user');
    
    return response;
  }
}

// Generate a random state parameter for OAuth security
function generateRandomState(): string {
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  return Array.from(array, byte => byte.toString(16).padStart(2, '0')).join('');
}