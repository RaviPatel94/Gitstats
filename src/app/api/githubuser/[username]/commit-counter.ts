import type { UserStatsData, CommitCountResult, CommitQueryResponse, UserIdQueryResponse } from "./types"
import { makeGraphQLRequest } from "./graphql"
import { apiLogger } from "./utils"

// Commit counting methods
export const getAllTimeCommitCount = async (
  username: string,
  token: string,
  isAuthenticated: boolean,
  userData: UserStatsData,
): Promise<CommitCountResult> => {
  const repositories = userData.repositories.nodes.filter((repo) => !repo.isFork && !repo.isArchived)

  let totalCommits = 0
  let successfulRepos = 0
  let failedRepos = 0

  // Method 1: Try to get commit counts from each repository
  try {
    const commitPromises = repositories.map(async (repo) => {
      try {
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

        const userQuery = `
          query getUser($login: String!) {
            user(login: $login) {
              id
            }
          }
        `

        const userIdResponse = await makeGraphQLRequest(
          { query: userQuery, variables: { login: username } },
          { Authorization: `bearer ${token}` },
        )

        const userIdData = userIdResponse.data as UserIdQueryResponse

        if (!userIdData?.data?.user?.id) {
          throw new Error("Could not get user ID")
        }

        const userId = userIdData.data.user.id

        const commitResponse = await makeGraphQLRequest(
          {
            query: commitsQuery,
            variables: {
              owner: username,
              name: repo.name,
              authorId: userId,
            },
          },
          { Authorization: `bearer ${token}` },
        )

        const commitData = commitResponse.data as CommitQueryResponse

        if (commitData?.data?.repository?.defaultBranchRef?.target?.history?.totalCount) {
          const repoCommits = commitData.data.repository.defaultBranchRef.target.history.totalCount
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
        method: `repository-history-${isAuthenticated ? "authenticated" : "public"}-${successfulRepos}of${repositories.length}repos`,
      }
    }
  } catch (error) {
    apiLogger.error("Repository-based commit counting failed:", error)
  }

  // Method 2: Fallback to contribution timeline
  try {
    const contributionQuery = `
      query getContributionTimeline($login: String!) {
        user(login: $login) {
          contributionsCollection {
            totalCommitContributions
          }
          ${Array.from({ length: 10 }, (_, i) => {
            const year = new Date().getFullYear() - i
            return `
              contributions${year}: contributionsCollection(
                from: "${year}-01-01T00:00:00Z"
                to: "${year}-12-31T23:59:59Z"
              ) {
                totalCommitContributions
              }
            `
          }).join("")}
        }
      }
    `

    const timelineResponse = await makeGraphQLRequest(
      { query: contributionQuery, variables: { login: username } },
      { Authorization: `bearer ${token}` },
    )

    if (timelineResponse.data?.data?.user) {
      const user = timelineResponse.data.data.user
      let historicalCommits = 0

      for (let i = 0; i < 10; i++) {
        const year = new Date().getFullYear() - i
        const yearData = user[`contributions${year}`]
        if (yearData?.totalCommitContributions) {
          historicalCommits += yearData.totalCommitContributions
        }
      }

      const estimatedInitialCommits = repositories.length

      return {
        count: historicalCommits + estimatedInitialCommits,
        method: `contribution-timeline-${isAuthenticated ? "authenticated" : "public"}-10years+${estimatedInitialCommits}initial`,
      }
    }
  } catch (error) {
    apiLogger.error("Contribution timeline method failed:", error)
  }

  // Method 3: Final fallback
  const currentYearCommits = userData.contributionsCollection.totalCommitContributions
  const estimatedHistoricalMultiplier = 3
  const estimatedInitialCommits = repositories.length

  return {
    count: Math.round(currentYearCommits * estimatedHistoricalMultiplier) + estimatedInitialCommits,
    method: `estimated-fallback-${isAuthenticated ? "authenticated" : "public"}-${currentYearCommits}*${estimatedHistoricalMultiplier}+${estimatedInitialCommits}initial`,
  }
}

export const getComprehensiveCommitCount = async (
  username: string,
  token: string,
  isAuthenticated: boolean,
  userData: UserStatsData,
): Promise<CommitCountResult> => {
  apiLogger.log("Starting comprehensive commit count calculation...")

  const result = await getAllTimeCommitCount(username, token, isAuthenticated, userData)

  apiLogger.log(`Comprehensive commit count: ${result.count} commits (method: ${result.method})`)

  return result
}
