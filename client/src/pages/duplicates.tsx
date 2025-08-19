import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { getDuplicateMediaItems, deleteMediaItem } from "@/lib/api";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { ArrowLeft, Trash2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function DuplicatesPage() {
  const { data: duplicates, isLoading, error, refetch } = useQuery({
    queryKey: ['duplicates'],
    queryFn: getDuplicateMediaItems,
  });
  const queryClient = useQueryClient();
  const { toast } = useToast();

  const deleteMutation = useMutation({
    mutationFn: (ids: string[]) => Promise.all(ids.map(id => deleteMediaItem(id))),
    onSuccess: () => {
      toast({
        title: "Duplicates Deleted",
        description: "The selected duplicate items have been deleted.",
      });
      queryClient.invalidateQueries({ queryKey: ['duplicates'] });
      queryClient.invalidateQueries({ queryKey: ['duplicatesCount'] });
    },
    onError: (error) => {
      toast({
        title: "Delete Failed",
        description: error instanceof Error ? error.message : "An unknown error occurred.",
        variant: "destructive",
      });
    },
  });

  const handleDeleteAll = (items: any[]) => {
    if (confirm("Are you sure you want to delete all these items?")) {
      const idsToDelete = items.map(item => item.id);
      deleteMutation.mutate(idsToDelete);
    }
  };

  const handleKeepOne = (items: any[]) => {
    if (confirm("Are you sure you want to delete all but the first item?")) {
      const sortedItems = [...items].sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
      const idsToDelete = sortedItems.slice(1).map(item => item.id);
      deleteMutation.mutate(idsToDelete);
    }
  };

  return (
    <div className="min-h-screen bg-slate-900 text-slate-50 p-8">
      <div className="max-w-4xl mx-auto">
        <div className="flex items-center mb-8">
          <Button variant="ghost" size="sm" asChild>
            <Link to="/">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Library
            </Link>
          </Button>
        </div>

        <h1 className="text-3xl font-bold mb-2">Duplicate Media Items</h1>
        <p className="text-slate-400 mb-8">
          Showing groups of items that share the same URL.
        </p>

        {isLoading && <p>Loading duplicates...</p>}
        {error && <p className="text-red-400">Error fetching duplicates: {error.message}</p>}

        {duplicates && Object.keys(duplicates).length === 0 && (
          <div className="text-center py-12 border border-dashed border-slate-700 rounded-lg">
            <h3 className="text-xl font-semibold">No Duplicates Found</h3>
            <p className="text-slate-400 mt-2">Your media library is clean!</p>
          </div>
        )}

        {duplicates && Object.keys(duplicates).length > 0 && (
          <div className="space-y-8">
            {Object.entries(duplicates).map(([url, items]) => (
              <div key={url} className="bg-surface p-6 rounded-lg border border-slate-700">
                <div className="flex justify-between items-start">
                  <div>
                    <h2 className="font-mono text-sm text-primary mb-1 break-all">{url}</h2>
                    <p className="text-slate-400 text-xs mb-4">
                      Found {items.length} items with this URL.
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <Button variant="outline" size="sm" onClick={() => handleKeepOne(items)} disabled={deleteMutation.isPending}>
                      Keep One
                    </Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteAll(items)} disabled={deleteMutation.isPending}>
                      <Trash2 className="h-4 w-4 mr-2" />
                      Delete All
                    </Button>
                  </div>
                </div>
                <div className="space-y-3 mt-4">
                  {items.map((item) => (
                    <div key={item.id} className="flex items-center justify-between p-3 bg-slate-800 rounded-md">
                      <div>
                        <p className="font-semibold">{item.title}</p>
                        <p className="text-xs text-slate-500">
                          Added: {new Date(item.createdAt).toLocaleString()}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
