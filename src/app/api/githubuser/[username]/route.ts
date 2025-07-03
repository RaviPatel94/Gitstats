import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

// Type definitions
interface GitHubUser {
  login: string
  name: string | null
  avatar_url: string
  bio: string | null
  company: string | null
  location: string | null
  created_at: string
  public_repos: number
  total_private_repos?: number
  followers: number
}

interface GitHubRepo {
  name: string
  language: string | null
  stargazers_count: number
  languages_url: string
  fork: boolean
  owner: {
    login: string
  }
  created_at: string
  updated_at: string
  size: number
  private: boolean
}

interface GitHubSearchResponse {
  total_count: number
}

interface LanguageData {
  [language: string]: number
}

interface GraphQLContributionsCollection {
  totalCommitContributions: number
  restrictedContributionsCount: number
}

interface GraphQLUserResponse {
  data?: {
    user?: {
      contributionsCollection?: GraphQLContributionsCollection
    }
  }
  errors?: Array<{ message: string }>
}

interface GitHubContributor {
  author?: {
    login: string
  }
  total: number
}

interface CommitResponse {
  count: number
  method: string
}

interface AuthenticatedUser {
  access_token: string
  login: string
  token_scopes: string[]
  can_access_private_repos: boolean
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ username: string }> },
): Promise<NextResponse> {
  try {
    const { username } = await context.params

    // Check for authenticated user
    let authenticatedUser: AuthenticatedUser | null = null
    try {
      const cookieStore = await cookies()
      const userCookie = cookieStore.get('github_user')
      if (userCookie?.value) {
        const userData = JSON.parse(userCookie.value)
        authenticatedUser = userData
      }
    } catch (error) {
      console.warn('Failed to parse user cookie:', error)
    }

    // Determine which token to use
    const useUserToken = authenticatedUser?.login === username
    const token = useUserToken ? authenticatedUser?.access_token : process.env.GITHUB_TOKEN

    const headers = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "GitHub-Card-Generator",
      ...(token && {
        Authorization: `token ${token}`,
      }),
    }

    // Fetch user data and repositories in parallel
    // Use different repo queries based on authentication
    const reposUrl = useUserToken && authenticatedUser?.can_access_private_repos
      ? `https://api.github.com/user/repos?per_page=100&sort=updated&affiliation=owner` // Gets user's own repos including private
      : `https://api.github.com/users/${username}/repos?per_page=100&sort=updated` // Public repos only

    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, { headers }),
      fetch(reposUrl, { headers })
    ])

    if (!userRes.ok) {
      throw new Error(`User not found: ${userRes.status}`)
    }

    const [userData, repos]: [GitHubUser, GitHubRepo[]] = await Promise.all([
      userRes.json(),
      reposRes.json()
    ])

    // Filter repos to only include the user's own repos (important for authenticated requests)
    const userRepos = Array.isArray(repos) 
      ? repos.filter(repo => repo.owner.login === username)
      : []

    // Calculate total stars from repos
    const totalStars = userRepos.reduce((sum: number, repo: GitHubRepo) => sum + (repo.stargazers_count || 0), 0)

    // Calculate total repos (public + private if authenticated)
    const totalRepos = useUserToken 
      ? userRepos.length // Use actual repo count for authenticated user
      : userData.public_repos || 0

    // Get top languages from repos (limit API calls)
    const languagePromises = userRepos
      .filter((repo: GitHubRepo) => repo.language)
      .slice(0, 25) // Increase limit for authenticated users
      .map(async (repo: GitHubRepo): Promise<LanguageData> => {
        try {
          const langRes = await fetch(repo.languages_url, { headers })
          if (langRes.ok) {
            return await langRes.json() as LanguageData
          }
          return {}
        } catch {
          return {}
        }
      })

    // Enhanced search queries for authenticated users
    const prQuery = useUserToken 
      ? `type:pr+author:${username}` // Can see private PRs
      : `type:pr+author:${username}+is:public` // Only public PRs

    const issueQuery = useUserToken
      ? `type:issue+author:${username}`
      : `type:issue+author:${username}+is:public`

    // Fetch PR and Issues counts in parallel with language data
    const [languageResults, prsRes, issuesRes] = await Promise.all([
      Promise.all(languagePromises),
      fetch(`https://api.github.com/search/issues?q=${prQuery}`, { headers }),
      fetch(`https://api.github.com/search/issues?q=${issueQuery}`, { headers })
    ])

    // Process language data
    const languageMap: Record<string, number> = {}
    languageResults.forEach(langData => {
      for (const [lang, bytes] of Object.entries(langData)) {
        languageMap[lang] = (languageMap[lang] || 0) + (bytes as number)
      }
    })

    const topLanguages = Object.entries(languageMap)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([lang]) => `#${lang}`)

    // Get PR and Issues counts
    const [prsData, issuesData]: [GitHubSearchResponse, GitHubSearchResponse] = await Promise.all([
      prsRes.ok ? prsRes.json() : { total_count: 0 },
      issuesRes.ok ? issuesRes.json() : { total_count: 0 }
    ])

    const totalPRs = prsData.total_count || 0
    const totalIssues = issuesData.total_count || 0

    // Enhanced commit calculation with better accuracy for authenticated users
    let totalCommits = 0
    let commitCalculationMethod = 'estimated'
    
    try {
      if (token) {
        // Method 1: Use GraphQL for comprehensive data (works better with user token)
        const graphqlResult = await getCommitsViaGraphQL(username, userData.created_at, headers)
        if (graphqlResult.count > 0) {
          totalCommits = graphqlResult.count
          commitCalculationMethod = graphqlResult.method
        }
      }
      
      // Method 2: Enhanced repository-based calculation
      if (totalCommits === 0) {
        totalCommits = await getCommitsViaRepositories(username, userRepos, headers)
        if (totalCommits > 0) {
          commitCalculationMethod = 'repository-based'
        }
      }
      
    } catch (error) {
      console.warn('Failed to get commit count:', error)
    }
    
    // Improved fallback estimation
    if (totalCommits === 0) {
      const accountAgeYears = Math.max(1, (new Date().getFullYear() - new Date(userData.created_at).getFullYear()))
      const repoActivity = Math.max(1, totalRepos)
      totalCommits = Math.round(repoActivity * accountAgeYears * 12) // More reasonable estimate
      commitCalculationMethod = 'fallback-estimate'
    }

    // Return the data
    return NextResponse.json({
      // Required user data
      login: userData.login,
      name: userData.name || userData.login,
      avatar_url: userData.avatar_url,
      bio: userData.bio || '',
      company: userData.company || '',
      location: userData.location || '',
      created_at: userData.created_at,
      public_repos: totalRepos,
      followers: userData.followers,
      
      // Extended stats
      totalCommits,
      totalStars,
      totalPRs,
      totalIssues,
      topLanguages,
      
      // Metadata
      _metadata: {
        authenticated: useUserToken,
        hasToken: Boolean(token),
        canAccessPrivateRepos: useUserToken && (authenticatedUser?.can_access_private_repos ?? false),
        timestamp: new Date().toISOString(),
        commitCalculationMethod,
        totalReposIncluded: userRepos.length,
        isOwnProfile: useUserToken,
      },
    })

  } catch (error: unknown) {
    console.error("Error fetching GitHub data:", error)

    let message = "Failed to fetch GitHub data"
    let status = 500

    if (error instanceof Error) {
      if (error.message?.includes('User not found')) {
        message = "User not found"
        status = 404
      } else if (error.message?.includes('rate limit')) {
        message = "Rate limit exceeded. Please try again later or login for higher limits."
        status = 429
      } else {
        message = error.message
      }
    }

    return NextResponse.json(
      {
        error: message,
        suggestion: status === 429 ? "Consider logging in with GitHub for higher rate limits" : undefined,
        ...(process.env.NODE_ENV === "development" && {
          debug: { stack: error instanceof Error ? error.stack : String(error) }
        }),
      },
      { status }
    )
  }
}

// Enhanced GraphQL method with better error handling
async function getCommitsViaGraphQL(
  username: string, 
  createdAt: string, 
  headers: Record<string, string>
): Promise<CommitResponse> {
  try {
    const accountCreatedYear = new Date(createdAt).getFullYear()
    const currentYear = new Date().getFullYear()
    
    let totalCommits = 0
    let successfulRequests = 0
    
    // Get commits for each year from account creation to current year
    for (let year = accountCreatedYear; year <= currentYear; year++) {
      const startDate = `${year}-01-01T00:00:00Z`
      const endDate = year === currentYear 
        ? new Date().toISOString() 
        : `${year}-12-31T23:59:59Z`
      
      const graphqlQuery = `
        query($username: String!, $from: DateTime!, $to: DateTime!) {
          user(login: $username) {
            contributionsCollection(from: $from, to: $to) {
              totalCommitContributions
              restrictedContributionsCount
            }
          }
        }
      `
      
      try {
        const graphqlRes = await fetch('https://api.github.com/graphql', {
          method: 'POST',
          headers: {
            ...headers,
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            query: graphqlQuery,
            variables: { 
              username, 
              from: startDate, 
              to: endDate 
            }
          })
        })

        if (graphqlRes.ok) {
          const data: GraphQLUserResponse = await graphqlRes.json()
          
          if (data.errors) {
            console.warn(`GraphQL errors for year ${year}:`, data.errors)
            continue
          }
          
          const contributionsCollection = data.data?.user?.contributionsCollection
          if (contributionsCollection) {
            totalCommits += contributionsCollection.totalCommitContributions || 0
            totalCommits += contributionsCollection.restrictedContributionsCount || 0
            successfulRequests++
          }
        }
        
        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 150))
        
      } catch (yearError) {
        console.warn(`Failed to fetch commits for year ${year}:`, yearError)
        continue
      }
    }
    
    const method = successfulRequests > 0 ? 'graphql-comprehensive' : 'graphql-failed'
    return { count: totalCommits, method }
    
  } catch (error) {
    console.warn('GraphQL commit fetch failed:', error)
    return { count: 0, method: 'graphql-failed' }
  }
}

// Enhanced repository-based calculation with better accuracy
async function getCommitsViaRepositories(
  username: string, 
  repos: GitHubRepo[], 
  headers: Record<string, string>
): Promise<number> {
  try {
    // Filter and prioritize repositories
    const userRepos = repos
      .filter((repo: GitHubRepo) => !repo.fork && repo.owner?.login === username)
      .sort((a: GitHubRepo, b: GitHubRepo) => {
        // Prioritize recently updated and larger repos
        const aScore = new Date(a.updated_at).getTime() + (a.size || 0) * 1000
        const bScore = new Date(b.updated_at).getTime() + (b.size || 0) * 1000
        return bScore - aScore
      })
      .slice(0, 35) // Check more repositories for better accuracy

    if (userRepos.length === 0) {
      return 0
    }

    // Process repositories in smaller batches to avoid rate limiting
    const batchSize = 3
    let totalCommits = 0
    
    for (let i = 0; i < userRepos.length; i += batchSize) {
      const batch = userRepos.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (repo: GitHubRepo): Promise<number> => {
        try {
          // Method 1: Try contributors API (most accurate)
          const statsRes = await fetch(
            `https://api.github.com/repos/${username}/${repo.name}/stats/contributors`,
            { headers }
          )
          
          if (statsRes.ok) {
            const contributors: GitHubContributor[] = await statsRes.json()
            if (Array.isArray(contributors) && contributors.length > 0) {
              const userContributor = contributors.find(
                (contributor: GitHubContributor) => contributor.author?.login === username
              )
              if (userContributor && userContributor.total) {
                return userContributor.total
              }
            }
          }
          
          // Method 2: Sample commits and estimate
          const commitsRes = await fetch(
            `https://api.github.com/repos/${username}/${repo.name}/commits?author=${username}&per_page=100`,
            { headers }
          )
          
          if (commitsRes.ok) {
            const commits: unknown[] = await commitsRes.json()
            if (Array.isArray(commits)) {
              if (commits.length === 100) {
                // Estimate total based on repo characteristics
                const repoAgeMonths = Math.max(1, 
                  (new Date().getTime() - new Date(repo.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
                )
                const sizeMultiplier = Math.min(3, Math.max(1, (repo.size || 0) / 1000))
                const estimatedTotal = Math.round(commits.length * Math.min(repoAgeMonths / 3, 4) * sizeMultiplier)
                return estimatedTotal
              }
              return commits.length
            }
          }
          
          return 0
        } catch (repoError) {
          console.warn(`Failed to get commits for repo ${repo.name}:`, repoError)
          return 0
        }
      })
      
      const batchResults = await Promise.all(batchPromises)
      totalCommits += batchResults.reduce((sum, count) => sum + count, 0)
      
      // Add delay between batches
      if (i + batchSize < userRepos.length) {
        await new Promise(resolve => setTimeout(resolve, 300))
      }
    }
    
    return totalCommits
    
  } catch (error) {
    console.warn('Repository-based commit calculation failed:', error)
    return 0
  }
}