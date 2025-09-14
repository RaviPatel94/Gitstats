import type { GraphQLRequestParams, ApiResponse } from "./types.ts"

interface GitHubLanguageEdge {
  size: number
  node: {
    color: string
    name: string
  }
}

interface GitHubRepository {
  name: string
  isPrivate: boolean
  isFork: boolean
  isArchived: boolean
  stargazers: {
    totalCount: number
  }
  languages: {
    edges: GitHubLanguageEdge[]
  }
}

interface GitHubUser {
  id: string
  name: string | null
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
    totalCount: number
    nodes: GitHubRepository[]
  }
}

interface GitHubGraphQLResponse {
   // eslint-disable-next-line @typescript-eslint/no-explicit-any
  data: any
  user: GitHubUser | null
  errors?: Array<{
    message: string
    type: string
    path?: string[]
  }>
}

// GraphQL request function with proper typing
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
  })

  return {
    data: await response.json() as GitHubGraphQLResponse,
    status: response.status,
    statusText: response.statusText,
  }
}

// GraphQL Query Generator
export const getCompleteUserDataQuery = (isAuthenticated: boolean): string => `
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
        ${isAuthenticated ? "" : "privacy: PUBLIC"}
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

// Data fetching functions with proper return type
export const getCompleteUserData = async (
  username: string,
  token: string,
  isAuthenticated: boolean,
): Promise<ApiResponse<GitHubGraphQLResponse>> => {
  const query = getCompleteUserDataQuery(isAuthenticated)
  return makeGraphQLRequest(
    { query, variables: { login: username } }, 
    { Authorization: `bearer ${token}` }
  )
}