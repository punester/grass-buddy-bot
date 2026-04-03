import React from 'react';
import { Lock } from 'lucide-react';
import { Link } from 'react-router-dom';

interface LockedFeatureCardProps {
  icon?: string;
  headline: string;
  body: string;
  className?: string;
  children?: React.ReactNode;
}

const LockedFeatureCard: React.FC<LockedFeatureCardProps> = ({
  icon = '🔒',
  headline,
  body,
  className = '',
  children,
}) => {
  return (
    <div className={`relative bg-card rounded-2xl shadow-md border border-border p-6 ${className}`}>
      {children && (
        <div className="absolute inset-0 rounded-2xl overflow-hidden pointer-events-none">
          <div className="blur-sm opacity-30 p-6">{children}</div>
        </div>
      )}
      <div className="relative flex flex-col items-center text-center py-4">
        <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-3">
          <Lock className="h-5 w-5 text-muted-foreground" />
        </div>
        <p className="text-2xl mb-1">{icon}</p>
        <h3 className="text-lg font-semibold text-foreground mb-1">{headline}</h3>
        <p className="text-sm text-muted-foreground mb-4 max-w-sm">{body}</p>
        <Link
          to="/pricing"
          className="inline-flex items-center px-5 py-2.5 bg-primary hover:bg-primary/90 text-primary-foreground rounded-lg text-sm font-medium transition-colors"
        >
          Unlock for $24/year
        </Link>
      </div>
    </div>
  );
};

export default LockedFeatureCard;
