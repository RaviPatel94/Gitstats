import { GitHubUser } from '@/types/github'
import Image from 'next/image'
import QRCode from "react-qr-code";

interface GitHubCardProps {
  userData: GitHubUser | null
  // isAuthenticated?: boolean
}

export function GitHubCard({ userData}: GitHubCardProps) {
  const defaultData = {
    login: 'userName',
    name: 'Full Name',
    followers: 2400,
    public_repos: 500,
    avatar_url: '',
    bio: 'Hey there, I am a Github user and this is my cool github card',
    company: 'Unemployed',
    location: 'Mumbai',
    created_at: '2016-06-24T00:00:00Z',
    public_gists: 0,
    totalCommits: 5300,
    totalStars: 4200,
    totalPRs: 400,
    totalIssues: 60,
    topLanguages: ['#Typescript', '#C++', '#Go', '#Java', '#Python']
  }

  const data = userData || defaultData

  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric'
    })
  }

  const formatNumber = (num: number) => {
    if (num >= 1000000) return (num / 1000000).toFixed(1) + 'M'
    if (num >= 1000) return (num / 1000).toFixed(1) + 'k'
    return num.toString()
  }

  const topLanguages = data.topLanguages || []

  return (
    <div className="h-[576px] w-[384px] bg-white rounded-xl shadow-lg max-w-md relative">
      {/* Header */}
      <div className="flex items-center bg-[#2B3137] rounded-t-xl h-16 justify-center gap-3 text-2xl mb-4">
        <svg
          className="w-10 h-10 text-white"
          fill="currentColor"
          viewBox="0 0 24 24"
          xmlns="http://www.w3.org/2000/svg"
        >
          <path
            fillRule="evenodd"
            clipRule="evenodd"
            d="M12 0C5.373 0 0 5.373 0 12c0 5.303 
              3.438 9.8 8.207 11.387.6.113.793-.26.793-.577 
              0-.285-.01-1.04-.015-2.04-3.338.724-4.042-1.61-4.042-1.61
              -.546-1.387-1.333-1.757-1.333-1.757-1.09-.745.084-.729.084-.729 
              1.205.085 1.84 1.236 1.84 1.236 1.07 1.834 2.809 1.304 
              3.495.997.108-.775.418-1.305.762-1.605-2.665-.305-5.467-1.334-5.467-5.93 
              0-1.31.468-2.381 1.235-3.221-.123-.303-.535-1.524.117-3.176 
              0 0 1.008-.322 3.301 1.23a11.5 11.5 0 013.003-.403c1.02.005 
              2.045.138 3.003.403 2.291-1.552 3.297-1.23 3.297-1.23 
              .653 1.653.241 2.874.118 3.176.77.84 1.233 1.911 
              1.233 3.221 0 4.609-2.807 5.624-5.48 5.921.43.371.823 
              1.103.823 2.222 0 1.606-.014 2.898-.014 3.293 
              0 .319.192.694.801.576C20.565 21.796 24 17.298 24 12 
              24 5.373 18.627 0 12 0z"
          />
        </svg>

        <span className="text-white text-2xl font-semibold">Github Card</span>
      </div>

      <div className="px-8 pt-4 flex flex-col justify-between h-[461px]">
        {/* Profile */}
        <div className="flex items-start gap-6 h-32 mb-6">
          <div className="min-w-32 h-32 bg-neutral-400 rounded-xl flex items-center justify-center overflow-hidden">
            {data.avatar_url ? (
              <Image
                src={data.avatar_url}
                alt="Profile"
                className="w-[128px] h-[128px] object-contain"
                width={500}
                height={500}
              />
            ) : (
              <svg className="w-28 h-28 text-white" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M10 9a3 3 0..." clipRule="evenodd" />
              </svg>
            )}
          </div>

          <div className="flex flex-col justify-between h-full">
            <div>
              <div className="bg-[#2B3137] text-white px-3 py-1.5 rounded-lg text-[27px] leading-none font-medium">{data.name}</div>
              <p className="text-gray-700 text-[17px]">@{data.login}</p>
            </div>
            <div className="flex flex-wrap gap-2 mt-2 text-[14px] text-black">
              <span className='flex items-center gap-1 text-[16px]'><span className=" font-medium">{formatNumber(data.followers)}</span> Followers </span>
              <span className="flex text-[16px] items-center font-medium">
                {formatNumber(data.totalStars)}
                <svg className="w-4 h-4 ml-[2px" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                  <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.286 3.957a1 1 0 00.95.69h4.164c.969 0 1.371 1.24.588 1.81l-3.37 2.448a1 1 0 00-.364 1.118l1.286 3.957c.3.921-.755 1.688-1.54 1.118l-3.37-2.448a1 1 0 00-1.175 0l-3.37 2.448c-.784.57-1.838-.197-1.539-1.118l1.285-3.957a1 1 0 00-.364-1.118L2.07 9.384c-.783-.57-.38-1.81.588-1.81h4.165a1 1 0 00.95-.69l1.286-3.957z" />
                </svg>

              </span>
            </div>
          </div>
        </div>

        {/* Bio */}
        <div>
          <p className="text-black text-[18px] bio-text leading-[22px] font-normal max-h-[68px] mb-2">{data.bio}</p>
          <p className="text-black text-[18px] mb-4">Company: <span className="font-medium">{data.company || 'Unemployed'}</span></p>
        </div>

        {/* Stats */}
        <div className="flex items-center justify-between gap-4 mb-6">
          <div>
            <div className="text-xl font-medium text-gray-800">{formatNumber(data.totalCommits || 0)}</div>
            <div className="text-[16px] -mt-1 text-black">Commits</div>
          </div>
          <div>
            <div className="text-xl font-medium text-gray-800">{formatNumber(data.public_repos)}</div>
            <div className="text-[16px] -mt-1 text-black">Repos</div>
          </div>
          <div>
            <div className="text-xl font-medium text-gray-800">{data.totalPRs}</div>
            <div className="text-[16px] -mt-1 text-black">PR</div>
          </div>
          <div>
            <div className="text-xl font-medium text-gray-800">{data.totalIssues}</div>
            <div className="text-[16px] -mt-1 text-black">Issues</div>
          </div>
        </div>

        {/* Footer Info */}
        <div className="flex justify-between items-start text-black">
          <div className="text-[18px]">
            <p>Joined: <span className="font-medium">{formatDate(data.created_at)}</span></p>
            <p>Location: <span className="font-medium">{data.location || "Unknown"}</span></p>
            <div className="text-[14px] mt-1 max-w-[220px] flex flex-wrap font-medium">
              {topLanguages.slice(0, 5).map((lang, i) => (
                <span key={i} className="mr-2 mb-1">{lang}</span>
              ))}
            </div>
          </div>
          {/* <Image
            src="/assets/watermark-template-1.svg"
            alt="Watermark"
            className="w-[100px] h-[100px] object-cover"
            width={500}
            height={500}
          /> */}
          <QRCode value={`https://github.com/${data.login}`} className='w-[100px] h-[100px]' />
        </div>

        <div className="text-xs text-center text-gray-400 mt-1">gityou.vercel.app</div>
      </div>
    </div>
  )
}
