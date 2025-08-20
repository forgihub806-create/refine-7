import { useSearchParams } from "wouter";

export default function PlayerPage() {
  const [searchParams] = useSearchParams();
  const videoUrl = searchParams.get('url');
  const title = searchParams.get('title') || 'Video Player';

  if (!videoUrl) {
    return (
      <div className="min-h-screen bg-slate-900 text-slate-50 p-8 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-red-500 mb-4">Playback Error</h1>
          <p className="text-red-400">No video source URL was provided.</p>
          <p className="text-sm text-slate-400 mt-2">Please go back and try again.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-black flex flex-col items-center justify-center">
        <h1 className="text-2xl font-bold text-white mb-4">{title}</h1>
        <video
            src={videoUrl}
            controls
            autoPlay
            className="w-full max-w-4xl"
        />
        <div className="mt-4">
            <button
                onClick={() => window.history.back()}
                className="px-4 py-2 bg-slate-700 text-white rounded-lg hover:bg-slate-600"
            >
                Back
            </button>
        </div>
    </div>
  );
}
