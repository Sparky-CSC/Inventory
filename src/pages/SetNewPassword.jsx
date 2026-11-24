import React, { useState } from 'react';
import { KeyRound, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/lib/AuthContext';

// Shown after someone opens the "reset your password" link from their email.
export default function SetNewPassword() {
  const { finishPasswordRecovery, cancelPasswordRecovery } = useAuth();
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    if (password.length < 6) {
      setError('Please choose a password with at least 6 characters.');
      return;
    }
    if (password !== confirmPassword) {
      setError('The two passwords do not match.');
      return;
    }
    setIsWorking(true);
    try {
      await finishPasswordRecovery(password);
    } catch (err) {
      setError(err?.message || 'The password could not be changed. Please try again.');
    } finally {
      setIsWorking(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-base-200 px-4 py-10">
      <div className="w-full max-w-md rounded-2xl border border-base-300 bg-base-100 p-6 sm:p-8 shadow-lg">
        <div className="mb-6">
          <h1 className="text-xl font-semibold text-base-content">Choose a new password</h1>
          <p className="mt-1 text-sm text-base-content/70">You will use it the next time you sign in.</p>
        </div>
        {error && (
          <Alert variant="destructive" className="mb-4">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}
        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <div className="space-y-1.5">
            <Label htmlFor="new_password">New password</Label>
            <Input
              id="new_password"
              type="password"
              autoComplete="new-password"
              className="bg-base-100 h-11"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              disabled={isWorking}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="confirm_new_password">Type the password again</Label>
            <Input
              id="confirm_new_password"
              type="password"
              autoComplete="new-password"
              className="bg-base-100 h-11"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              disabled={isWorking}
            />
          </div>
          <Button type="submit" disabled={isWorking} className="w-full h-11 bg-primary text-primary-content hover:bg-primary-focus">
            {isWorking ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <KeyRound className="mr-2 h-4 w-4" />}
            Save new password
          </Button>
          <Button type="button" variant="ghost" className="w-full" onClick={cancelPasswordRecovery} disabled={isWorking}>
            Not now
          </Button>
        </form>
      </div>
    </div>
  );
}
