import { useState, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { X, RefreshCw, Download, Play, Trash2, Plus, Folder, Video } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { VideoPlayer } from "./video-player";
import { useMediaItem } from "@/hooks/use-media";
import { refreshMetadata, deleteMediaItem as deleteMediaItemApi, checkAndFetchMetadata, getDownloadUrl } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";
import type { MediaItemWithTagsAndCategories, ApiOption } from "@shared/schema";
// Utility to extract a playable video URL from various API responses
function extractPlayableUrl(proxyData: any, quality: '1080p' | '720p' | '480p' | '360p' = '720p'): string | null {
  if (!proxyData) return null;

  // Prioritize fast_stream_url as requested
  if (proxyData.list?.[0]?.fast_stream_url) {
    const fast = proxyData.list[0].fast_stream_url;
    const preferred = [quality, '1080p', '720p', '480p', '360p'];
    for (const res of preferred) {
      if (fast[res]) return fast[res];
    }
    const available = Object.values(fast).find((v) => typeof v === 'string' && v.startsWith('http'));
    if (available) return available as string;
  }

  // PlayerTera/qualities
  if (proxyData.qualities && typeof proxyData.qualities === 'object') {
    const preferred = [quality, '1080p', '720p', '480p', '360p'];
    for (const res of preferred) {
        if (proxyData.qualities[res]?.url) return proxyData.qualities[res]?.url;
    }
  }

  // Common fields
  if (typeof proxyData === 'string' && proxyData.startsWith('http')) return proxyData;
  if (proxyData.streamUrl) return proxyData.streamUrl;
  if (proxyData.downloadUrl) return proxyData.downloadUrl;
  if (proxyData.url && typeof proxyData.url === 'string' && proxyData.url.startsWith('http')) return proxyData.url;
  if (proxyData.playableUrl) return proxyData.playableUrl;

  // Nested data
  if (proxyData.data?.download_link) return proxyData.data.download_link;
  if (proxyData.data?.url) return proxyData.data.url;

  // Try array of urls
  if (Array.isArray(proxyData.urls) && proxyData.urls.length > 0) {
    if (typeof proxyData.urls[0] === 'string' && proxyData.urls[0].startsWith('http')) return proxyData.urls[0];
    if (proxyData.urls[0]?.url) return proxyData.urls[0].url;
  }

  // Fallback for nested list (IteraPlay, TeraBox, etc.)
  if (Array.isArray(proxyData.list) && proxyData.list.length > 0) {
    const first = proxyData.list[0];
    if (first.url && typeof first.url === 'string' && first.url.startsWith('http')) return first.url;
    if (first.downloadUrl && typeof first.downloadUrl === 'string' && first.downloadUrl.startsWith('http')) return first.downloadUrl;
    // Fallback: any string field that looks like a URL
    for (const key in first) {
      if (typeof first[key] === 'string' && first[key].startsWith('http')) return first[key];
    }
  }

  // Fallback: any field that looks like a url
  for (const key in proxyData) {
    if (typeof proxyData[key] === 'string' && proxyData[key].startsWith('http')) return proxyData[key];
  }

  return null;
}
import { TagCategoryManager } from "./tag-category-manager";
import { useLocation } from "wouter";

interface DetailModalProps {
  mediaId: string;
  isOpen: boolean;
  onClose: () => void;
}

const getTagColor = (color: string | null) => {
  const colors = {
    primary: "bg-primary/20 text-primary border-primary/30",
    secondary: "bg-secondary/20 text-secondary border-secondary/30",
    emerald: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
    rose: "bg-rose-500/20 text-rose-500 border-rose-500/30",
    orange: "bg-orange-500/20 text-orange-500 border-orange-500/30",
    red: "bg-red-500/20 text-red-500 border-red-500/30",
    purple: "bg-purple-500/20 text-purple-500 border-purple-500/30",
    blue: "bg-blue-500/20 text-blue-500 border-blue-500/30",
    cyan: "bg-cyan-500/20 text-cyan-500 border-cyan-500/30",
    gray: "bg-gray-500/20 text-gray-500 border-gray-500/30",
  };
  return colors[color as keyof typeof colors] || colors.primary;
};

const formatSize = (bytes: number | null) => {
  if (!bytes) return "Unknown size";
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  if (bytes === 0) return '0 Bytes';
  const i = Math.floor(Math.log(bytes) / Math.log(1024));
  return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
};

const formatDuration = (seconds: number | null) => {
  if (!seconds) return "Unknown duration";
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.floor((seconds % 3600) / 60);
  const secs = seconds % 60;

  if (hours > 0) {
    return `${hours}:${minutes.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  }
  return `${minutes}:${secs.toString().padStart(2, '0')}`;
};

export function DetailModal({ mediaId, isOpen, onClose }: DetailModalProps) {
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const { data: mediaItem, isLoading: mediaLoading, error: mediaError } = useMediaItem(mediaId);

  // Check for missing metadata when detail modal opens
  useEffect(() => {
    if (mediaItem && (!mediaItem.title || mediaItem.title === "Processing..." || !mediaItem.thumbnail || !mediaItem.scrapedAt)) {
      checkAndFetchMetadata(mediaId)
        .then(() => {
          // Refresh the query to get updated data
          queryClient.invalidateQueries({ queryKey: ['mediaItem', mediaId] });
          queryClient.invalidateQueries({ queryKey: ['mediaItems'] });
        })
        .catch(error => {
          console.error("Failed to fetch metadata:", error);
          toast({
            title: "Metadata Fetch Failed",
            description: "Could not fetch metadata automatically.",
            variant: "destructive",
          });
        });
    }
  }, [mediaItem, mediaId, queryClient, toast]);


  const { data: apiOptions = [] } = useQuery<ApiOption[]>({
    queryKey: ["/api/api-options"],
  });

  const refreshMetadataMutation = useMutation({
    mutationFn: () => refreshMetadata(mediaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mediaItem', mediaId] });
      queryClient.invalidateQueries({ queryKey: ['mediaItems'] });
      toast({
        title: "Metadata Refreshed",
        description: "Successfully updated metadata from external sources.",
      });
    },
    onError: (error) => {
      toast({
        title: "Refresh Failed",
        description: error instanceof Error ? error.message : "Failed to refresh metadata",
        variant: "destructive",
      });
    },
  });

  const getDownloadUrlMutation = useMutation({
    mutationFn: async ({ apiId, mediaUrl }: { apiId: string, mediaUrl: string }) => {
        const data = await getDownloadUrl(mediaId, apiId, mediaUrl);
        return { ...data, source: apiId };
    },
    onSuccess: (data) => {
      try {
        const proxyData = data;
        const downloadUrl = extractPlayableUrl(proxyData);

        if (downloadUrl && mediaItem) {
          // TypeScript: extend window type for electronAPI.downloadFile
          const electronAPI = (window as any).electronAPI as {
            downloadFile?: (url: string, filename: string) => void;
          };
          if (electronAPI?.downloadFile) {
            const filename = `${mediaItem.title}.mp4`; // Assuming mp4, should be improved
            electronAPI.downloadFile(downloadUrl, filename);
            toast({
              title: "Download Started",
              description: `Downloading to your ChiperBox folder.`,
            });
          } else {
            window.open(downloadUrl, '_blank');
          }
        } else {
          throw new Error("Could not find a download URL in the response.");
        }
      } catch (e) {
        toast({
          title: "Download Failed",
          description: "Could not process the response from the API.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
      toast({
        title: "Download Failed",
        description: error instanceof Error ? error.message : "Failed to get download URL",
        variant: "destructive",
      });
    },
  });

  const deleteMediaMutation = useMutation({
    mutationFn: () => deleteMediaItemApi(mediaId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['mediaItems'] });
      toast({
        title: "Media Deleted",
        description: "Successfully deleted the media item.",
      });
      onClose();
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "Failed to delete media item",
        variant: "destructive",
      });
    },
  });

  const handleRefresh = () => {
    refreshMetadataMutation.mutate();
  };

  const handleDownload = (apiId: string) => {
    if (mediaItem) {
      getDownloadUrlMutation.mutate({ apiId, mediaUrl: mediaItem.url });
    }
  };

  const handleDelete = () => {
    if (confirm("Are you sure you want to delete this media item? This action cannot be undone.")) {
      deleteMediaMutation.mutate();
    }
  };

  const getPlayUrlMutation = useMutation({
    mutationFn: async (apiId: string) => {
        const data = await getDownloadUrl(mediaId, apiId, mediaItem!.url);
        return { ...data, source: apiId };
    },
    onSuccess: (data) => {
      try {
        const proxyData = data;
        const playUrl = extractPlayableUrl(proxyData);

        if (playUrl && mediaItem) {
          const playerPath = `/player?url=${encodeURIComponent(playUrl)}&title=${encodeURIComponent(mediaItem.title)}`;
          navigate(playerPath);
        } else {
          throw new Error("Could not find a playable URL in the response. See console for details.");
        }
      } catch (e) {
        console.error('Error in play mutation onSuccess handler:', e);
        toast({
          title: "Play Failed",
          description: e instanceof Error ? e.message : "Could not process the response from the API. See console for details.",
          variant: "destructive",
        });
      }
    },
    onError: (error) => {
        toast({
            title: "Play Failed",
            description: error instanceof Error ? error.message : "Failed to get play URL",
            variant: "destructive",
        });
    },
  });

  const handlePlay = () => {
    // For now, let's just use the first available API for playing.
    // This could be improved with a preferred API setting.
    if (apiOptions.length > 0) {
        getPlayUrlMutation.mutate(apiOptions[0].name);
    } else {
        toast({
            title: "No APIs Available",
            description: "There are no APIs configured to play this media.",
            variant: "destructive",
        });
    }
  };

  if (mediaLoading) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-surface-light border-slate-600">
          <div className="flex items-center justify-center h-96">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (mediaError) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-surface-light border-slate-600">
          <div className="flex flex-col items-center justify-center h-96 text-destructive">
            <p>Error loading media: {mediaError.message}</p>
            <Button onClick={onClose} className="mt-4">Close</Button>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  if (!mediaItem) {
    return (
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] bg-surface-light border-slate-600">
          <div className="flex items-center justify-center h-96">
            <p className="text-slate-400">Media item not found.</p>
          </div>
        </DialogContent>
      </Dialog>
    );
  }

  const isFolder = mediaItem.type === "folder";

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] bg-surface-light border-slate-600">
        <DialogDescription>
          {mediaItem && mediaItem.description ? mediaItem.description : "Media details and actions dialog."}
        </DialogDescription>
        <DialogHeader>
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-slate-800 rounded-lg flex items-center justify-center">
                {isFolder ? (
                  <Folder className="text-amber-500 text-xl" />
                ) : (
                  <Video className="text-primary text-xl" />
                )}
              </div>
              <div>
                <DialogTitle className="text-xl font-bold">{mediaItem.title}</DialogTitle>
                <p className="text-slate-400 text-sm">
                  {isFolder ? "Folder" : "Video File"} • {formatSize(mediaItem.size)}
                </p>
              </div>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={onClose}
              className="text-slate-400 hover:text-white"
            >
              <X className="h-5 w-5" />
            </Button>
          </div>
        </DialogHeader>

        <div className="flex h-[calc(90vh-120px)]">
          {/* Left Panel - Media Preview */}
          <div className="flex-1 p-6 overflow-y-auto">
            <div className="relative aspect-video bg-black rounded-lg overflow-hidden mb-6">
              {mediaItem.thumbnail ? (
                <img
                  src={mediaItem.thumbnail}
                  alt={mediaItem.title}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full bg-slate-800 flex items-center justify-center">
                  <Video className="text-primary text-8xl" />
                </div>
              )}
              {mediaItem.duration && (
                <div className="absolute bottom-4 left-4 text-white">
                  <div className="text-sm bg-black bg-opacity-70 px-2 py-1 rounded">
                    Duration: {formatDuration(mediaItem.duration)}
                  </div>
                </div>
              )}
            </div>

            {/* API Selection */}
            <div className="mb-6">
              <div className="flex items-center justify-between mb-4">
                <h3 className="text-lg font-semibold">Actions</h3>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleRefresh}
                  disabled={refreshMetadataMutation.isPending}
                  className="bg-amber-500/20 text-amber-500 border-amber-500/30 hover:bg-amber-500/30"
                >
                  <RefreshCw className={`h-4 w-4 mr-2 ${refreshMetadataMutation.isPending ? 'animate-spin' : ''}`} />
                  Refresh
                </Button>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <Button
                  onClick={handlePlay}
                  disabled={getPlayUrlMutation.isPending}
                  className="w-full justify-start"
                >
                  <Play className={`h-4 w-4 mr-2 ${getPlayUrlMutation.isPending ? 'animate-spin' : ''}`} />
                  Play Video
                </Button>
                {apiOptions.map((api) => (
                  <Button
                    key={api.id}
                    onClick={() => handleDownload(api.name)}
                    disabled={getDownloadUrlMutation.isPending}
                    className="w-full justify-start"
                  >
                    <Download className="h-4 w-4 mr-2" />
                    Download with {api.name}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {/* Right Panel - Metadata */}
          <div className="w-80 bg-slate-800 p-6 overflow-y-auto">
            <h3 className="text-lg font-semibold mb-4">Details</h3>

            {/* Basic Info */}
            <div className="space-y-4 mb-6">
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wide">Name</label>
                <p className="text-sm">{mediaItem.title}</p>
              </div>
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wide">Type</label>
                <p className="text-sm capitalize">{mediaItem.type}</p>
              </div>
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wide">Size</label>
                <p className="text-sm">{formatSize(mediaItem.size)}</p>
              </div>
              {mediaItem.duration && (
                <div>
                  <label className="text-xs text-slate-400 uppercase tracking-wide">Duration</label>
                  <p className="text-sm">{formatDuration(mediaItem.duration)}</p>
                </div>
              )}
              <div>
                <label className="text-xs text-slate-400 uppercase tracking-wide">Added</label>
                <p className="text-sm">{mediaItem.createdAt ? new Date(mediaItem.createdAt).toLocaleString() : "Unknown"}</p>
              </div>
            </div>

            <TagCategoryManager
              mediaId={mediaItem.id}
              assignedTags={mediaItem.tags || []}
              assignedCategories={mediaItem.categories || []}
            />

            {/* Folder Contents (if folder) */}
            {isFolder && (
              <div className="mb-6">
                <label className="text-xs text-slate-400 uppercase tracking-wide">Contents</label>
                <div className="mt-3 space-y-2">
                  <div className="text-sm text-slate-300">
                    {mediaItem.folderVideoCount} videos, {mediaItem.folderImageCount} images
                  </div>
                  <div className="text-xs text-slate-400">
                    Total size: {formatSize(mediaItem.size)}
                  </div>
                </div>
              </div>
            )}

            {/* Description */}
            {mediaItem.description && (
              <div className="mb-6">
                <label className="text-xs text-slate-400 uppercase tracking-wide">Description</label>
                <p className="text-sm mt-2 text-slate-300">{mediaItem.description}</p>
              </div>
            )}

            {/* Actions */}
            <div className="space-y-3">
              <Button
                onClick={handleDelete}
                disabled={deleteMediaMutation.isPending}
                variant="destructive"
                className="w-full"
              >
                <Trash2 className="h-4 w-4 mr-2" />
                {deleteMediaMutation.isPending ? 'Deleting...' : 'Delete'}
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}