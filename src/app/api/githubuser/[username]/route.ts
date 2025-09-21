import { type NextRequest, NextResponse } from "next/server";
import type { GitHubUser } from "./types";
import { getCompleteUserData } from "./graphql";
import { getUserStats, getUserTopLanguages } from "./data-featcher";
import { apiLogger } from "./utils";

interface ErrorWithCode extends Error {
  code?: string;
}

export async function GET(
  request: NextRequest,
  context: { params: Promise<{ username: string }> },
): Promise<NextResponse> {
  const startTime = Date.now();

  try {
    const { username } = await context.params;
    
    const githubToken = process.env.GITHUB_TOKEN;

    if (!githubToken) {
      throw new Error("No GitHub token available");
    }

    const requestUrl = new URL(request.url);
    const repositoriesToExclude =
      requestUrl.searchParams.get("exclude_repo")?.split(",").filter(Boolean) || [];

    const [userApiResponse, userStatsData] = await Promise.all([
      fetch(`https://api.github.com/users/${username}`, {
        headers: {
          Accept: "application/vnd.github.v3+json",
          "User-Agent": "GitHub-Card-Generator",
          Authorization: `token ${githubToken}`,
        },
      }),
      getUserStats(username, githubToken, repositoriesToExclude),
    ]);

    if (!userApiResponse.ok) {
      throw new Error(`User not found: ${userApiResponse.status}`);
    }

    const basicUserData = await userApiResponse.json();

    const completeDataResponse = await getCompleteUserData(username, githubToken);
    const completeUserData = completeDataResponse.data.data?.user;

    if (!completeUserData) {
      throw new Error("Failed to fetch complete user data");
    }

    const topLanguagesData = await getUserTopLanguages(
      completeUserData,
      repositoriesToExclude,
    );
    
    const processingTime = Date.now() - startTime;
    apiLogger.log(`Total processing time: ${processingTime}ms`);
    apiLogger.log(
      `Repository stats: ${userStatsData.totalRepos} total (${userStatsData.publicRepos} public, ${userStatsData.privateRepos} private)`,
    );

    const responseData: GitHubUser = {
      login: basicUserData.login,
      name: basicUserData.name || basicUserData.login,
      avatar_url: basicUserData.avatar_url,
      bio: basicUserData.bio || "",
      company: basicUserData.company || "",
      location: basicUserData.location || "",
      created_at: basicUserData.created_at,
      public_repos: basicUserData.public_repos,
      followers: basicUserData.followers,
      totalCommits: userStatsData.totalCommits,
      totalStars: userStatsData.totalStars,
      totalPRs: userStatsData.totalPRs,
      totalIssues: userStatsData.totalIssues,
      topLanguages: topLanguagesData,
      _metadata: {
        timestamp: new Date().toISOString(),
        commitCalculationMethod: userStatsData.commitMethod,
        dataScope: "public-only",
      },
    };

    return NextResponse.json(responseData);
  } catch (error: unknown) {
    const processingTime = Date.now() - startTime;
    console.error(`Error fetching GitHub data (${processingTime}ms):`, error);

    let errorMessage = "Failed to fetch GitHub data";
    let statusCode = 500;

    if (error instanceof Error && "code" in error) {
      const customError = error as ErrorWithCode;
      if (customError.code === "USER_NOT_FOUND") {
        errorMessage = "User not found";
        statusCode = 404;
      } else if (customError.code === "GRAPHQL_ERROR") {
        errorMessage = "GraphQL API error";
        statusCode = 500;
      } else {
        errorMessage = customError.message;
      }
    } else if (error instanceof Error) {
      if (error.message?.includes("User not found")) {
        errorMessage = "User not found";
        statusCode = 404;
      } else if (error.message?.includes("rate limit")) {
        errorMessage = "Rate limit exceeded. Please try again later.";
        statusCode = 429;
      } else {
        errorMessage = error.message;
      }
    }

    return NextResponse.json(
      {
        error: errorMessage,
        ...(process.env.NODE_ENV === "development" && {
          debug: { stack: error instanceof Error ? error.stack : String(error) },
        }),
      },
      { status: statusCode },
    );
  }
}
