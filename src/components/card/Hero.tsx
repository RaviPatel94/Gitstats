'use client';

import { useState, useEffect } from 'react';
import { GitHubCard } from './Card';
import { GitHubUser } from '@/types/github';
import { useAuth } from '@/hooks/useAuth';

export default function EnhancedHeroPage() {
  const [username, setUsername] = useState('');
  const [userData, setUserData] = useState<GitHubUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const { user: authUser, loading: authLoading, signInWithGitHub, signOut } = useAuth();

  // If user is authenticated, use their data by default
  useEffect(() => {
    if (authUser && !userData) {
      setUserData(authUser);
      setUsername(authUser.login);
    }
  }, [authUser, userData]);

const handleUsernameSubmit = async (e: React.FormEvent) => {
  e.preventDefault();
  if (!username.trim()) return;

  setLoading(true);
  setError('');

  try {
    const response = await fetch(`/api/githubuser/${username}`);
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(errorData.error || `HTTP ${response.status}: ${response.statusText}`);
    }
    
    const data = await response.json();
    setUserData(data);
  } catch (err) {
    console.error('Fetch error:', err);
    setError(err instanceof Error ? err.message : 'Failed to fetch user data');
    setUserData(null);
  } finally {
    setLoading(false);
  }
};

  const handleSignOut = async () => {
    await signOut();
    setUserData(null);
    setUsername('');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        {/* Header with Auth Status */}
        {!authLoading && (
          <div className="flex justify-between items-center mb-8">
            <h1 className="text-4xl font-bold">
              Create your own Github card!
            </h1>
            {authUser && (
              <div className="flex items-center space-x-4">
                <span className="text-sm text-gray-300">
                  Welcome, {authUser.name || authUser.login}!
                </span>
                <button
                  onClick={handleSignOut}
                  className="px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg text-sm font-medium transition-colors"
                >
                  Sign Out
                </button>
              </div>
            )}
          </div>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          {/* Left Side - Input Form */}
          <div className="space-y-6">
            <div>
              <form onSubmit={handleUsernameSubmit} className="space-y-4">
                <div>
                  <label htmlFor="username" className="block text-lg font-medium mb-2">
                    Github username :
                  </label>
                  <input
                    type="text"
                    id="username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    className="w-full px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter GitHub username"
                    disabled={loading}
                  />
                </div>
                
                <button
                  type="submit"
                  disabled={loading || !username.trim()}
                  className="w-full px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
                >
                  {loading ? 'Loading...' : 'Generate Card'}
                </button>
              </form>

              {error && (
                <div className="mt-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
                  {error}
                </div>
              )}

              {authUser && (
                <div className="mt-4 p-3 bg-green-900/50 border border-green-500 rounded-lg text-green-200">
                  ✓ Authenticated with GitHub - showing enhanced data
                </div>
              )}
            </div>

            {/* GitHub Auth Section */}
            {!authUser && (
              <div className="pt-6 border-t border-gray-700">
                <p className="text-gray-300 mb-4">
                  Want to include private activity?
                </p>
                <button
                  onClick={signInWithGitHub}
                  disabled={authLoading}
                  className="inline-flex items-center px-6 py-3 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded-lg font-medium transition-colors disabled:opacity-50"
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20">
                    <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
                  </svg>
                  {authLoading ? 'Loading...' : 'Signup'}
                </button>
              </div>
            )}

            {/* Enhanced Features for Authenticated Users */}
            {authUser && (
              <div className="pt-6 border-t border-gray-700">
                <h3 className="text-lg font-medium mb-3">Enhanced Features</h3>
                <div className="space-y-2 text-sm text-gray-300">
                  <p>✓ Access to private repository data</p>
                  <p>✓ Organization information</p>
                  <p>✓ Detailed contribution stats</p>
                  <p>✓ Real-time activity feed</p>
                </div>
                
                {/* {authUser.organizations && authUser.organizations.length > 0 && (
                  <div className="mt-4">
                    <p className="text-sm font-medium mb-2">Your Organizations:</p>
                    <div className="flex flex-wrap gap-2">
                      {authUser.organizations.slice(0, 5).map((org: any) => (
                        <span
                          key={org.id}
                          className="px-2 py-1 bg-gray-800 rounded text-xs"
                        >
                          {org.login}
                        </span>
                      ))}
                    </div>
                  </div>
                )} */}
              </div>
            )}
          </div>

          {/* Right Side - GitHub Card */}
          <div className="flex h-screen justify-center">
            <GitHubCard userData={userData} isAuthenticated={!!authUser} />
          </div>
        </div>
      </div>
    </div>
  );
}