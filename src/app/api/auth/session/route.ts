// app/api/auth/session/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function GET() {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('github_user');

    if (!userCookie?.value) {
      return NextResponse.json({ 
        user: null,
        authenticated: false 
      });
    }

    const userData = JSON.parse(userCookie.value);
    
    // Check if token is expired
    if (userData.expires_at && new Date(userData.expires_at) < new Date()) {
      // Token expired, clear cookie
      const response = NextResponse.json({ 
        user: null, 
        authenticated: false,
        error: 'Token expired' 
      });
      
      response.cookies.delete('github_user');
      return response;
    }

    // Verify token is still valid by making a test request
    try {
      const testResponse = await fetch('https://api.github.com/user', {
        headers: {
          'Authorization': `token ${userData.access_token}`,
          'Accept': 'application/vnd.github.v3+json',
          'User-Agent': 'GitHub-Card-Generator',
        },
      });

      if (!testResponse.ok) {
        // Token is invalid, clear cookie
        const response = NextResponse.json({ 
          user: null, 
          authenticated: false,
          error: 'Invalid token' 
        });
        
        response.cookies.delete('github_user');
        return response;
      }
    } catch (error) {
      console.warn('Token validation failed:', error);
      // Don't clear cookie for network errors, but note the issue
    }
    
    // Remove sensitive data before sending to client
    const { access_token, ...safeUserData } = userData;
    
    return NextResponse.json({ 
      user: safeUserData,
      authenticated: true,
      permissions: {
        canAccessPrivateRepos: userData.can_access_private_repos,
        scopes: userData.token_scopes || []
      }
    });
    
  } catch (error) {
    console.error('Session error:', error);
    
    // Clear potentially corrupted cookie
    const response = NextResponse.json({ 
      user: null, 
      authenticated: false,
      error: 'Session error' 
    });
    
    response.cookies.delete('github_user');
    return response;
  }
}

export async function DELETE() {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('github_user');
    
    // If user is authenticated, try to revoke the token
    if (userCookie?.value) {
      try {
        const userData = JSON.parse(userCookie.value);
        
        // Revoke the GitHub token
        if (userData.access_token) {
          await fetch(`https://api.github.com/applications/${process.env.GITHUB_CLIENT_ID}/token`, {
            method: 'DELETE',
            headers: {
              'Accept': 'application/vnd.github.v3+json',
              'Authorization': `Basic ${Buffer.from(`${process.env.GITHUB_CLIENT_ID}:${process.env.GITHUB_CLIENT_SECRET}`).toString('base64')}`,
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({
              access_token: userData.access_token
            })
          });
        }
      } catch (error) {
        console.warn('Failed to revoke token:', error);
        // Continue with logout even if token revocation fails
      }
    }
    
    const response = NextResponse.json({ 
      success: true,
      message: 'Logged out successfully' 
    });
    
    // Clear the auth cookie
    response.cookies.set('github_user', '', {
      expires: new Date(0),
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
    });

    return response;
    
  } catch (error) {
    console.error('Logout error:', error);
    
    // Even if there's an error, clear the cookie
    const response = NextResponse.json({ 
      success: true,
      message: 'Logged out (with errors)' 
    });
    
    response.cookies.delete('github_user');
    return response;
  }
}

// Optional: Add a refresh endpoint to extend session
export async function POST(request: NextRequest) {
  try {
    const cookieStore = await cookies();
    const userCookie = cookieStore.get('github_user');

    if (!userCookie?.value) {
      return NextResponse.json({ 
        error: 'No active session' 
      }, { status: 401 });
    }

    const userData = JSON.parse(userCookie.value);
    
    // Verify token is still valid
    const testResponse = await fetch('https://api.github.com/user', {
      headers: {
        'Authorization': `token ${userData.access_token}`,
        'Accept': 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-Card-Generator',
      },
    });

    if (!testResponse.ok) {
      const response = NextResponse.json({ 
        error: 'Invalid token' 
      }, { status: 401 });
      
      response.cookies.delete('github_user');
      return response;
    }

    // Extend session
    const extendedUserData = {
      ...userData,
      expires_at: new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(), // Extend by 8 hours
    };

    const response = NextResponse.json({ 
      success: true,
      message: 'Session refreshed',
      expires_at: extendedUserData.expires_at
    });
    
    // Update cookie with extended expiration
    response.cookies.set('github_user', JSON.stringify(extendedUserData), {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 7, // 7 days
      path: '/',
    });

    return response;
    
  } catch (error) {
    console.error('Session refresh error:', error);
    return NextResponse.json({ 
      error: 'Failed to refresh session' 
    }, { status: 500 });
  }
}