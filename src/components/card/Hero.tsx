'use client';
import { useState, useEffect, useRef } from 'react';
import { GitHubCard } from './Card';
import { GitHubUser } from '@/types/github';
import { useAuth } from '@/hooks/useAuth';
import { toPng } from "html-to-image";
import { supabase } from "@/lib/supabaseClient";

export default function EnhancedHeroPage() {
  const [username, setUsername] = useState('');
  const [userData, setUserData] = useState<GitHubUser | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [downloading, setDownloading] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const [shareImage, setShareImage] = useState<string | null>(null);

  const { user: authUser } = useAuth();
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

      const { error: dbError } = await supabase
        .from("github_users")
        .insert([{ username }]);

      // Ignore duplicate username error
      if (dbError && dbError.code !== "23505") {
        console.error("Supabase insert error:", dbError);
      }

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
        pixelRatio: 2,
        backgroundColor: 'transparent',
        filter: () => true
      });

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

  const handleShareCard = async () => {
    if (!cardRef.current || !userData) return;
    
    try {
      const dataUrl = await toPng(cardRef.current, { 
        pixelRatio: 2,
        backgroundColor: 'transparent'
      });
      
      // Convert data URL to blob
      const response = await fetch(dataUrl);
      const blob = await response.blob();
      
      const file = new File([blob], `github-card-${userData.login}.png`, {
        type: 'image/png'
      });

      // Check if Web Share API is supported and can share files
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
        try {
          await navigator.share({
            title: `GitHub Card - ${userData.login}`,
            text: `Check out ${userData.login}'s GitHub profile card!`,
            files: [file]
          });
          return; // Successfully shared, exit function
        } catch (shareError) {
          console.log('Native share failed, falling back to modal:', shareError);
        }
      }

      // Fallback to modal if Web Share API is not supported or failed
      setShareImage(dataUrl);
      setShareOpen(true);
    } catch (error) {
      console.error('Error generating share image:', error);
      setError('Failed to generate share image. Please try again.');
    }
  };

  const handleClearSearch = () => {
    setUserData(null);
    setUsername('');
    setError('');
  };

  return (
    <div className="min-h-screen bg-gray-900 text-white flex flex-col">
      <div className="container mx-auto px-4 py-8 flex-1">
        <div className="flex flex-col lg:flex-row gap-8 items-center justify-around">
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
              <>
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

                <button
                  onClick={handleShareCard}
                  className="mt-3 px-6 py-3 bg-purple-600 hover:bg-purple-700 rounded-lg font-medium transition-colors flex items-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 12v.01M12 20v.01M20 12v.01M12 4v.01M12 16v-8m4 4H8" />
                  </svg>
                  Share Card
                </button>
              </>
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

          <div className="flex flex-col h-screen scale-75 sm:scale-100 justify-center items-center">
            <div ref={cardRef}>
              <GitHubCard userData={userData} />
            </div>
          </div>
        </div>
      </div>

      {/* Share Modal */}
      {shareOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gray-800 p-6 rounded-2xl w-80 space-y-4 text-center">
            <h2 className="text-lg font-bold">Share this card</h2>

            {shareImage && (
              <img src={shareImage} alt="Preview" className="rounded-lg border border-gray-600 mx-auto" />
            )}

            <button
              onClick={async () => {
                if (shareImage) {
                  const response = await fetch(shareImage);
                  const blob = await response.blob();
                  const file = new File([blob], `github-card-${userData?.login}.png`, {
                    type: 'image/png'
                  });
                  
                  // Try native share first
                  if (navigator.share && navigator.canShare && navigator.canShare({ files: [file] })) {
                    try {
                      await navigator.share({
                        title: `GitHub Card - ${userData?.login}`,
                        text: `Check out ${userData?.login}'s GitHub profile card!`,
                        files: [file]
                      });
                      setShareOpen(false);
                      return;
                    } catch (err) {
                      console.log('Native share failed');
                    }
                  }
                  
                  const link = document.createElement('a');
                  link.download = `github-card-${userData?.login}.png`;
                  link.href = shareImage;
                  link.click();
                }
              }}
              className="w-full px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg mb-3"
            >
              Share Image
            </button>

            <div className="grid grid-cols-2 gap-3 mt-4">
              <a
                href={`https://api.whatsapp.com/send?text=${encodeURIComponent(
                  "Check out my GitHub card and create your own at https://gityou.vercel.app/"
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-green-600 hover:bg-green-700 rounded-lg"
              >
                WhatsApp
              </a>

              <a
                href={`https://twitter.com/intent/tweet?text=${encodeURIComponent(
                  "Check out my GitHub card and create your own at https://gityou.vercel.app/"
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-blue-500 hover:bg-blue-600 rounded-lg"
              >
                Twitter
              </a>

              <a
                href={`https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(
                  "https://gityou.vercel.app/"
                )}&title=${encodeURIComponent(
                  "Check out my GitHub card and create your own!"
                )}&summary=${encodeURIComponent(
                  "Check out my GitHub card and create your own at https://gityou.vercel.app/"
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-blue-700 hover:bg-blue-800 rounded-lg"
              >
                LinkedIn
              </a>

              <a
                href={`https://t.me/share/url?url=${encodeURIComponent(
                  "https://gityou.vercel.app/"
                )}&text=${encodeURIComponent(
                  "Check out my GitHub card and create your own at https://gityou.vercel.app/"
                )}`}
                target="_blank"
                rel="noopener noreferrer"
                className="px-3 py-2 bg-sky-500 hover:bg-sky-600 rounded-lg"
              >
                Telegram
              </a>
            </div>

            <button
              onClick={() => {
                navigator.clipboard.writeText(window.location.href);
                alert("Link copied!");
              }}
              className="w-full mt-3 px-3 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg"
            >
              Copy Link
            </button>

            <button
              onClick={() => setShareOpen(false)}
              className="mt-4 w-full px-4 py-2 bg-red-600 hover:bg-red-700 rounded-lg"
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Footer */}
      <footer className="bg-gray-800 py-4 text-center text-gray-400 text-sm border-t border-gray-700">
        Made by{' '}
        <a
          href="https://github.com/ravipatel94"
          target="_blank"
          rel="noopener noreferrer"
          className="text-blue-400 hover:underline"
        >
          ravipatel94
        </a>
      </footer>
    </div>
  );
}