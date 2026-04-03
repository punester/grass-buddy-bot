import React, { useState } from 'react';
import { Copy, Share2, Check } from 'lucide-react';
import { toast } from 'sonner';

interface ReferralShareBlockProps {
  referralCode: string;
  referralCount: number;
  threshold: number;
}

const SITE_URL = 'https://grass-buddy-bot.lovable.app';

const ReferralShareBlock: React.FC<ReferralShareBlockProps> = ({ referralCode, referralCount, threshold }) => {
  const [copied, setCopied] = useState(false);
  const referralUrl = `${SITE_URL}/?ref=${referralCode}`;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(referralUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      toast.error('Failed to copy');
    }
  };

  const handleShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'ThirstyGrass',
          text: 'Check out ThirstyGrass — it tells you exactly when to water your lawn so you stop wasting water.',
          url: referralUrl,
        });
      } catch (e) {
        if ((e as Error).name !== 'AbortError') handleCopy();
      }
    } else {
      handleCopy();
    }
  };

  const progress = Math.min(referralCount / threshold, 1);

  return (
    <div className="space-y-4">
      {/* URL display */}
      <div className="flex items-center gap-2 p-3 bg-muted rounded-lg border border-border">
        <span className="text-sm font-mono text-foreground truncate flex-1">{referralUrl}</span>
        <button
          onClick={handleCopy}
          className="shrink-0 p-2 rounded-md hover:bg-background transition-colors"
          title="Copy link"
        >
          {copied ? <Check className="h-4 w-4 text-primary" /> : <Copy className="h-4 w-4 text-muted-foreground" />}
        </button>
        <button
          onClick={handleShare}
          className="shrink-0 p-2 rounded-md hover:bg-background transition-colors"
          title="Share"
        >
          <Share2 className="h-4 w-4 text-muted-foreground" />
        </button>
      </div>

      {copied && (
        <p className="text-sm text-primary font-medium">Copied!</p>
      )}

      {/* Progress */}
      <div>
        <div className="flex items-center justify-between text-sm mb-1.5">
          <span className="text-muted-foreground">{referralCount} of {threshold} friends joined</span>
          <span className="text-muted-foreground font-medium">{Math.round(progress * 100)}%</span>
        </div>
        <div className="h-2 bg-muted rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-500"
            style={{ width: `${progress * 100}%` }}
          />
        </div>
      </div>
    </div>
  );
};

export default ReferralShareBlock;
