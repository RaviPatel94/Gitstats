import { type NextRequest, NextResponse } from "next/server"

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

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ username: string }> },
): Promise<NextResponse> {
  try {
    const { username } = await context.params

    const headers = {
      Accept: "application/vnd.github.v3+json",
      "User-Agent": "GitHub-Card-Generator",
      ...(process.env.GITHUB_TOKEN && {
        Authorization: `token ${process.env.GITHUB_TOKEN}`,
      }),
    }

    // Fetch user data and repositories in parallel
    const [userRes, reposRes] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, { headers }),
      fetch(`https://api.github.com/users/${username}/repos?per_page=100&sort=updated`, { headers })
    ])

    if (!userRes.ok) {
      throw new Error(`User not found: ${userRes.status}`)
    }

    const [userData, repos]: [GitHubUser, GitHubRepo[]] = await Promise.all([
      userRes.json(),
      reposRes.json()
    ])

    // Calculate total stars from repos
    const totalStars = Array.isArray(repos) 
      ? repos.reduce((sum: number, repo: GitHubRepo) => sum + (repo.stargazers_count || 0), 0)
      : 0

    const totalRepos = (userData.public_repos || 0) + (userData.total_private_repos || 0)

    // Get top languages from repos (limit API calls)
    const languagePromises = repos
      .filter((repo: GitHubRepo) => repo.language)
      .slice(0, 20)
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

    // Fetch PR and Issues counts in parallel with language data
    const [languageResults, prsRes, issuesRes] = await Promise.all([
      Promise.all(languagePromises),
      fetch(`https://api.github.com/search/issues?q=type:pr+author:${username}`, { headers }),
      fetch(`https://api.github.com/search/issues?q=type:issue+author:${username}`, { headers })
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

    // CORRECTED COMMIT CALCULATION - Following github-readme-stats approach
    let totalCommits = 0
    let commitCalculationMethod = 'estimated'
    
    try {
      if (process.env.GITHUB_TOKEN) {
        // Method 1: Use GraphQL to get comprehensive contribution data
        const graphqlResult = await getCommitsViaGraphQL(username, userData.created_at, headers)
        if (graphqlResult.count > 0) {
          totalCommits = graphqlResult.count
          commitCalculationMethod = 'graphql'
        }
      }
      
      // Method 2: Enhanced repository-based calculation if GraphQL fails
      if (totalCommits === 0) {
        totalCommits = await getCommitsViaRepositories(username, repos, headers)
        if (totalCommits > 0) {
          commitCalculationMethod = 'repository-based'
        }
      }
      
    } catch (error) {
      console.warn('Failed to get commit count:', error)
    }
    
    // Final fallback estimation (more conservative)
    if (totalCommits === 0) {
      const accountAgeYears = Math.max(1, (new Date().getFullYear() - new Date(userData.created_at).getFullYear()))
      totalCommits = Math.round(totalRepos * accountAgeYears * 8) // Conservative estimate
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
        authenticated: Boolean(process.env.GITHUB_TOKEN),
        timestamp: new Date().toISOString(),
        commitCalculationMethod,
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
      } else {
        message = error.message
      }
    }

    return NextResponse.json(
      {
        error: message,
        ...(process.env.NODE_ENV === "development" && {
          debug: { stack: error instanceof Error ? error.stack : String(error) }
        }),
      },
      { status }
    )
  }
}

// Method 1: Proper GraphQL approach (matches github-readme-stats)
async function getCommitsViaGraphQL(
  username: string, 
  createdAt: string, 
  headers: Record<string, string>
): Promise<CommitResponse> {
  try {
    const accountCreatedYear = new Date(createdAt).getFullYear()
    const currentYear = new Date().getFullYear()
    
    // Calculate total commits by iterating through years
    let totalCommits = 0
    
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
            // Add restricted contributions (private repos) if available
            totalCommits += contributionsCollection.restrictedContributionsCount || 0
          }
        }
        
        // Add small delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 100))
        
      } catch (yearError) {
        console.warn(`Failed to fetch commits for year ${year}:`, yearError)
        continue
      }
    }
    
    return { count: totalCommits, method: 'graphql-yearly' }
    
  } catch (error) {
    console.warn('GraphQL commit fetch failed:', error)
    return { count: 0, method: 'failed' }
  }
}

// Method 2: Enhanced repository-based calculation
async function getCommitsViaRepositories(
  username: string, 
  repos: GitHubRepo[], 
  headers: Record<string, string>
): Promise<number> {
  try {
    // Filter and sort repositories for better accuracy
    const userRepos = repos
      .filter((repo: GitHubRepo) => !repo.fork && repo.owner?.login === username) // Only user's own repos, exclude forks
      .sort((a: GitHubRepo, b: GitHubRepo) => {
        // Sort by recent activity and size
        const aScore = new Date(a.updated_at).getTime() + (a.size || 0)
        const bScore = new Date(b.updated_at).getTime() + (b.size || 0)
        return bScore - aScore
      })
      .slice(0, 30) // Check more repositories for better accuracy

    if (userRepos.length === 0) {
      return 0
    }

    // Process repositories in batches to avoid rate limiting
    const batchSize = 5
    let totalCommits = 0
    
    for (let i = 0; i < userRepos.length; i += batchSize) {
      const batch = userRepos.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (repo: GitHubRepo): Promise<number> => {
        try {
          // Use statistics API first (more accurate)
          const statsRes = await fetch(
            `https://api.github.com/repos/${username}/${repo.name}/stats/contributors`,
            { headers }
          )
          
          if (statsRes.ok) {
            const contributors: GitHubContributor[] = await statsRes.json()
            if (Array.isArray(contributors)) {
              const userContributor = contributors.find(
                (contributor: GitHubContributor) => contributor.author?.login === username
              )
              if (userContributor) {
                return userContributor.total || 0
              }
            }
          }
          
          // Fallback: Get commits directly
          const commitsRes = await fetch(
            `https://api.github.com/repos/${username}/${repo.name}/commits?author=${username}&per_page=100`,
            { headers }
          )
          
          if (commitsRes.ok) {
            const commits: unknown[] = await commitsRes.json()
            if (Array.isArray(commits)) {
              // If we got 100 commits, there might be more - estimate based on repo activity
              if (commits.length === 100) {
                // Estimate based on repo age and activity
                const repoAge = Math.max(1, 
                  (new Date().getTime() - new Date(repo.created_at).getTime()) / (1000 * 60 * 60 * 24 * 30)
                ) // Age in months
                const estimatedTotal = Math.round(commits.length * Math.min(repoAge / 6, 3)) // Conservative multiplier
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
      
      // Add delay between batches to respect rate limits
      if (i + batchSize < userRepos.length) {
        await new Promise(resolve => setTimeout(resolve, 200))
      }
    }
    
    return totalCommits
    
  } catch (error) {
    console.warn('Repository-based commit calculation failed:', error)
    return 0
  }
}