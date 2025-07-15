// Types and Interfaces
export interface GitHubUser {
  login: string
  name: string
  avatar_url: string
  bio: string
  company: string
  location: string
  created_at: string
  public_repos: number
  followers: number
  totalCommits: number
  totalStars: number
  totalPRs: number
  totalIssues: number
  topLanguages: string[]
  _metadata: {
    authenticated: boolean
    timestamp: string
    commitCalculationMethod: string
    dataScope: string
  }
}

export interface AuthenticatedUserData {
  login: string
  access_token: string
}

export interface UserStatsData {
  id: string
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
    totalCount: number
    nodes: RepositoryData[]
  }
}

export interface RepositoryData {
  name: string
  isPrivate: boolean
  isFork: boolean
  isArchived: boolean
  stargazers: {
    totalCount: number
  }
  languages: {
    edges: LanguageEdgeData[]
  }
}

export interface LanguageEdgeData {
  size: number
  node: {
    color: string
    name: string
  }
}

export interface GraphQLResponse {
  data?: {
    user?: UserStatsData
  }
  errors?: Array<{
    message: string
    type: string
  }>
}

export interface CommitQueryResponse {
  data?: {
    repository?: {
      defaultBranchRef?: {
        target?: {
          history?: {
            totalCount: number
          }
        }
      }
    }
  }
}

export interface UserIdQueryResponse {
  data?: {
    user?: {
      id: string
    }
  }
}

export interface CommitCountResult {
  count: number
  method: string
}

export interface UserStatsResult {
  totalCommits: number
  totalStars: number
  totalPRs: number
  totalIssues: number
  commitMethod: string
  totalRepos: number
  publicRepos: number
  privateRepos: number
}

export interface GraphQLRequestParams {
  query: string
  variables: Record<string, any>
}

export interface ApiResponse<T> {
  data: T
  status: number
  statusText: string
}

export class CustomApiError extends Error {
  static readonly USER_NOT_FOUND = "USER_NOT_FOUND"
  static readonly GRAPHQL_ERROR = "GRAPHQL_ERROR"

  constructor(
    message: string,
    public code: string,
  ) {
    super(message)
    this.name = "CustomApiError"
  }
}

export class MissingParameterError extends Error {
  constructor(parameters: string[]) {
    super(`Missing required parameters: ${parameters.join(", ")}`)
    this.name = "MissingParameterError"
  }
}
