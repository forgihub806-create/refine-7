import { useSearch } from "wouter";
import { VideoPlayer } from "@/components/video-player";

export default function PlayerPage() {
  const search = useSearch();
  const params = new URLSearchParams(search);
  const videoUrl = params.get('url');
  const title = params.get('title') || 'Video Player';

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
