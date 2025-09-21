import type { GraphQLRequestParams, ApiResponse } from "./types";

interface GitHubLanguageEdge {
  size: number;
  node: {
    color: string;
    name: string;
  };
}

interface GitHubRepository {
  name: string;
  isPrivate: boolean;
  isFork: boolean;
  isArchived: boolean;
  stargazers: {
    totalCount: number;
  };
  languages: {
    edges: GitHubLanguageEdge[];
  };
}

interface GitHubUser {
  id: string;
  name: string | null;
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
    totalCount: number;
    nodes: GitHubRepository[];
  };
}

interface GitHubGraphQLResponse {
  data: any;
  user: GitHubUser | null;
  errors?: Array<{
    message: string;
    type: string;
    path?: string[];
  }>;
}

export const makeGraphQLRequest = async (
  { query, variables }: GraphQLRequestParams,
  headers: Record<string, string>,
): Promise<ApiResponse<GitHubGraphQLResponse>> => {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      ...headers,
    },
    body: JSON.stringify({ query, variables }),
  });

  return {
    data: await response.json() as GitHubGraphQLResponse,
    status: response.status,
    statusText: response.statusText,
  };
};

export const getCompleteUserDataQuery = (): string => `
  query userInfo($login: String!) {
    user(login: $login) {
      id
      name
      login
      createdAt
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
        privacy: PUBLIC
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
`;

export const getCompleteUserData = async (
  username: string,
  token: string,
): Promise<ApiResponse<GitHubGraphQLResponse>> => {
  const query = getCompleteUserDataQuery();
  return makeGraphQLRequest(
    { query, variables: { login: username } }, 
    { Authorization: `bearer ${token}` }
  );
};
