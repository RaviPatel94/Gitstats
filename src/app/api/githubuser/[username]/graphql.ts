import type { GraphQLRequestParams, ApiResponse } from "./types.ts"

// GraphQL request function
export const makeGraphQLRequest = async (
  { query, variables }: GraphQLRequestParams,
  headers: Record<string, string>,
): Promise<ApiResponse<any>> => {
  const response = await fetch("https://api.github.com/graphql", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
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

// GraphQL Query Generator
export const getCompleteUserDataQuery = (isAuthenticated: boolean): string => `
  query userInfo($login: String!) {
    user(login: $login) {
      id
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

// Data fetching functions
export const getCompleteUserData = async (
  username: string,
  token: string,
  isAuthenticated: boolean,
): Promise<ApiResponse<any>> => {
  const query = getCompleteUserDataQuery(isAuthenticated)
  return makeGraphQLRequest({ query, variables: { login: username } }, { Authorization: `bearer ${token}` })
}
