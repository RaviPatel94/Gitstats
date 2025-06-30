import { type NextRequest, NextResponse } from "next/server"

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ username: string }> },
): Promise<NextResponse> {
  console.log("API route called")

  try {
    // Await the params since they're now async in Next.js 15
    const { username } = await context.params
    console.log("Username received:", username)

    if (!username) {
      console.log("No username provided")
      return NextResponse.json({ error: "Username is required" }, { status: 400 })
    }

    console.log("Fetching GitHub user:", username)
    const githubUrl = `https://api.github.com/users/${username}`
    console.log("GitHub URL:", githubUrl)

    // First, try with authentication if token is available
    let response: Response
    let usingAuth = false

    if (process.env.GITHUB_TOKEN) {
      console.log("Attempting authenticated request...")
      const authHeaders = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "GitHub-Card-Generator",
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
      }

      try {
        response = await fetch(githubUrl, { headers: authHeaders })
        
        if (response.status === 401) {
          console.log("Token is invalid, falling back to unauthenticated request")
          // Token is invalid, fall back to unauthenticated request
          const publicHeaders = {
            Accept: "application/vnd.github.v3+json",
            "User-Agent": "GitHub-Card-Generator",
          }
          response = await fetch(githubUrl, { headers: publicHeaders })
        } else {
          usingAuth = true
          console.log("Successfully used authenticated request")
        }
      } catch (error) {
        console.log("Error with authenticated request, trying unauthenticated:", error)
        // If there's any error with the authenticated request, try unauthenticated
        const publicHeaders = {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "GitHub-Card-Generator",
        }
        response = await fetch(githubUrl, { headers: publicHeaders })
      }
    } else {
      console.log("No GitHub token found, using unauthenticated request")
      const publicHeaders = {
        Accept: "application/vnd.github.v3+json",
        "User-Agent": "GitHub-Card-Generator",
      }
      response = await fetch(githubUrl, { headers: publicHeaders })
    }

    console.log("GitHub API response status:", response.status)
    console.log("Using authentication:", usingAuth)

    if (!response.ok) {
      console.log("GitHub API error:", response.status, response.statusText)

      if (response.status === 404) {
        return NextResponse.json({ error: "User not found" }, { status: 404 })
      }

      if (response.status === 403) {
        const rateLimitReset = response.headers.get("x-ratelimit-reset")
        const resetTime = rateLimitReset
          ? new Date(Number.parseInt(rateLimitReset) * 1000).toLocaleTimeString()
          : "unknown"
        console.log("Rate limit exceeded. Reset time:", resetTime)
        
        // Check if we have remaining requests
        const remaining = response.headers.get("x-ratelimit-remaining")
        console.log("Rate limit remaining:", remaining)
        
        return NextResponse.json(
          {
            error: "GitHub API rate limit exceeded. Please try again later.",
            resetTime,
            remaining: remaining || "0",
          },
          { status: 429 },
        )
      }

      // For any other error, provide a generic message
      return NextResponse.json(
        {
          error: `Unable to fetch user data (Status: ${response.status})`,
          details: response.statusText,
        },
        { status: response.status },
      )
    }

    const userData = await response.json()
    console.log("Successfully fetched user data for:", userData.login)

    // Add metadata about the request type
    const responseData = {
      ...userData,
      _metadata: {
        authenticated: usingAuth,
        timestamp: new Date().toISOString(),
      }
    }

    return NextResponse.json(responseData)
  } catch (error) {
    console.error("Detailed error in API route:", error)
    return NextResponse.json(
      {
        error: "Failed to fetch user data",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}

// Optional: Add a simple health check endpoint
export async function POST(request: NextRequest) {
  try {
    const hasToken = !!process.env.GITHUB_TOKEN
    
    if (hasToken) {
      // Test the token validity
      const testResponse = await fetch("https://api.github.com/user", {
        headers: {
          Authorization: `token ${process.env.GITHUB_TOKEN}`,
          "User-Agent": "GitHub-Card-Generator",
        },
      })
      
      return NextResponse.json({
        tokenConfigured: true,
        tokenValid: testResponse.ok,
        rateLimitRemaining: testResponse.headers.get("x-ratelimit-remaining"),
      })
    }
    
    return NextResponse.json({
      tokenConfigured: false,
      message: "No GitHub token configured - using public API limits",
    })
  } catch (error) {
    return NextResponse.json(
      {
        error: "Health check failed",
        details: error instanceof Error ? error.message : "Unknown error",
      },
      { status: 500 },
    )
  }
}