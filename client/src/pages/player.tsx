import { useSearchParams } from "wouter";
import { VideoPlayer } from "@/components/video-player";

export default function PlayerPage() {
  const [searchParams] = useSearchParams();
  const videoUrl = searchParams.get('url');
  const title = searchParams.get('title') || 'Video Player';

  if (!videoUrl) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Error</h1>
          <p className="text-red-400">No video URL was provided in the link.</p>
          <p className="text-sm text-slate-400 mt-2">Please go back and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <VideoPlayer url={videoUrl} title={title} onClose={() => window.history.back()} />
    </div>
  );
}
