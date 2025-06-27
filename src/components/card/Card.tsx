import { GitHubUser } from '@/types/github';

interface GitHubCardProps {
  userData: GitHubUser | null;
  isAuthenticated?: boolean;
}

export function GitHubCard({ userData, isAuthenticated = false }: GitHubCardProps) {
  // Default values when no user data is provided
  const defaultData = {
    login: 'userName',
    name: 'Name',
    followers: 200,
    public_repos: 500,
    avatar_url: '',
    bio: 'Hey, I am Github user and this is my cool github card',
    company: 'XYZ',
    location: 'Mumbai',
    created_at: '2016-06-24T00:00:00Z',
    public_gists: 0,
    issues: 0 // This would need to be calculated from API
  };

  const data = userData || defaultData;
  
  // Calculate commits (mock data for now - would need additional API calls)
  const commits = userData ? Math.floor(Math.random() * 10000) : 5300;
  const prs = userData ? Math.floor(Math.random() * 1000) : 400;
  const issues = userData ? Math.floor(Math.random() * 100) : 60;

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    });
  };

  const formatNumber = (num: number) => {
    if (num >= 1000) {
      return (num / 1000).toFixed(1) + 'k';
    }
    return num.toString();
  };

  // Get user's top languages (mock data)
  const getTopLanguages = () => {
    if (!userData) {
      return ['#Typescript', '#C++', '#Go', '#Java', '#Python'];
    }
    // In a real app, you'd fetch this from GitHub API
    const languages = ['#JavaScript', '#TypeScript', '#Python', '#Go', '#Rust'];
    return languages.slice(0, 5);
  };

  const topLanguages = getTopLanguages();

  return (
    <div className="bg-white rounded-lg shadow-lg p-6 w-full max-w-md relative">
      {/* Premium Badge for Authenticated Users */}
      {isAuthenticated && (
        <div className="absolute top-2 right-2">
          <span className="bg-yellow-400 text-yellow-900 text-xs font-bold px-2 py-1 rounded-full">
            PREMIUM
          </span>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center space-x-2">
          <svg className="w-6 h-6 text-gray-800" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
          </svg>
          <span className="text-gray-800 font-semibold">Github Card</span>
        </div>
      </div>

      {/* Profile Section */}
      <div className="flex items-start space-x-4 mb-4">
        <div className="w-16 h-16 bg-gray-300 rounded-full flex items-center justify-center overflow-hidden">
          {data.avatar_url ? (
            <img src={data.avatar_url} alt="Profile" className="w-full h-full object-cover" />
          ) : (
            <svg className="w-8 h-8 text-gray-500" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        
        <div className="flex-1">
          <div className="bg-gray-800 text-white px-3 py-1 rounded-lg inline-block">
            <span className="text-sm font-medium">{data.name}</span>
          </div>
          <p className="text-gray-600 text-sm mt-1">@{data.login}</p>
          <div className="flex items-center space-x-4 mt-2 text-sm text-gray-700">
            <span>{data.followers} Followers</span>
            <span className="flex items-center">
              <svg className="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {data.public_repos} ★
            </span>
          </div>
        </div>
      </div>

      {/* Bio */}
      <p className="text-gray-700 text-sm mb-4">{data.bio}</p>
      
      {/* Organization */}
      <p className="text-gray-700 text-sm mb-4">
        Organization : <span className="font-medium">{data.company || 'XYZ'}</span>
      </p>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4 mb-4">
        <div className="text-center">
          <div className="text-lg font-bold text-gray-800">{formatNumber(commits)}</div>
          <div className="text-xs text-gray-600">Commit</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-800">{data.public_repos}</div>
          <div className="text-xs text-gray-600">Repos</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-800">{prs}</div>
          <div className="text-xs text-gray-600">PRs</div>
        </div>
        <div className="text-center">
          <div className="text-lg font-bold text-gray-800">{issues}</div>
          <div className="text-xs text-gray-600">Issues</div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex justify-between items-end">
        <div className="text-sm text-gray-600">
          <p>Joined : {formatDate(data.created_at)}</p>
          <p>Location : {data.location}</p>
          <div className="text-xs mt-1 space-y-1">
            <div>
              {topLanguages.slice(0, 3).map((lang, index) => (
                <span
                  key={index}
                  className={`mr-2 ${
                    lang.includes('TypeScript') || lang.includes('Typescript') ? 'text-blue-600' :
                    lang.includes('C++') ? 'text-yellow-600' :
                    lang.includes('Go') ? 'text-blue-800' :
                    lang.includes('JavaScript') ? 'text-yellow-500' :
                    lang.includes('Python') ? 'text-blue-500' :
                    'text-gray-600'
                  }`}
                >
                  {lang}
                </span>
              ))}
            </div>
            <div>
              {topLanguages.slice(3).map((lang, index) => (
                <span
                  key={index}
                  className={`mr-2 ${
                    lang.includes('Java') ? 'text-orange-600' :
                    lang.includes('Rust') ? 'text-red-600' :
                    'text-gray-600'
                  }`}
                >
                  {lang}
                </span>
              ))}
            </div>
          </div>
        </div>
        
        {/* GitHub contribution pattern */}
        <div className="grid grid-cols-4 gap-1">
          {Array.from({ length: 16 }, (_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-sm ${
                isAuthenticated ? (
                  i % 2 === 0 ? 'bg-green-600' : 
                  i % 3 === 0 ? 'bg-green-400' : 
                  i % 5 === 0 ? 'bg-green-300' : 'bg-gray-200'
                ) : (
                  i % 3 === 0 ? 'bg-green-500' : 
                  i % 4 === 0 ? 'bg-green-300' : 'bg-gray-200'
                )
              }`}
            />
          ))}
        </div>
      </div>

      {/* Attribution */}
      <div className="text-xs text-gray-400 text-right mt-2">
        Made by : RaviPatel94
      </div>
    </div>
  );
}