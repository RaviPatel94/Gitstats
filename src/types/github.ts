// Basic GitHub user info needed for your card
export interface GitHubUser {
  login: string;              // username
  name: string;
  avatar_url: string;
  bio: string;
  company: string;
  location: string;
  created_at: string;
  public_repos: number;
  followers: number;

  // Extended stats from your API
  totalCommits: number;
  totalStars: number;
  totalPRs: number;
  totalIssues: number;
  topLanguages: string[];

  // Optional API debug info
  _metadata?: {
    authenticated: boolean;
    timestamp: string;
  };
}

// Optional, if you ever display orgs
export interface GitHubOrganization {
  id: number;
  login: string;
  avatar_url: string;
  description: string;
}

// Minimal repo shape — optional, for future repo card or star count
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

// Authenticated user with token if needed
export interface GitHubAuthUser extends GitHubUser {
  access_token?: string;
}

// Auth session if you're using next-auth or similar
export interface AuthSession {
  user: GitHubAuthUser;
  expires: string;
}
