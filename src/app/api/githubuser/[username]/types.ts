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
  _metadata: {
    timestamp: string;
    commitCalculationMethod: string;
    dataScope: string;
  };
}

export interface GitHubRepo {
  id: number;
  name: string;
  html_url: string;
  description: string | null;
  stargazers_count: number;
  language: string | null;
  forks_count: number;
  created_at: string;
  updated_at: string;
}

export interface LanguageNodeData {
  name: string;
  color: string;
}

export interface LanguageEdgeData {
  size: number;
  node: LanguageNodeData;
}

export interface RepositoryData {
  isEmpty?: boolean;
  updatedAt?: string | number | Date;
  name: string;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  isTemplate?: boolean;
  isDisabled?: boolean;
  stargazers: {
    totalCount: number;
  };
  languages: {
    edges: LanguageEdgeData[];
  };
  defaultBranchRef?: {
    name: string;
    target?: {
      oid: string;
    };
  };
}

export interface UserStatsData {
  createdAt: string;
  id: string;
  name?: string;
  login: string;
  repositoriesContributedTo?: unknown;
  contributionsCollection: {
    totalCommitContributions: number;
    totalRepositoryContributions?: number;
    totalPullRequestContributions?: number;
    totalPullRequestReviewContributions?: number;
    totalIssueContributions?: number;
    restrictedContributionsCount?: number;
  };
  pullRequests: {
    totalCount: number;
  };
  openIssues: {
    totalCount: number;
  };
  closedIssues: {
    totalCount: number;
  };
  repositories: {
    totalCount: number;
    nodes: RepositoryData[];
  };
}

export interface GraphQLResponse {
  data?: {
    user?: UserStatsData;
    repository?: {
      defaultBranchRef?: {
        target?: {
          history?: {
            totalCount: number;
          };
        };
      };
    };
  };
  errors?: Array<{
    message: string;
    type?: string;
  }>;
}

export interface CommitQueryResponse {
  data?: {
    repository?: {
      defaultBranchRef?: {
        target?: {
          history?: {
            totalCount: number;
          };
        };
      };
    };
  };
  errors?: Array<{
    message: string;
    type?: string;
  }>;
}

export interface UserIdQueryResponse {
  data?: {
    user?: {
      id: string;
    };
  };
  errors?: Array<{
    message: string;
    type?: string;
  }>;
}

export interface CommitCountResult {
  count: number;
  method: string;
}

export interface UserStatsResult {
  totalCommits: number;
  totalStars: number;
  totalPRs: number;
  totalIssues: number;
  commitMethod: string;
  totalRepos: number;
  publicRepos: number;
  privateRepos: number;
}

export interface GraphQLRequestParams {
  query: string;
  variables: Record<string, unknown>;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
}

export class CustomApiError extends Error {
  static readonly USER_NOT_FOUND = 'USER_NOT_FOUND';
  static readonly GRAPHQL_ERROR = 'GRAPHQL_ERROR';
  static readonly GITHUB_REST_API_ERROR = 'GITHUB_REST_API_ERROR';
  
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'CustomApiError';
  }
}

export class MissingParameterError extends Error {
  constructor(parameters: string[]) {
    super(`Missing required parameters: ${parameters.join(", ")}`);
    this.name = "MissingParameterError";
  }
}
