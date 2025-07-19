import type { UserStatsData, UserStatsResult, RepositoryData, LanguageEdgeData, GraphQLResponse } from "./types.ts"
import { getCompleteUserData } from "./graphql"
import { getAccurateCommitCount } from "./commit-counter"
import { retryApiCall, wrapTextInLines, apiLogger } from "./utils"
import { CustomApiError } from "./errors" // Declare the variables here
import { MissingParameterError } from "@/types/github"

export const getUserStats = async (
  username: string,
  token: string,
  isAuthenticated: boolean,
  excludeRepos: string[] = [],
): Promise<UserStatsResult> => {
  if (!username) {
    throw new MissingParameterError(["username"])
  }

  const apiResponse = await retryApiCall(
    (vars, tkn) => getCompleteUserData(vars.login, tkn, isAuthenticated),
    { login: username },
    token,
  )

  const graphqlResponse = apiResponse.data as GraphQLResponse

  if (graphqlResponse.errors) {
    apiLogger.error("GraphQL errors:", graphqlResponse.errors)
    if (graphqlResponse.errors[0].type === "NOT_FOUND") {
      throw new CustomApiError(
        graphqlResponse.errors[0].message || "Could not fetch user.",
        CustomApiError.USER_NOT_FOUND,
      )
    }
    if (graphqlResponse.errors[0].message) {
      throw new CustomApiError(wrapTextInLines(graphqlResponse.errors[0].message, 90, 1)[0], apiResponse.statusText)
    }
    throw new CustomApiError(
      "Something went wrong while trying to retrieve the stats data using the GraphQL API.",
      CustomApiError.GRAPHQL_ERROR,
    )
  }

  if (!graphqlResponse.data?.user) {
    throw new CustomApiError("User data not found", CustomApiError.USER_NOT_FOUND)
  }

  const userData: UserStatsData = graphqlResponse.data.user

  // Calculate repository stats
  const totalRepos = userData.repositories.totalCount
  const publicRepos = userData.repositories.nodes.filter((repo) => !repo.isPrivate).length
  const privateRepos = userData.repositories.nodes.filter((repo) => repo.isPrivate).length

  // Calculate total stars excluding hidden repos
  const hiddenRepos = new Set(excludeRepos)
  const totalStars = userData.repositories.nodes
    .filter((repo) => !hiddenRepos.has(repo.name))
    .reduce((total, current) => total + current.stargazers.totalCount, 0)

  const commitsResult = await getAccurateCommitCount(username, token, isAuthenticated, userData)

  return {
    totalCommits: commitsResult.count,
    totalStars,
    totalPRs: userData.pullRequests.totalCount,
    totalIssues: userData.openIssues.totalCount + userData.closedIssues.totalCount,
    commitMethod: commitsResult.method,
    totalRepos,
    publicRepos,
    privateRepos,
  }
}

export const getUserTopLanguages = async (userData: UserStatsData, excludeRepos: string[] = []): Promise<string[]> => {
  let repositoryNodes = userData.repositories.nodes

  const hiddenReposMap: Record<string, boolean> = {}
  if (excludeRepos) {
    excludeRepos.forEach((repoName) => {
      hiddenReposMap[repoName] = true
    })
  }

  repositoryNodes = repositoryNodes
    .filter((repo: RepositoryData) => !hiddenReposMap[repo.name])
    .sort((a: RepositoryData, b: RepositoryData) => b.stargazers.totalCount - a.stargazers.totalCount)

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
          count: 1,
        }
      }
    })
  })

  return Object.values(languageMap)
    .sort((a, b) => b.size - a.size)
    .slice(0, 5)
    .map((lang) => `#${lang.name}`)
}
