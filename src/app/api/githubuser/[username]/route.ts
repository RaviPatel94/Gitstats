import { type NextRequest, NextResponse } from "next/server"
import { cookies } from "next/headers"

// Your existing types (keeping them as they are)
export interface GitHubUser {
  login: string;
  name: string;
  avatar_url: string;
  bio: string;
  company: string;
  location: string;
  created_at: string;
  public_repos: number;
  followers: number;
  totalCommits: number;
  totalStars: number;
  totalPRs: number;
  totalIssues: number;
  topLanguages: string[];
  _metadata?: {
    authenticated: boolean;
    timestamp: string;
    commitCalculationMethod?: string;
    dataScope?: string;
  };
}

// Internal API types
interface AuthenticatedUserData {
  access_token: string
  login: string
  token_scopes: string[]
  can_access_private_repos: boolean
}

interface LanguageNodeData {
  name: string
  color: string
}

interface LanguageEdgeData {
  size: number
  node: LanguageNodeData
}

interface RepositoryData {
  name: string
  languages: {
    edges: LanguageEdgeData[]
  }
  stargazers: {
    totalCount: number
  }
}

interface UserStatsData {
  name: string
  login: string
  contributionsCollection: {
    totalCommitContributions: number
  }
  pullRequests: {
    totalCount: number
  }
  openIssues: {
    totalCount: number
  }
  closedIssues: {
    totalCount: number
  }
  repositories: {
    nodes: RepositoryData[]
  }
}

interface GraphQLResponse {
  data?: {
    user?: UserStatsData
  }
  errors?: Array<{ message: string; type?: string }>
}

interface SearchCommitsResponse {
  total_count: number
}

interface ContributionsResponse {
  data?: {
    user?: {
      contributionsCollection: {
        totalCommitContributions: number
        restrictedContributionsCount: number
      }
    }
  }
  errors?: Array<{ message: string; type?: string }>
}

interface RepositoryResponse {
  full_name: string
  name: string
}

interface ContributorStats {
  author?: {
    login: string
  }
  total: number
}

// Custom Error Classes
class CustomApiError extends Error {
  static USER_NOT_FOUND = 'USER_NOT_FOUND'
  static GRAPHQL_ERROR = 'GRAPHQL_ERROR'
  static GITHUB_REST_API_ERROR = 'GITHUB_REST_API_ERROR'
  
  constructor(message: string, public code?: string) {
    super(message)
    this.name = 'CustomApiError'
  }
}

class MissingParameterError extends Error {
  constructor(params: string[]) {
    super(`Missing required parameters: ${params.join(', ')}`)
    this.name = 'MissingParameterError'
  }
}

// Utility Functions
const apiLogger = {
  log: (message: unknown) => console.log(message),
  error: (message: unknown, error?: unknown) => {
    if (error) {
      console.error(message, error)
    } else {
      console.error(message)
    }
  },
}

const wrapTextInLines = (text: string, width: number, indent: number): string[] => {
  const words = text.split(' ')
  const lines: string[] = []
  let currentLine = ' '.repeat(indent)
  
  for (const word of words) {
    if (currentLine.length + word.length + 1 <= width) {
      currentLine += (currentLine.trim() ? ' ' : '') + word
    } else {
      lines.push(currentLine)
      currentLine = ' '.repeat(indent) + word
    }
  }
  
  if (currentLine.trim()) {
    lines.push(currentLine)
  }
  
  return lines
}

// GraphQL request function
const makeGraphQLRequest = async (
  { query, variables }: { query: string; variables: Record<string, string> },
  headers: Record<string, string>
) => {
  const response = await fetch('https://api.github.com/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    body: JSON.stringify({ query, variables }),
  })
  
  return {
    data: await response.json(),
    status: response.status,
    statusText: response.statusText,
  }
}

// Retry wrapper
const retryApiCall = async <T>(
  fetcherFunction: (variables: Record<string, string>, token: string) => Promise<T>,
  variables: Record<string, string>,
  token?: string,
  maxRetries = 3
): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetcherFunction(variables, token || process.env.GITHUB_TOKEN || '')
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 1000 * Math.pow(2, i)))
    }
  }
  throw new Error('Max retries exceeded')
}

// Method 1: Search API with multiple queries
const getCommitsViaSearchAPI = async (
  username: string, 
  token: string
): Promise<{ count: number; method: string }> => {
  try {
    // Try different search queries and take the maximum
    const queries = [
      `author:${username}`, // Standard author search
      `committer:${username}`, // Committer search
      `author:${username} OR committer:${username}` // Combined search
    ]

    let maxCount = 0
    let bestMethod = 'search-api'

    for (const query of queries) {
      try {
        const response = await fetch(
          `https://api.github.com/search/commits?q=${encodeURIComponent(query)}`,
          {
            headers: {
              'Accept': 'application/vnd.github.cloak-preview',
              'Authorization': `token ${token}`,
            },
          }
        )

        if (response.ok) {
          const data = await response.json() as SearchCommitsResponse
          const count = data.total_count || 0
          if (count > maxCount) {
            maxCount = count
            bestMethod = `search-api-${query.includes('OR') ? 'combined' : query.includes('committer') ? 'committer' : 'author'}`
          }
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 200))
      } catch (queryError) {
        apiLogger.error(`Search query failed: ${query}`, queryError)
        continue
      }
    }

    return { count: maxCount, method: bestMethod }
  } catch (error) {
    throw error
  }
}

// Method 2: GraphQL with multiple years for comprehensive contribution data
const getCommitsViaGraphQL = async (
  username: string, 
  token: string, 
  isAuthenticated: boolean
): Promise<{ count: number; method: string }> => {
  try {
    const currentYear = new Date().getFullYear()
    const startYear = currentYear - 10 // Go back 10 years
    let totalCommits = 0

    for (let year = startYear; year <= currentYear; year++) {
      try {
        const fromDate = `${year}-01-01T00:00:00Z`
        const toDate = year === currentYear 
          ? new Date().toISOString() 
          : `${year}-12-31T23:59:59Z`

        const query = `
          query($username: String!, $from: DateTime!, $to: DateTime!) {
            user(login: $username) {
              contributionsCollection(from: $from, to: $to) {
                totalCommitContributions
                restrictedContributionsCount
              }
            }
          }
        `

        const response = await makeGraphQLRequest(
          { query, variables: { username, from: fromDate, to: toDate } },
          { Authorization: `bearer ${token}` }
        )

        const contributionsData = response.data as ContributionsResponse
        if (contributionsData.data?.user?.contributionsCollection) {
          const contributions = contributionsData.data.user.contributionsCollection
          totalCommits += contributions.totalCommitContributions || 0
          // Add restricted contributions (private repos) for authenticated users
          if (isAuthenticated) {
            totalCommits += contributions.restrictedContributionsCount || 0
          }
        }

        // Add delay to avoid rate limiting
        await new Promise(resolve => setTimeout(resolve, 150))
      } catch (yearError) {
        apiLogger.error(`GraphQL failed for year ${year}:`, yearError)
        continue
      }
    }

    return { 
      count: totalCommits, 
      method: `graphql-multi-year-${isAuthenticated ? 'with-private' : 'public-only'}` 
    }
  } catch (error) {
    throw error
  }
}

// Method 3: Enhanced repository-based counting
const getCommitsViaRepositories = async (
  username: string, 
  token: string, 
  isAuthenticated: boolean
): Promise<{ count: number; method: string }> => {
  try {
    // Get all repositories (public + private if authenticated)
    const reposUrl = isAuthenticated 
      ? `https://api.github.com/user/repos?per_page=100&affiliation=owner,collaborator`
      : `https://api.github.com/users/${username}/repos?per_page=100`

    const reposResponse = await fetch(reposUrl, {
      headers: {
        'Accept': 'application/vnd.github.v3+json',
        'Authorization': `token ${token}`,
      },
    })

    if (!reposResponse.ok) {
      throw new Error(`Failed to fetch repositories: ${reposResponse.status}`)
    }

    const repos = await reposResponse.json() as RepositoryResponse[]
    let totalCommits = 0

    // Process repositories in batches to avoid rate limiting
    const batchSize = 10
    for (let i = 0; i < repos.length; i += batchSize) {
      const batch = repos.slice(i, i + batchSize)
      
      const batchPromises = batch.map(async (repo: RepositoryResponse) => {
        try {
          // Use stats/contributors API for accurate commit counts
          const statsResponse = await fetch(
            `https://api.github.com/repos/${repo.full_name}/stats/contributors`,
            {
              headers: {
                'Accept': 'application/vnd.github.v3+json',
                'Authorization': `token ${token}`,
              },
            }
          )

          if (statsResponse.ok) {
            const contributors = await statsResponse.json() as ContributorStats[]
            if (Array.isArray(contributors)) {
              const userContribution = contributors.find(
                (contributor: ContributorStats) => contributor.author?.login === username
              )
              return userContribution?.total || 0
            }
          }

          return 0
        } catch (repoError) {
          apiLogger.error(`Failed to get commits for ${repo.full_name}:`, repoError)
          return 0
        }
      })

      const batchResults = await Promise.all(batchPromises)
      totalCommits += batchResults.reduce((sum, count) => sum + count, 0)

      // Add delay between batches
      if (i + batchSize < repos.length) {
        await new Promise(resolve => setTimeout(resolve, 500))
      }
    }

    return { 
      count: totalCommits, 
      method: `repository-stats-${isAuthenticated ? 'all-repos' : 'public-only'}` 
    }
  } catch (error) {
    throw error
  }
}

// Enhanced function to get total commits with multiple fallback methods
const getTotalCommitsCount = async (
  username: string, 
  token: string, 
  isAuthenticated: boolean
): Promise<{ count: number; method: string }> => {
  try {
    // Method 1: Search API (most comprehensive)
    const searchResult = await getCommitsViaSearchAPI(username, token)
    if (searchResult.count > 0) {
      return searchResult
    }

    // Method 2: GraphQL with multiple years (more accurate for contributions)
    const graphqlResult = await getCommitsViaGraphQL(username, token, isAuthenticated)
    if (graphqlResult.count > 0) {
      return graphqlResult
    }

    // Method 3: Repository-based counting (fallback)
    return await getCommitsViaRepositories(username, token, isAuthenticated)

  } catch (error) {
    apiLogger.error('All commit counting methods failed:', error)
    return { count: 0, method: 'all-methods-failed' }
  }
}

// GraphQL Queries - Fixed to remove invalid privacy arguments
const getStatsQuery = (isAuthenticated: boolean) => `
  query userInfo($login: String!) {
    user(login: $login) {
      name
      login
      contributionsCollection {
        totalCommitContributions
      }
      pullRequests {
        totalCount
      }
      openIssues: issues(states: OPEN) {
        totalCount
      }
      closedIssues: issues(states: CLOSED) {
        totalCount
      }
      repositories(first: 100, ownerAffiliations: OWNER${isAuthenticated ? '' : ', privacy: PUBLIC'}) {
        nodes {
          name
          stargazers {
            totalCount
          }
        }
      }
    }
  }
`

const getLanguagesQuery = (isAuthenticated: boolean) => `
  query userInfo($login: String!) {
    user(login: $login) {
      repositories(ownerAffiliations: OWNER, isFork: false, first: 100${isAuthenticated ? '' : ', privacy: PUBLIC'}) {
        nodes {
          name
          stargazers {
            totalCount
          }
          languages(first: 10, orderBy: {field: SIZE, direction: DESC}) {
            edges {
              size
              node {
                color
                name
              }
            }
          }
        }
      }
    }
  }
`

// Fetcher Functions
const statsDataFetcher = (variables: Record<string, string>, token: string, isAuthenticated: boolean) => {
  const query = getStatsQuery(isAuthenticated)
  return makeGraphQLRequest({ query, variables }, { Authorization: `bearer ${token}` })
}

const languagesDataFetcher = (variables: Record<string, string>, token: string, isAuthenticated: boolean) => {
  const query = getLanguagesQuery(isAuthenticated)
  return makeGraphQLRequest(
    { query, variables },
    { Authorization: `bearer ${token}` }
  )
}

// Main fetcher functions
const getUserStats = async (
  username: string,
  token: string,
  isAuthenticated: boolean,
  excludeRepos: string[] = []
): Promise<{
  totalCommits: number
  totalStars: number
  totalPRs: number
  totalIssues: number
  commitMethod: string
}> => {
  if (!username) {
    throw new MissingParameterError(['username'])
  }

  const apiResponse = await retryApiCall(
    (vars, tkn) => statsDataFetcher(vars, tkn, isAuthenticated), 
    { login: username }, 
    token
  )

  const graphqlResponse = apiResponse.data as GraphQLResponse

  if (graphqlResponse.errors) {
    apiLogger.error('GraphQL errors:', graphqlResponse.errors)
    if (graphqlResponse.errors[0].type === 'NOT_FOUND') {
      throw new CustomApiError(
        graphqlResponse.errors[0].message || 'Could not fetch user.',
        CustomApiError.USER_NOT_FOUND
      )
    }
    if (graphqlResponse.errors[0].message) {
      throw new CustomApiError(
        wrapTextInLines(graphqlResponse.errors[0].message, 90, 1)[0],
        apiResponse.statusText
      )
    }
    throw new CustomApiError(
      'Something went wrong while trying to retrieve the stats data using the GraphQL API.',
      CustomApiError.GRAPHQL_ERROR
    )
  }

  if (!graphqlResponse.data?.user) {
    throw new CustomApiError('User data not found', CustomApiError.USER_NOT_FOUND)
  }

  const userData: UserStatsData = graphqlResponse.data.user

  // Calculate total stars excluding hidden repos
  const hiddenRepos = new Set(excludeRepos)
  const totalStars = userData.repositories.nodes
    .filter(repo => !hiddenRepos.has(repo.name))
    .reduce((total, current) => total + current.stargazers.totalCount, 0)

  // Get total commits via enhanced method with multiple fallbacks
  let totalCommits = userData.contributionsCollection.totalCommitContributions
  let commitMethod = 'graphql-contributions'
  
  try {
    const commitsResult = await getTotalCommitsCount(username, token, isAuthenticated)
    if (commitsResult.count > 0) {
      totalCommits = commitsResult.count
      commitMethod = commitsResult.method
    }
  } catch {
    apiLogger.log('Using GraphQL commit count as fallback')
  }

  return {
    totalCommits,
    totalStars,
    totalPRs: userData.pullRequests.totalCount,
    totalIssues: userData.openIssues.totalCount + userData.closedIssues.totalCount,
    commitMethod
  }
}

const getUserTopLanguages = async (
  username: string,
  token: string,
  isAuthenticated: boolean,
  excludeRepos: string[] = []
): Promise<string[]> => {
  if (!username) {
    throw new MissingParameterError(['username'])
  }

  const apiResponse = await retryApiCall(
    (vars, tkn) => languagesDataFetcher(vars, tkn, isAuthenticated), 
    { login: username }, 
    token
  )

  const graphqlResponse = apiResponse.data as GraphQLResponse

  if (graphqlResponse.errors) {
    apiLogger.error('GraphQL errors:', graphqlResponse.errors)
    if (graphqlResponse.errors[0].type === 'NOT_FOUND') {
      throw new CustomApiError(
        graphqlResponse.errors[0].message || 'Could not fetch user.',
        CustomApiError.USER_NOT_FOUND
      )
    }
    if (graphqlResponse.errors[0].message) {
      throw new CustomApiError(
        wrapTextInLines(graphqlResponse.errors[0].message, 90, 1)[0],
        apiResponse.statusText
      )
    }
    throw new CustomApiError(
      'Something went wrong while trying to retrieve the language data using the GraphQL API.',
      CustomApiError.GRAPHQL_ERROR
    )
  }

  if (!graphqlResponse.data?.user) {
    throw new CustomApiError('User data not found', CustomApiError.USER_NOT_FOUND)
  }

  let repositoryNodes = graphqlResponse.data.user.repositories.nodes
  const hiddenReposMap: Record<string, boolean> = {}

  // Populate hiddenReposMap
  if (excludeRepos) {
    excludeRepos.forEach(repoName => {
      hiddenReposMap[repoName] = true
    })
  }

  // Filter out hidden repos and sort by stars
  repositoryNodes = repositoryNodes
    .filter((repo: RepositoryData) => !hiddenReposMap[repo.name])
    .sort((a: RepositoryData, b: RepositoryData) => b.stargazers.totalCount - a.stargazers.totalCount)

  // Aggregate languages properly by total bytes used
  const languageMap: Record<string, { name: string; color: string; size: number; count: number }> = {}

  repositoryNodes.forEach((repo: RepositoryData) => {
    repo.languages.edges.forEach((edge: LanguageEdgeData) => {
      const langName = edge.node.name
      const langSize = edge.size
      
      if (languageMap[langName]) {
        languageMap[langName].size += langSize
        languageMap[langName].count += 1
      } else {
        languageMap[langName] = {
          name: langName,
          color: edge.node.color,
          size: langSize,
          count: 1
        }
      }
    })
  })

  // Sort by total bytes used (descending) and return top 5
  return Object.values(languageMap)
    .sort((a, b) => b.size - a.size)
    .slice(0, 5)
    .map(lang => `#${lang.name}`)
}

// Main API Handler
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ username: string }> }
): Promise<NextResponse> {
  try {
    const { username } = await context.params

    // Check for authenticated user
    let authenticatedUserData: AuthenticatedUserData | null = null
    try {
      const cookieStore = await cookies()
      const userCookie = cookieStore.get('github_user')
      if (userCookie?.value) {
        const userData = JSON.parse(userCookie.value)
        authenticatedUserData = userData
      }
    } catch (cookieError) {
      console.warn('Failed to parse user cookie:', cookieError)
    }

    // Determine authentication status and token
    const isUserAuthenticated = authenticatedUserData?.login === username
    const githubToken = isUserAuthenticated ? authenticatedUserData?.access_token : process.env.GITHUB_TOKEN

    if (!githubToken) {
      throw new Error('No GitHub token available')
    }

    // Get query parameters
    const requestUrl = new URL(request.url)
    const repositoriesToExclude = requestUrl.searchParams.get('exclude_repo')?.split(',').filter(Boolean) || []

    // Fetch basic user data
    const userApiResponse = await fetch(`https://api.github.com/users/${username}`, {
      headers: {
        Accept: 'application/vnd.github.v3+json',
        'User-Agent': 'GitHub-Card-Generator',
        Authorization: `token ${githubToken}`,
      },
    })

    if (!userApiResponse.ok) {
      throw new Error(`User not found: ${userApiResponse.status}`)
    }

    const basicUserData = await userApiResponse.json()

    // Fetch enhanced stats using GraphQL with proper authentication handling
    const [userStatsData, topLanguagesData] = await Promise.all([
      getUserStats(username, githubToken, isUserAuthenticated, repositoriesToExclude),
      getUserTopLanguages(username, githubToken, isUserAuthenticated, repositoriesToExclude),
    ])

    // Return data matching your GitHubUser interface
    const responseData: GitHubUser = {
      login: basicUserData.login,
      name: basicUserData.name || basicUserData.login,
      avatar_url: basicUserData.avatar_url,
      bio: basicUserData.bio || '',
      company: basicUserData.company || '',
      location: basicUserData.location || '',
      created_at: basicUserData.created_at,
      public_repos: basicUserData.public_repos,
      followers: basicUserData.followers,
      totalCommits: userStatsData.totalCommits,
      totalStars: userStatsData.totalStars,
      totalPRs: userStatsData.totalPRs,
      totalIssues: userStatsData.totalIssues,
      topLanguages: topLanguagesData,
      _metadata: {
        authenticated: isUserAuthenticated,
        timestamp: new Date().toISOString(),
        commitCalculationMethod: userStatsData.commitMethod,
        dataScope: isUserAuthenticated ? 'public-and-private' : 'public-only',
      },
    }

    return NextResponse.json(responseData)

  } catch (error: unknown) {
    console.error('Error fetching GitHub data:', error)

    let errorMessage = 'Failed to fetch GitHub data'
    let statusCode = 500

    if (error instanceof CustomApiError) {
      if (error.code === CustomApiError.USER_NOT_FOUND) {
        errorMessage = 'User not found'
        statusCode = 404
      } else if (error.code === CustomApiError.GRAPHQL_ERROR) {
        errorMessage = 'GraphQL API error'
        statusCode = 500
      } else {
        errorMessage = error.message
      }
    } else if (error instanceof Error) {
      if (error.message?.includes('User not found')) {
        errorMessage = 'User not found'
        statusCode = 404
      } else if (error.message?.includes('rate limit')) {
        errorMessage = 'Rate limit exceeded. Please try again later or login for higher limits.'
        statusCode = 429
      } else {
        errorMessage = error.message
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        suggestion: statusCode === 429 ? 'Consider logging in with GitHub for higher rate limits' : undefined,
        ...(process.env.NODE_ENV === 'development' && {
          debug: { stack: error instanceof Error ? error.stack : String(error) },
        }),
      },
      { status: statusCode }
    )
  }
}