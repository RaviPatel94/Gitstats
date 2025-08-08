'use client';
import { useState, useEffect, useRef } from 'react';
import { GitHubCard } from './Card';
import { GitHubUser } from '@/types/github';
import { useAuth } from '@/hooks/useAuth';
import { toPng } from "html-to-image";

export default function EnhancedHeroPage() {
  const [username, setUsername] = useState('');
  const [userData, setUserData] = useState<GitHubUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const { user: authUser,} = useAuth();
  const cardRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (authUser && !userData && !username) {
      setUserData(authUser);
      setUsername(authUser.login);
    }
  }, [authUser, userData, username]);

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

  const handleDownloadCard = async () => {
    if (!cardRef.current || !userData) return;

    setDownloading(true);
    try {
      const dataUrl = await toPng(cardRef.current, {
        quality: 1.0,
        pixelRatio: 2, // Higher resolution
        backgroundColor: 'transparent',
        filter: () => {
          // Filter out any unwanted elements if needed
          return true;
        }
      });

      // Create download link
      const link = document.createElement('a');
      link.download = `github-card-${userData.login}.png`;
      link.href = dataUrl;
      link.click();
    } catch (error) {
      console.error('Error downloading card:', error);
      setError('Failed to download card. Please try again.');
    } finally {
      setDownloading(false);
    }
  };

  const handleClearSearch = () => {
    setUserData(null);
    setUsername('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white">
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 items-start">
          <div className="space-y-6">
            <h1 className="text-4xl font-bold">
              Create your own Github card!
            </h1>
            <form onSubmit={handleUsernameSubmit} className="space-y-4">
              <label htmlFor="username" className="block text-lg font-medium mb-2">
                Github username :
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  id="username"
                  value={username}
                  onChange={(e) => setUsername(e.target.value)}
                  className="flex-1 px-4 py-3 bg-gray-800 border border-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter GitHub username"
                  disabled={loading}
                />
                {userData && (
                  <button
                    type="button"
                    onClick={handleClearSearch}
                    className="px-4 py-3 cursor-pointer bg-gray-600 hover:bg-gray-700 rounded-lg font-medium transition-colors"
                    title="Clear search"
                  >
                    ✕
                  </button>
                )}
              </div>
              <button
                type="submit"
                disabled={loading || !username.trim()}
                className="w-full cursor-pointer px-6 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors"
              >
                {loading ? 'Loading...' : 'Generate Card'}
              </button>
            </form>

                        {userData && (
              <button
                onClick={handleDownloadCard}
                disabled={downloading}
                className="mt-6 px-6 py-3 bg-green-600 hover:bg-green-700 disabled:bg-gray-600 disabled:cursor-not-allowed rounded-lg font-medium transition-colors flex items-center gap-2"
              >
                {downloading ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    Downloading...
                  </>
                ) : (
                  <>
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                    </svg>
                    Download Card
                  </>
                )}
              </button>
            )}

            {error && (
              <div className="mt-4 p-3 bg-red-900/50 border border-red-500 rounded-lg text-red-200">
                {error}
              </div>
            )}

            {userData && (
              <div className="mt-4 space-y-2">
                {authUser && userData.login === authUser.login ? (
                  <div className="p-3 bg-green-900/50 border border-green-500 rounded-lg text-green-200">
                    ✓ Authenticated with GitHub - showing enhanced data
                  </div>
                ) : (
                  <div className="p-3 bg-blue-900/50 border border-blue-500 rounded-lg text-blue-200">
                    ℹ Showing public GitHub data for @{userData.login}
                  </div>
                )}
              </div>
            )}

            {!userData && (
              <div className="pt-6 border-t border-gray-700">
                <h3 className="text-lg font-medium mb-3">Try these popular profiles:</h3>
                <div className="flex flex-wrap gap-2">
                  {['torvalds', 'gaearon', 'sindresorhus', 'octocat', 'defunkt'].map((popularUser) => (
                    <button
                      key={popularUser}
                      onClick={() => setUsername(popularUser)}
                      className="px-3 py-1 bg-gray-800 hover:bg-gray-700 border border-gray-600 rounded text-sm transition-colors"
                    >
                      {popularUser}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col h-screen justify-center items-center">
            <div ref={cardRef}>
              <GitHubCard userData={userData} />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}