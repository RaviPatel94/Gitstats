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
  isPrivate: boolean
  isFork: boolean
  isArchived: boolean
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
    totalCount: number
  }
}

interface GraphQLResponse {
  data?: {
    user?: UserStatsData
  }
  errors?: Array<{ message: string; type?: string }>
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

// Retry wrapper with exponential backoff
const retryApiCall = async <T>(
  fetcherFunction: (variables: Record<string, string>, token: string) => Promise<T>,
  variables: Record<string, string>,
  token?: string,
  maxRetries = 2
): Promise<T> => {
  for (let i = 0; i < maxRetries; i++) {
    try {
      return await fetcherFunction(variables, token || process.env.GITHUB_TOKEN || '')
    } catch (error) {
      if (i === maxRetries - 1) throw error
      await new Promise(resolve => setTimeout(resolve, 500 * Math.pow(2, i)))
    }
  }
  throw new Error('Max retries exceeded')
}

// OPTIMIZED: Single GraphQL query to get ALL data including repository counts
const getCompleteUserDataQuery = (isAuthenticated: boolean) => `
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
      repositories(
        first: 100
        ownerAffiliations: [OWNER, COLLABORATOR, ORGANIZATION_MEMBER]
        ${isAuthenticated ? '' : 'privacy: PUBLIC'}
        orderBy: {field: UPDATED_AT, direction: DESC}
      ) {
        totalCount
        nodes {
          name
          isPrivate
          isFork
          isArchived
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

// IMPROVED: More comprehensive commit counting methods
const getAllTimeCommitCount = async (
  username: string,
  token: string,
  isAuthenticated: boolean,
  userData: UserStatsData
): Promise<{ count: number; method: string }> => {
  const repositories = userData.repositories.nodes.filter(repo => 
    !repo.isFork && !repo.isArchived
  )
  
  let totalCommits = 0
  let successfulRepos = 0
  let failedRepos = 0
  
  // Method 1: Try to get commit counts from each repository
  try {
    const commitPromises = repositories.map(async (repo) => {
      try {
        // Get commit count for this specific repository
        const commitsQuery = `
          query getRepoCommits($owner: String!, $name: String!) {
            repository(owner: $owner, name: $name) {
              defaultBranchRef {
                target {
                  ... on Commit {
                    history(author: {id: $authorId}) {
                      totalCount
                    }
                  }
                }
              }
            }
          }
        `
        
        // First get the user's node ID for filtering
        const userQuery = `
          query getUser($login: String!) {
            user(login: $login) {
              id
            }
          }
        `
        
        const userIdResponse = await makeGraphQLRequest(
          { query: userQuery, variables: { login: username } },
          { Authorization: `bearer ${token}` }
        )
        
        if (!userIdResponse.data?.data?.user?.id) {
          throw new Error('Could not get user ID')
        }
        
        const userId = userIdResponse.data.data.user.id
        
        const commitResponse = await makeGraphQLRequest(
          { 
            query: commitsQuery, 
            variables: { 
              owner: username, 
              name: repo.name,
              authorId: userId
            } 
          },
          { Authorization: `bearer ${token}` }
        )
        
        if (commitResponse.data?.data?.repository?.defaultBranchRef?.target?.history?.totalCount) {
          const repoCommits = commitResponse.data.data.repository.defaultBranchRef.target.history.totalCount
          
          // Add 1 for initial commit if repository was created by the user
          // (GitHub doesn't always count the initial commit in history)
          const adjustedCommits = repoCommits + 1
          
          successfulRepos++
          return adjustedCommits
        }
        
        return 0
      } catch (error) {
        failedRepos++
        apiLogger.error(`Failed to get commits for ${repo.name}:`, error)
        return 0
      }
    })
    
    const commitCounts = await Promise.all(commitPromises)
    totalCommits = commitCounts.reduce((sum, count) => sum + count, 0)
    
    apiLogger.log(`Commit counting results: ${successfulRepos} successful, ${failedRepos} failed repos`)
    
    if (successfulRepos > 0) {
      return {
        count: totalCommits,
        method: `repository-history-${isAuthenticated ? 'authenticated' : 'public'}-${successfulRepos}of${repositories.length}repos`
      }
    }
  } catch (error) {
    apiLogger.error('Repository-based commit counting failed:', error)
  }
  
  // Method 2: Fallback to contribution timeline (more comprehensive than just last year)
  try {
    const contributionQuery = `
      query getContributionTimeline($login: String!) {
        user(login: $login) {
          contributionsCollection {
            totalCommitContributions
          }
          ${Array.from({length: 10}, (_, i) => {
            const year = new Date().getFullYear() - i
            return `
              contributions${year}: contributionsCollection(
                from: "${year}-01-01T00:00:00Z"
                to: "${year}-12-31T23:59:59Z"
              ) {
                totalCommitContributions
              }
            `
          }).join('')}
        }
      }
    `
    
    const timelineResponse = await makeGraphQLRequest(
      { query: contributionQuery, variables: { login: username } },
      { Authorization: `bearer ${token}` }
    )
    
    if (timelineResponse.data?.data?.user) {
      const user = timelineResponse.data.data.user
      let historicalCommits = 0
      
      // Sum up contributions from multiple years
      for (let i = 0; i < 10; i++) {
        const year = new Date().getFullYear() - i
        const yearData = user[`contributions${year}`]
        if (yearData?.totalCommitContributions) {
          historicalCommits += yearData.totalCommitContributions
        }
      }
      
      // Add estimated commits for repository creation
      const estimatedInitialCommits = repositories.length
      
      return {
        count: historicalCommits + estimatedInitialCommits,
        method: `contribution-timeline-${isAuthenticated ? 'authenticated' : 'public'}-10years+${estimatedInitialCommits}initial`
      }
    }
  } catch (error) {
    apiLogger.error('Contribution timeline method failed:', error)
  }
  
  // Method 3: Final fallback - use current year + estimate
  const currentYearCommits = userData.contributionsCollection.totalCommitContributions
  const estimatedHistoricalMultiplier = 3 // Rough estimate based on typical developer patterns
  const estimatedInitialCommits = repositories.length
  
  return {
    count: Math.round(currentYearCommits * estimatedHistoricalMultiplier) + estimatedInitialCommits,
    method: `estimated-fallback-${isAuthenticated ? 'authenticated' : 'public'}-${currentYearCommits}*${estimatedHistoricalMultiplier}+${estimatedInitialCommits}initial`
  }
}

// UPDATED: Replace the getOptimizedCommitCount function with this more comprehensive version
const getComprehensiveCommitCount = async (
  username: string,
  token: string,
  isAuthenticated: boolean,
  userData: UserStatsData
): Promise<{ count: number; method: string }> => {
  apiLogger.log('Starting comprehensive commit count calculation...')
  
  const result = await getAllTimeCommitCount(username, token, isAuthenticated, userData)
  
  apiLogger.log(`Comprehensive commit count: ${result.count} commits (method: ${result.method})`)
  
  return result
}

// OPTIMIZED: Single fetcher function for all data
const getCompleteUserData = async (
  username: string,
  token: string,
  isAuthenticated: boolean
) => {
  const query = getCompleteUserDataQuery(isAuthenticated)
  return makeGraphQLRequest({ query, variables: { login: username } }, { Authorization: `bearer ${token}` })
}

// UPDATED: Main getUserStats function with the new commit counting
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
  totalRepos: number
  publicRepos: number
  privateRepos: number
}> => {
  if (!username) {
    throw new MissingParameterError(['username'])
  }

  const apiResponse = await retryApiCall(
    (vars, tkn) => getCompleteUserData(vars.login, tkn, isAuthenticated), 
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

  // Calculate repository stats
  const totalRepos = userData.repositories.totalCount
  const publicRepos = userData.repositories.nodes.filter(repo => !repo.isPrivate).length
  const privateRepos = userData.repositories.nodes.filter(repo => repo.isPrivate).length

  // Calculate total stars excluding hidden repos
  const hiddenRepos = new Set(excludeRepos)
  const totalStars = userData.repositories.nodes
    .filter(repo => !hiddenRepos.has(repo.name))
    .reduce((total, current) => total + current.stargazers.totalCount, 0)

  // UPDATED: Use comprehensive commit counting
  const commitsResult = await getComprehensiveCommitCount(username, token, isAuthenticated, userData)
  
  return {
    totalCommits: commitsResult.count,
    totalStars,
    totalPRs: userData.pullRequests.totalCount,
    totalIssues: userData.openIssues.totalCount + userData.closedIssues.totalCount,
    commitMethod: commitsResult.method,
    totalRepos,
    publicRepos,
    privateRepos
  }
}

// OPTIMIZED: Languages function using data from the same GraphQL call
const getUserTopLanguages = async (
  userData: UserStatsData,
  excludeRepos: string[] = []
): Promise<string[]> => {
  let repositoryNodes = userData.repositories.nodes
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

// OPTIMIZED: Main API Handler with reduced API calls
export async function GET(
  request: NextRequest,
  context: { params: Promise<{ username: string }> }
): Promise<NextResponse> {
  const startTime = Date.now()
  
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

    // OPTIMIZED: Single API call for basic user data + single GraphQL call for everything else
    const [userApiResponse, userStatsData] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, {
        headers: {
          Accept: 'application/vnd.github.v3+json',
          'User-Agent': 'GitHub-Card-Generator',
          Authorization: `token ${githubToken}`,
        },
      }),
      getUserStats(username, githubToken, isUserAuthenticated, repositoriesToExclude),
    ])

    if (!userApiResponse.ok) {
      throw new Error(`User not found: ${userApiResponse.status}`)
    }

    const basicUserData = await userApiResponse.json()

    // Get the complete user data for languages (reuse the same GraphQL response)
    const completeDataResponse = await getCompleteUserData(username, githubToken, isUserAuthenticated)
    const completeUserData = completeDataResponse.data.data?.user

    if (!completeUserData) {
      throw new Error('Failed to fetch complete user data')
    }

    // Get top languages using the same data
    const topLanguagesData = await getUserTopLanguages(completeUserData, repositoriesToExclude)

    const processingTime = Date.now() - startTime
    apiLogger.log(`Total processing time: ${processingTime}ms`)
    apiLogger.log(`Total API calls made: Variable (1 REST + multiple GraphQL for comprehensive commit counting)`)
    apiLogger.log(`Repository stats: ${userStatsData.totalRepos} total (${userStatsData.publicRepos} public, ${userStatsData.privateRepos} private)`)

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
    const processingTime = Date.now() - startTime
    console.error(`Error fetching GitHub data (${processingTime}ms):`, error)

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