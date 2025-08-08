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
  createdAt: string | number | Date
  id: string
  contributionsCollection: {
    totalCommitContributions: number
    totalRepositoryContributions: number
    totalPullRequestContributions: number
    totalPullRequestReviewContributions: number
    totalIssueContributions: number
    restrictedContributionsCount: number
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
  isEmpty: boolean
  updatedAt: string | number | Date
  name: string
  isPrivate: boolean
  isFork: boolean
  isArchived: boolean
  isTemplate: boolean
  isDisabled: boolean
  stargazers: {
    totalCount: number
  }
  languages: {
    edges: LanguageEdgeData[]
  }
  defaultBranchRef?: {
    name: string
    target?: {
      oid: string
    }
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

// Base commit count result - used for legacy compatibility
export interface CommitCountResult {
  count: number
  method: string
}

// New comprehensive contribution interfaces
export interface ContributionBreakdown {
  directCommits: number              // Direct repository commits
  mergeCommits: number              // PR merge commits
  squashMergeCommits: number        // Squashed PR commits
  revertCommits: number             // Revert commits via GitHub UI
  webInterfaceCommits: number       // Direct file edits on GitHub
  repositoryCreationCommits: number  // Initial commits when creating repos
  coAuthoredCommits: number         // Commits where user is co-author
  importedCommits: number           // Commits from imported repositories
  mirrorCommits: number             // Commits from mirrored repositories
}

// Enhanced commit result with detailed breakdown - EXTENDS CommitCountResult for compatibility
export interface AccurateCommitResult extends CommitCountResult {
  count: number                     // Total commits (same as totalCommits for compatibility)
  totalCommits: number             // Total commits (detailed)
  breakdown: ContributionBreakdown
  method: string
  accuracy: 'high' | 'medium' | 'low'
  dataCompleteness: number
  repositoriesProcessed: number
  repositoriesTotal: number
  branchesAnalyzed: number
  timeRange: {
    from: string
    to: string
  }
}

export interface RepositoryCommitData {
  name: string
  owner: string
  totalCommits: number
  branches: {
    name: string
    commits: number
  }[]
  lastAnalyzed: string
}

export interface BranchCommitQuery {
  repository: {
    name: string
    refs: {
      nodes: {
        name: string
        target: {
          history: {
            totalCount: number
            nodes?: {
              oid: string
              messageHeadline: string
              author: {
                user?: {
                  login: string
                }
                name: string
                email: string
              }
              authoredDate: string
              committedDate: string
              parents: {
                totalCount: number
              }
            }[]
          }
        }
      }[]
    }
  }
}

export interface ContributionTimelineData {
  year: number
  totalCommitContributions: number
  totalRepositoryContributions: number
  totalPullRequestContributions: number
  totalPullRequestReviewContributions: number
  totalIssueContributions: number
  restrictedContributionsCount: number
  weeks: {
    contributionDays: {
      contributionCount: number
      date: string
    }[]
  }[]
}

export interface RateLimitInfo {
  remaining: number
  resetAt: string
  cost: number
  limit: number
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
  contributionBreakdown?: ContributionBreakdown
}

export interface GraphQLRequestParams {
  query: string
  variables: Record<string, unknown>
}

export interface ApiResponse<T> {
  data: T
  status: number
  statusText: string
}


export class CustomApiError extends Error {
  static readonly USER_NOT_FOUND = "USER_NOT_FOUND"
  static readonly GRAPHQL_ERROR = "GRAPHQL_ERROR"
  static readonly RATE_LIMIT_EXCEEDED = "RATE_LIMIT_EXCEEDED"
  static readonly AUTHENTICATION_REQUIRED = "AUTHENTICATION_REQUIRED"
  static readonly REPOSITORY_ACCESS_DENIED = "REPOSITORY_ACCESS_DENIED"

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

// Rate limiting and performance types
export interface ProcessingConfig {
  batchSize: number
  maxRepositories: number
  includeAllBranches: boolean
  includeForks: boolean
  includeArchived: boolean
  timeoutMs: number
  rateLimitBuffer: number
}

export interface ProcessingStats {
  startTime: Date
  endTime?: Date
  repositoriesProcessed: number
  branchesAnalyzed: number
  commitsAnalyzed: number
  apiCallsMade: number
  rateLimitHits: number
  errors: string[]
}
