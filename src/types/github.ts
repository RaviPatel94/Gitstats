// Public API Types - these are exposed to your application
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

export interface GitHubOrganization {
  id: number;
  login: string;
  avatar_url: string;
  description: string;
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

export interface GitHubAuthUser extends GitHubUser {
  access_token?: string;
}

export interface AuthSession {
  user: GitHubAuthUser;
  expires: string;
}

// Internal API Types - used within your API route
export interface AuthenticatedUserData {
  access_token: string;
  login: string;
  token_scopes: string[];
  can_access_private_repos: boolean;
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
  name: string;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  languages: {
    edges: LanguageEdgeData[];
  };
  stargazers: {
    totalCount: number;
  };
}

export interface UserStatsData {
  repositoriesContributedTo: any;
  id: string;
  name: string;
  login: string;
  contributionsCollection: {
    totalCommitContributions: number;
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
    nodes: RepositoryData[];
    totalCount: number;
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
  errors?: Array<{ message: string; type?: string }>;
}

// Specific response type for commit queries
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
  errors?: Array<{ message: string; type?: string }>;
}

// Specific response type for user ID queries
export interface UserIdQueryResponse {
  data?: {
    user?: {
      id: string;
    };
  };
  errors?: Array<{ message: string; type?: string }>;
}

// Error Types
export class CustomApiError extends Error {
  static USER_NOT_FOUND = 'USER_NOT_FOUND';
  static GRAPHQL_ERROR = 'GRAPHQL_ERROR';
  static GITHUB_REST_API_ERROR = 'GITHUB_REST_API_ERROR';
  
  constructor(message: string, public code?: string) {
    super(message);
    this.name = 'CustomApiError';
  }
}

export class MissingParameterError extends Error {
  constructor(params: string[]) {
    super(`Missing required parameters: ${params.join(', ')}`);
    this.name = 'MissingParameterError';
  }
}

// Utility Types
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
  variables: Record<string, string>;
}

export interface ApiResponse<T> {
  data: T;
  status: number;
  statusText: string;
}