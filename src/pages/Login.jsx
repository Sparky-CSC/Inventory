import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { Drama, Loader2, LogIn, UserPlus, KeyRound, HardDrive, MailCheck, ArrowLeft } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useAuth } from '@/lib/AuthContext';
import { getPublicAppInfo } from '@/api/appInfo';

const DEFAULT_TITLE = 'Culver-Stockton College Theatre Inventory';

function Field({ id, label, hint, ...inputProps }) {
  return (
    <div className="space-y-1.5">
      <Label htmlFor={id}>{label}</Label>
      <Input id={id} className="bg-base-100 h-11" {...inputProps} />
      {hint && <p className="text-xs text-base-content/60">{hint}</p>}
    </div>
  );
}

export default function Login() {
  const {
    needsSetup,
    isLocalMode,
    signIn,
    signUp,
    requestPasswordReset,
    checkInvitation,
  } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();

  const params = new URLSearchParams(location.search);
  const invitedEmail = params.get('invite') || params.get('email') || '';

  const [view, setView] = useState(needsSetup ? 'setup' : invitedEmail ? 'signup' : 'signin');
  const [appInfo, setAppInfo] = useState({ appName: '', logoUrl: '' });
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState(invitedEmail);
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    setView((current) => {
      if (needsSetup) return 'setup';
      return current === 'setup' ? 'signin' : current;
    });
  }, [needsSetup]);

  // An invitation link opened while this screen is already showing.
  useEffect(() => {
    if (!invitedEmail) return;
    setEmail(invitedEmail);
    setView((current) => (current === 'setup' ? current : 'signup'));
  }, [invitedEmail]);

  useEffect(() => {
    let cancelled = false;
    getPublicAppInfo().then((info) => {
      if (!cancelled && info) setAppInfo(info);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const switchView = (next) => {
    setView(next);
    setError('');
    setNotice('');
    setPassword('');
    setConfirmPassword('');
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setError('');
    setNotice('');

    const cleanEmail = email.trim();
    if (!cleanEmail) {
      setError('Please enter your email address.');
      return;
    }

    setIsWorking(true);
    try {
      if (view === 'signin') {
        await signIn({ email: cleanEmail, password });
        // Drop any "?invite=…" left in the address once signed in.
        if (location.search) navigate(location.pathname, { replace: true });
        return;
      }

      if (view === 'forgot') {
        if (isLocalMode) {
          if (password.length < 6) throw new Error('Please choose a password with at least 6 characters.');
          if (password !== confirmPassword) throw new Error('The two passwords do not match.');
          await requestPasswordReset({ email: cleanEmail, newPassword: password });
          setView('signin');
          setPassword('');
          setConfirmPassword('');
          setNotice('Your password has been changed. You can sign in with it now.');
        } else {
          await requestPasswordReset({ email: cleanEmail });
          setNotice('If that email has an account, a link to choose a new password is on its way.');
        }
        return;
      }

      // "setup" (first administrator) and "signup" (invited person)
      if (!fullName.trim()) throw new Error('Please enter your name.');
      if (password.length < 6) throw new Error('Please choose a password with at least 6 characters.');
      if (password !== confirmPassword) throw new Error('The two passwords do not match.');

      if (view === 'signup') {
        const invitation = await checkInvitation(cleanEmail);
        if (!invitation.allowed) {
          throw new Error(
            'This email has not been invited yet (or the invitation has expired). Ask an administrator to send you an invitation.'
          );
        }
      }

      const result = await signUp({ email: cleanEmail, password, full_name: fullName.trim() });
      if (result?.needsEmailConfirmation) {
        setView('signin');
        setPassword('');
        setConfirmPassword('');
        setNotice('Almost done — check your inbox and click the confirmation link, then sign in here.');
      } else if (location.search) {
        navigate(location.pathname, { replace: true });
      }
    } catch (err) {
      setError(err?.message || 'Something went wrong. Please try again.');
    } finally {
      setIsWorking(false);
    }
  };

  const title = appInfo.appName || DEFAULT_TITLE;

  const copy = {
    setup: {
      heading: 'Set up your inventory',
      blurb: 'Create the first account. It becomes the administrator and can invite everyone else.',
      button: 'Create administrator account',
      icon: UserPlus,
    },
    signin: {
      heading: 'Sign in',
      blurb: 'Use the email and password for your account.',
      button: 'Sign in',
      icon: LogIn,
    },
    signup: {
      heading: 'Create your account',
      blurb: 'Use the email address your invitation was sent to.',
      button: 'Create account',
      icon: UserPlus,
    },
    forgot: {
      heading: isLocalMode ? 'Choose a new password' : 'Reset your password',
      blurb: isLocalMode
        ? 'Enter the email for your account on this device and pick a new password.'
        : 'Enter your email and we will send you a link to choose a new password.',
      button: isLocalMode ? 'Save new password' : 'Email me a reset link',
      icon: KeyRound,
    },
  }[view];

  const SubmitIcon = copy.icon;
  const showName = view === 'setup' || view === 'signup';
  const showPassword = view !== 'forgot' || isLocalMode;
  const showConfirm = view === 'setup' || view === 'signup' || (view === 'forgot' && isLocalMode);

  return (
    <div className="min-h-screen w-full flex items-center justify-center bg-base-200 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          {appInfo.logoUrl ? (
            <img src={appInfo.logoUrl} alt="" className="mx-auto h-16 w-16 rounded-2xl object-contain mb-4" />
          ) : (
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-primary shadow-md">
              <Drama className="h-9 w-9 text-primary-content" aria-hidden="true" />
            </div>
          )}
          <h1 className="text-2xl font-bold text-base-content text-balance">{title}</h1>
        </div>

        <div className="rounded-2xl border border-base-300 bg-base-100 p-6 sm:p-8 shadow-lg">
          <div className="mb-6">
            <h2 className="text-xl font-semibold text-base-content">{copy.heading}</h2>
            <p className="mt-1 text-sm text-base-content/70">{copy.blurb}</p>
          </div>

          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
          {notice && (
            <Alert className="mb-4 border-success/40 bg-success/10">
              <MailCheck className="h-4 w-4 text-success" />
              <AlertDescription className="text-base-content">{notice}</AlertDescription>
            </Alert>
          )}

          <form onSubmit={handleSubmit} className="space-y-4" noValidate>
            {showName && (
              <Field
                id="full_name"
                label="Your name"
                autoComplete="name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                disabled={isWorking}
              />
            )}
            <Field
              id="email"
              label="Email"
              type="email"
              inputMode="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isWorking}
            />
            {showPassword && (
              <Field
                id="password"
                label={view === 'forgot' ? 'New password' : 'Password'}
                type="password"
                autoComplete={view === 'signin' ? 'current-password' : 'new-password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                disabled={isWorking}
                hint={showConfirm ? 'At least 6 characters.' : undefined}
              />
            )}
            {showConfirm && (
              <Field
                id="confirm_password"
                label="Type the password again"
                type="password"
                autoComplete="new-password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                disabled={isWorking}
              />
            )}

            <Button
              type="submit"
              disabled={isWorking}
              className="w-full h-11 bg-primary text-primary-content hover:bg-primary-focus"
            >
              {isWorking ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <SubmitIcon className="mr-2 h-4 w-4" />
              )}
              {copy.button}
            </Button>
          </form>

          {view === 'signin' && (
            <div className="mt-6 flex flex-col gap-2 text-sm sm:flex-row sm:items-center sm:justify-between">
              <button type="button" className="text-primary hover:underline text-left" onClick={() => switchView('forgot')}>
                Forgot your password?
              </button>
              <button type="button" className="text-primary hover:underline text-left" onClick={() => switchView('signup')}>
                I have an invitation
              </button>
            </div>
          )}
          {(view === 'signup' || view === 'forgot') && (
            <button
              type="button"
              className="mt-6 inline-flex items-center text-sm text-primary hover:underline"
              onClick={() => switchView('signin')}
            >
              <ArrowLeft className="mr-1 h-4 w-4" /> Back to sign in
            </button>
          )}
        </div>

        {isLocalMode && (
          <div className="mt-6 flex items-start gap-3 rounded-xl border border-base-300 bg-base-100/70 p-4 text-sm text-base-content/80">
            <HardDrive className="mt-0.5 h-4 w-4 flex-shrink-0 text-primary" aria-hidden="true" />
            <p>
              This copy keeps its data in this browser on this device. Accounts made here are not shared with other
              devices. See the README to switch on the shared database.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
