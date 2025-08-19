import { useLocation } from "wouter";
import { VideoPlayer } from "@/components/video-player";

export default function PlayerPage() {
  const [location] = useLocation();
  // location is a string like "/player?url=...&title=..." or "#/player?url=...&title=..."
  const queryString = location.includes('?') ? location.split('?')[1] : '';
  const params = new URLSearchParams(queryString);
  const videoUrl = params.get('url');
  const title = params.get('title') || 'Video Player';

  // Debug log to confirm route is hit and show received params
  // eslint-disable-next-line no-console
  console.log('[PlayerPage] Route hit. videoUrl:', videoUrl, 'title:', title, 'location:', location);

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
