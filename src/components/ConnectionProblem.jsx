import React from 'react';
import { CloudOff, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

// Shown when the shared database cannot be reached at start-up.
export default function ConnectionProblem({ message, onRetry }) {
  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-base-200 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-base-300 bg-base-100 p-8 text-center shadow-lg">
        <div className="mx-auto mb-5 flex h-14 w-14 items-center justify-center rounded-full bg-warning/20">
          <CloudOff className="h-7 w-7 text-warning-content" aria-hidden="true" />
        </div>
        <h1 className="text-xl font-semibold text-base-content">Can't reach the database</h1>
        <p className="mt-2 text-sm text-base-content/70">
          Check your internet connection and try again. If this keeps happening, the Supabase project may be paused —
          an administrator can wake it from the Supabase dashboard.
        </p>
        {message && (
          <p className="mt-4 rounded-lg bg-base-200 p-3 text-left text-xs text-base-content/70 break-words">{message}</p>
        )}
        <Button onClick={onRetry} className="mt-6 bg-primary text-primary-content hover:bg-primary-focus">
          <RefreshCw className="mr-2 h-4 w-4" /> Try again
        </Button>
      </div>
    </div>
  );
}
