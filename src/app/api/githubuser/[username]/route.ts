// app/api/githubuser/[username]/route.ts
import { NextRequest, NextResponse } from 'next/server';

export async function GET(
  request: NextRequest,
  { params }: { params: { username: string } }
) {
  console.log('API route called');
  
  try {
    const { username } = params;
    console.log('Username received:', username);

    if (!username) {
      console.log('No username provided');
      return NextResponse.json(
        { error: 'Username is required' },
        { status: 400 }
      );
    }

    console.log('Fetching GitHub user:', username);
    const githubUrl = `https://api.github.com/users/${username}`;
    console.log('GitHub URL:', githubUrl);

    // Build headers with optional authentication
    const headers: Record<string, string> = {
      'Accept': 'application/vnd.github.v3+json',
      'User-Agent': 'GitHub-Card-Generator'
    };

    // Add GitHub token if available for higher rate limits
    if (process.env.GITHUB_TOKEN) {
      headers['Authorization'] = `token ${process.env.GITHUB_TOKEN}`;
      console.log('Using GitHub token for authentication');
    } else {
      console.log('No GitHub token found, using unauthenticated requests');
    }

    const response = await fetch(githubUrl, { headers });

    console.log('GitHub API response status:', response.status);

    if (!response.ok) {
      console.log('GitHub API error:', response.status, response.statusText);
      
      if (response.status === 404) {
        return NextResponse.json(
          { error: 'User not found' },
          { status: 404 }
        );
      }
      
      if (response.status === 401) {
        console.log('Authentication failed - check GitHub token validity');
        return NextResponse.json(
          { error: 'GitHub authentication failed. Please check your token.' },
          { status: 401 }
        );
      }
      
      if (response.status === 403) {
        const rateLimitReset = response.headers.get('x-ratelimit-reset');
        const resetTime = rateLimitReset ? new Date(parseInt(rateLimitReset) * 1000).toLocaleTimeString() : 'unknown';
        console.log('Rate limit exceeded. Reset time:', resetTime);
        
        return NextResponse.json(
          { 
            error: 'GitHub API rate limit exceeded. Please try again later.',
            resetTime: resetTime
          },
          { status: 429 }
        );
      }
      
      throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
    }

    console.log('Successfully fetched user data');
    const userData = await response.json();
    console.log('User data received for:', userData.login);
    
    return NextResponse.json(userData);
    
  } catch (error) {
    console.error('Detailed error in API route:', error);
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch user data',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    );
  }
}