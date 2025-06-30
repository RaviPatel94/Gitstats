import { GitHubUser } from '@/types/github';
import Image from 'next/image';

interface GitHubCardProps {
  userData: GitHubUser | null;
  isAuthenticated?: boolean;
}

export function GitHubCard({ userData, isAuthenticated = false }: GitHubCardProps) {
  // Default values when no user data is provided
  const defaultData = {
    login: 'userName',
    name: 'Full Name',
    followers: 2400,
    public_repos: 500,
    avatar_url: '',
    bio: 'Hey there, I am a GITHUB user and this is my cool github card',
    company: 'Unemployed',
    location: 'Mumbai',
    created_at: '2016-06-24T00:00:00Z',
    public_gists: 0,
    issues: 0
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
    <div className=" h-[576px] w-[384px] bg-white rounded-xl shadow-lg  max-w-md relative">

      {/* Header */}
      <div className="flex items-center bg-[#2B3137] rounded-t-xl h-16 justify-center gap-3 text-2xl mb-4">
          <svg className="w-10 h-10 text-white" fill="currentColor" viewBox="0 0 20 20">
            <path fillRule="evenodd" d="M10 0C4.477 0 0 4.484 0 10.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0110 4.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.203 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.942.359.31.678.921.678 1.856 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0020 10.017C20 4.484 15.522 0 10 0z" clipRule="evenodd" />
          </svg>
          <span className="text-white text-2xl font-semibold">Github Card</span>
      </div>

      <div className='px-8 pt-4 flex flex-col justify-between h-max'>
      {/* Profile Section */}
      <div className="flex items-start gap-6 h-32 mb-8">
        <div className="w-32 h-32 mr-0 whitespace-nowrap bg-neutral-400 rounded-xl flex items-center justify-center overflow-hidden">
          {data.avatar_url ? (
            <Image
            src = {data.avatar_url} 
            alt="Profile" 
            className=" w-[128px] h-[128px] object-cover"
            width={"500"}
            height={"500"}
            />
          ) : (
            <svg className="w-28 h-28 text-white" fill="currentColor" viewBox="0 0 20 20">
              <path fillRule="evenodd" d="M10 9a3 3 0 100-6 3 3 0 000 6zm-7 9a7 7 0 1114 0H3z" clipRule="evenodd" />
            </svg>
          )}
        </div>
        
        <div className=" h-full flex flex-col items-start justify-between">
          <div>
          <div className="bg-[#2B3137] text-white px-3 pt-[4px] pb-[3px] rounded-lg ">
            <span className="text-[26px] leading-none   font-medium">{data.name}</span>
          </div>
          <p className="text-black font-normal text-[17px] mt-[2px]">@{data.login}</p>
          </div>
          <div className="flex items-center justify-between w-full gap-3 mt-2 text-[14px] text-black">
            <span className='text-[16px]'> <span className='font-medium text-[16px] '>
              {data.followers > 999999
                ? (data.followers / 1000000).toFixed(1).replace(/\.0$/, '') + 'M'
                : data.followers > 999
                ? (data.followers / 1000).toFixed(1).replace(/\.0$/, '') + 'K'
                : data.followers}
            </span > Followers</span>
            <span className=" flex items-center ">
              <span className='font-medium text-[16px]'> {data.public_repos}</span>
              <svg className="w-4 h-4 " fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </span>
          </div>
        </div>
      </div>

      {/* Bio */}
      <div className='mb-2'>
      <p className="text-black text-[16px] font-normal mb-2">{data.bio}</p>
      <p className="text-black text-[16px] mb-4">
        Company : <span className="font-semibold">{data.company || 'XYZ'}</span>
      </p>
      </div>

      {/* Stats */}
      <div className="flex items-center justify-between gap-4 mb-6">
        <div >
          <div className="text-lg font-bold text-gray-800">{formatNumber(commits)}</div>
          <div className="text-[14px] text-black">Commit</div>
        </div>
        <div >
          <div className="text-lg font-bold text-gray-800">{data.public_repos}</div>
          <div className="text-[14px] text-black">Repos</div>
        </div>
        <div >
          <div className="text-lg font-bold text-gray-800">{prs}</div>
          <div className="text-[14px] text-black">PRs</div>
        </div>
        <div >
          <div className="text-lg font-bold text-gray-800">{issues}</div>
          <div className="text-[14px] text-black">Issues</div>
        </div>
      </div>

      {/* Footer Info */}
      <div className="flex text-black justify-between items-end">
        <div className="text-[16px] ">
          <p> Joined : <span className='font-medium'>{formatDate(data.created_at)}</span> </p>
          <p>Location : <span className='font-medium'>{data.location}</span></p>
          <div className="text-[14px] mt-1 space-y-1">
            <div>
              {topLanguages.slice(0, 3).map((lang, index) => (
                <span
                  key={index}
                  className={`mr-2 `}
                >
                  {lang}
                </span>
              ))}
            </div>
            <div>
              {topLanguages.slice(3).map((lang, index) => (
                <span
                  key={index}
                  className={`mr-2 `}
                >
                  {lang}
                </span>
              ))}
            </div>
          </div>
        </div>
        
        {/* GitHub contribution pattern */}
        <div >
          <Image
            src = "/assets/watermark-template-1.svg" 
            alt="Profile" 
            className=" w-[100px] h-[100px] object-cover"
            width={"500"}
            height={"500"}
          />
        </div>
      </div>

      {/* Attribution */}
      <div className="text-xs text-center text-gray-400 ">
        Made by : RaviPatel94
      </div>
      </div>


    </div>
  );
}