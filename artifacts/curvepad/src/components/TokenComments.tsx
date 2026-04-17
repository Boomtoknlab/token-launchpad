import { useState, useEffect, useCallback } from "react";
import { useAccount } from "wagmi";
import { MessageSquare, Send, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { shortenAddress } from "@/lib/web3";
import { getTokenComments, postTokenComment, type TokenComment } from "@/lib/api";
import { useToast } from "@/hooks/use-toast";

interface TokenCommentsProps {
  tokenAddress: string;
}

function timeAgo(dateStr: string): string {
  const diff = Math.floor((Date.now() - new Date(dateStr).getTime()) / 1000);
  if (diff < 60) return `${diff}s`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h`;
  return `${Math.floor(diff / 86400)}d`;
}

function avatarColor(addr: string): string {
  const palette = ["bg-emerald-500", "bg-violet-500", "bg-orange-500", "bg-pink-500", "bg-blue-500", "bg-teal-500"];
  let h = 0;
  for (let i = 0; i < addr.length; i++) h = addr.charCodeAt(i) + ((h << 5) - h);
  return palette[Math.abs(h) % palette.length];
}

export function TokenComments({ tokenAddress }: TokenCommentsProps) {
  const [comments, setComments] = useState<TokenComment[]>([]);
  const [draft, setDraft] = useState("");
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const { address, isConnected } = useAccount();
  const { toast } = useToast();

  const loadComments = useCallback(async () => {
    const data = await getTokenComments(tokenAddress);
    setComments(data);
    setLoading(false);
  }, [tokenAddress]);

  useEffect(() => {
    loadComments();
    const id = setInterval(loadComments, 15000);
    return () => clearInterval(id);
  }, [loadComments]);

  const handlePost = async () => {
    if (!isConnected || !address || !draft.trim()) return;
    setPosting(true);
    const result = await postTokenComment(tokenAddress, address, draft.trim());
    if (result) {
      setComments((prev) => [result, ...prev]);
      setDraft("");
    } else {
      toast({ title: "Failed to post", description: "Try again.", variant: "destructive" });
    }
    setPosting(false);
  };

  return (
    <div className="rounded-lg border border-border/40 bg-card/60 p-4 space-y-4">
      <div className="flex items-center gap-2">
        <MessageSquare className="w-3.5 h-3.5 text-muted-foreground" />
        <h3 className="text-sm font-semibold text-foreground">Comments</h3>
        <span className="text-xs text-muted-foreground">({comments.length})</span>
      </div>

      {isConnected ? (
        <div className="space-y-2">
          <Textarea
            placeholder="Leave a comment..."
            value={draft}
            onChange={(e) => setDraft(e.target.value.slice(0, 500))}
            className="min-h-[70px] text-xs bg-background/50 resize-none border-border/60"
            maxLength={500}
          />
          <div className="flex items-center justify-between">
            <span className="text-xs text-muted-foreground">{draft.length}/500</span>
            <Button
              size="sm"
              className="h-7 text-xs px-3 bg-primary text-primary-foreground"
              onClick={handlePost}
              disabled={!draft.trim() || posting}
            >
              {posting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <>
                  <Send className="w-3 h-3 mr-1" /> Post
                </>
              )}
            </Button>
          </div>
        </div>
      ) : (
        <div className="text-xs text-muted-foreground py-2 text-center">
          Connect your wallet to comment
        </div>
      )}

      {loading ? (
        <div className="space-y-2">
          {[...Array(3)].map((_, i) => (
            <div key={i} className="h-12 rounded-md bg-muted/20 animate-pulse" />
          ))}
        </div>
      ) : comments.length === 0 ? (
        <p className="text-xs text-muted-foreground text-center py-4">
          No comments yet. Be the first!
        </p>
      ) : (
        <div className="space-y-2 max-h-64 overflow-y-auto pr-1">
          {comments.map((c) => (
            <div key={c.id} className="flex gap-2.5 py-2 border-b border-border/20 last:border-0">
              <div
                className={`w-7 h-7 rounded-full ${avatarColor(c.commenterAddress)} flex items-center justify-center text-white text-xs font-bold flex-shrink-0`}
              >
                {c.commenterAddress.slice(2, 4).toUpperCase()}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 mb-0.5">
                  <span className="text-xs font-mono text-muted-foreground">
                    {shortenAddress(c.commenterAddress)}
                  </span>
                  <span className="text-xs text-muted-foreground/40">·</span>
                  <span className="text-xs text-muted-foreground/60">{timeAgo(c.createdAt)}</span>
                </div>
                <p className="text-xs text-foreground/90 leading-relaxed break-words">{c.content}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
