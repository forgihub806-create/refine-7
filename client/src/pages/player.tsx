import { useSearchParams } from "wouter";
import { VideoPlayer } from "@/components/video-player";

export default function PlayerPage() {
  const [searchParams] = useSearchParams();
  const videoUrl = searchParams.get('url');
  const title = searchParams.get('title') || 'Video Player';

  if (!videoUrl) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-50 p-8 flex items-center justify-center">
        <p className="text-red-400">No video URL provided.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black">
      <VideoPlayer url={videoUrl} title={title} onClose={() => window.history.back()} />
    </div>
  );
}
