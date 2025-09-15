import type { UserStatsData, CommitCountResult } from "./types"
import { makeGraphQLRequest } from "./graphql"
import { apiLogger } from "./utils"

// Commit counting methods
export const getAccurateCommitCount = async (
  username: string,
  token: string,
  isAuthenticated: boolean,
  userData: UserStatsData,
): Promise<CommitCountResult> => {

  try {
    const createdYear = new Date(userData.createdAt).getFullYear()
    const currentYear = new Date().getFullYear()
    const yearsRange: number[] = []
    for (let y = currentYear; y >= createdYear; y--) {
      yearsRange.push(y)
    }

    console.log("Contribution timeline: Checking years:", yearsRange.join(", "))

    const contributionQuery = `
      query getContributionTimeline($login: String!) {
        user(login: $login) {
          contributionsCollection {
            totalCommitContributions
          }
          ${yearsRange
            .map(
              (year) => `
            contributions${year}: contributionsCollection(
              from: "${year}-01-01T00:00:00Z"
              to: "${year}-12-31T23:59:59Z"
            ) {
              totalCommitContributions
            }
          `
            )
            .join("")}
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

      for (const year of yearsRange) {
        const yearData = user[`contributions${year}`]
        if (yearData?.totalCommitContributions) {
          historicalCommits += yearData.totalCommitContributions
        }
      }

      const totalReposCount = userData.repositories.totalCount; // total repos
      const totalPRs = userData.pullRequests.totalCount; // total PRs
      const totalIssues = userData.openIssues.totalCount + userData.closedIssues.totalCount; // total issues

      const estimatedInitialCommits = 
        1 + 
        totalReposCount + 
        totalPRs + 
        totalIssues;

      console.log(
        `Contribution timeline: historicalCommits = ${historicalCommits}, estimatedInitialCommits = ${estimatedInitialCommits}, total = ${
          historicalCommits + estimatedInitialCommits
        }`
      )
      return {
        count: historicalCommits + estimatedInitialCommits,
        method: `contribution-timeline-${isAuthenticated ? "authenticated" : "public"}-${yearsRange.length}years+${estimatedInitialCommits}initial`,
      }
    } else {
      console.log("Contribution timeline: No user data returned")
      throw new Error("No user data returned from GitHub API")
    }
  } catch (error) {
    apiLogger.error("Contribution timeline method failed:", error)
    throw error
  }
}

export const getComprehensiveCommitCount = async (
  username: string,
  token: string,
  isAuthenticated: boolean,
  userData: UserStatsData,
): Promise<CommitCountResult> => {
  apiLogger.log("Starting comprehensive commit count calculation...")
  const result = await getAccurateCommitCount(username, token, isAuthenticated, userData)
  apiLogger.log(`Comprehensive commit count: ${result.count} commits (method: ${result.method})`)
  return result
}
