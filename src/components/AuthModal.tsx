import React, { useEffect, useState } from 'react';
import {
  createUserWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut,
  updateProfile,
  type User,
} from 'firebase/auth';
import { CheckCircle2, KeyRound, LogOut, Mail, Phone, ShieldCheck, User as UserIcon, X } from 'lucide-react';
import { auth, googleProvider } from '../firebase';
import { LANGUAGE_LABELS } from '../i18n/translations';
import { ensureUserDocuments, updateUserProfile } from '../services/firestoreService';
import type {
  ChromaTheme,
  LanguageCode,
  UnitSystem,
  UserAccount,
  UserPrivateInfo,
} from '../types/climora';

type AuthMode = 'login' | 'register' | 'reset';

interface AuthModalProps {
  open: boolean;
  onClose: () => void;
  firebaseUser: User | null;
  account: UserAccount | null;
  privateInfo: UserPrivateInfo | null;
  currentUnit: UnitSystem;
  currentLang: LanguageCode;
  currentTheme: ChromaTheme;
  onPreferencesChange: (unit: UnitSystem, lang: LanguageCode, theme: ChromaTheme) => void;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  open,
  onClose,
  firebaseUser,
  account,
  privateInfo,
  currentUnit,
  currentLang,
  currentTheme,
  onPreferencesChange,
}) => {
  const [mode, setMode] = useState<AuthMode>('login');
  const [fullName, setFullName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [unit, setUnit] = useState<UnitSystem>(currentUnit);
  const [lang, setLang] = useState<LanguageCode>(currentLang);
  const [theme, setTheme] = useState<ChromaTheme>(currentTheme);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (firebaseUser) {
      setFullName(privateInfo?.fullName || account?.displayName || firebaseUser.displayName || '');
      setEmail(privateInfo?.email || firebaseUser.email || '');
      setPhone(privateInfo?.phone || '');
      setUnit(account?.preferredUnit || currentUnit);
      setLang(account?.preferredLang || currentLang);
      setTheme(account?.chromaTheme || currentTheme);
    }
  }, [firebaseUser, account, privateInfo, currentUnit, currentLang, currentTheme]);

  if (!open) return null;

  const mapAuthError = (err: unknown): string => {
    const code = (err as { code?: string })?.code || '';
    if (code === 'auth/operation-not-allowed') {
      return 'Email/Password sign-in is not yet enabled in Firebase Console (Authentication → Sign-in method). You can use Google Sign-In immediately or enable Email/Password in Firebase Console.';
    }
    if (code === 'auth/email-already-in-use') {
      return 'An account with this email already exists. Try signing in or resetting your password.';
    }
    if (code === 'auth/invalid-credential' || code === 'auth/wrong-password') {
      return 'Invalid email or password. Please verify your credentials.';
    }
    if (code === 'auth/weak-password') {
      return 'Password must be at least 6 characters long.';
    }
    if (code === 'auth/popup-closed-by-user') {
      return 'Sign-in popup was closed before completing authentication.';
    }
    return err instanceof Error ? err.message : 'Authentication failed.';
  };

  const handleGoogleSignIn = async () => {
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const cred = await signInWithPopup(auth, googleProvider);
      await ensureUserDocuments({
        uid: cred.user.uid,
        fullName: cred.user.displayName || 'CLIMORA Explorer',
        email: cred.user.email || '',
        phone: cred.user.phoneNumber || '',
        preferredUnit: unit,
        preferredLang: lang,
      });
      onClose();
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await ensureUserDocuments({
        uid: cred.user.uid,
        fullName: cred.user.displayName || email.split('@')[0],
        email: cred.user.email || email.trim(),
        phone: '',
        preferredUnit: unit,
        preferredLang: lang,
      });
      onClose();
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!fullName.trim()) {
      setErrorMsg('Please enter your full name.');
      return;
    }
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await updateProfile(cred.user, { displayName: fullName.trim() });
      await ensureUserDocuments({
        uid: cred.user.uid,
        fullName: fullName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        preferredUnit: unit,
        preferredLang: lang,
      });
      await sendEmailVerification(cred.user).catch(() => {});
      setStatusMsg('Account created! A verification email has been sent to your inbox.');
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleResetSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await sendPasswordResetEmail(auth, email.trim());
      setStatusMsg('Password reset link sent. Check your email inbox.');
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleProfileSave = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firebaseUser) return;
    setBusy(true);
    setErrorMsg(null);
    setStatusMsg(null);
    try {
      await updateUserProfile({
        uid: firebaseUser.uid,
        displayName: fullName.trim(),
        phone: phone.trim(),
        email: email.trim() || firebaseUser.email || '',
        preferredUnit: unit,
        preferredLang: lang,
        chromaTheme: theme,
      });
      await updateProfile(firebaseUser, { displayName: fullName.trim() }).catch(() => {});
      onPreferencesChange(unit, lang, theme);
      setStatusMsg('Account details and preferences saved.');
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'Unable to save profile.');
    } finally {
      setBusy(false);
    }
  };

  const handleResendVerification = async () => {
    if (!firebaseUser) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      await sendEmailVerification(firebaseUser);
      setStatusMsg('Verification email re-sent.');
    } catch (err) {
      setErrorMsg(mapAuthError(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSignOut = async () => {
    setBusy(true);
    await signOut(auth);
    setBusy(false);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-md"
      role="dialog"
      aria-modal="true"
      aria-label="CLIMORA Account"
    >
      <div className="chroma-surface chroma-surface-bright rounded-2xl w-full max-w-lg p-6 md:p-8 space-y-6 max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-bold chroma-text">
              {firebaseUser
                ? 'Account Management'
                : mode === 'register'
                  ? 'Create CLIMORA Account'
                  : mode === 'reset'
                    ? 'Reset Password'
                    : 'Sign In to CLIMORA'}
            </h2>
            <p className="text-xs text-slate-400 mt-1">
              {firebaseUser
                ? `Plan: ${account?.plan?.replace('_', ' ') ?? 'free'}`
                : 'Save locations worldwide, set severe weather alerts, and manage Pro.'}
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close modal"
            className="p-2 rounded-xl bg-white/5 hover:bg-white/10 text-slate-300 hover:text-white transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {errorMsg && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3.5 text-xs text-rose-200 leading-relaxed">
            {errorMsg}
          </div>
        )}

        {statusMsg && (
          <div className="rounded-xl border border-emerald-500/40 bg-emerald-500/10 p-3.5 text-xs text-emerald-200 flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 shrink-0 text-emerald-300" />
            <span>{statusMsg}</span>
          </div>
        )}

        {firebaseUser ? (
          <form onSubmit={handleProfileSave} className="space-y-4">
            <div className="flex items-center justify-between rounded-xl bg-white/5 border border-white/10 px-4 py-3 text-xs">
              <div className="flex items-center gap-2 text-slate-200">
                <ShieldCheck className="w-4 h-4 text-cyan-300" />
                <span>
                  {firebaseUser.emailVerified
                    ? 'Email Verified'
                    : 'Email Verification Pending'}
                </span>
              </div>
              {!firebaseUser.emailVerified && (
                <button
                  type="button"
                  onClick={handleResendVerification}
                  disabled={busy}
                  className="text-cyan-300 hover:text-cyan-200 underline underline-offset-4 whitespace-nowrap"
                >
                  Resend Link
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <label className="block space-y-1.5 text-xs text-slate-300">
                <span>Full Name</span>
                <input
                  type="text"
                  required
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  className="w-full rounded-xl bg-slate-900/90 border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </label>
              <label className="block space-y-1.5 text-xs text-slate-300">
                <span>Phone Number</span>
                <input
                  type="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+1 555 014 8821"
                  className="w-full rounded-xl bg-slate-900/90 border border-white/15 px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                />
              </label>
            </div>

            <label className="block space-y-1.5 text-xs text-slate-300">
              <span>Email Address</span>
              <input
                type="email"
                value={email}
                readOnly
                className="w-full rounded-xl bg-slate-900/50 border border-white/10 px-3.5 py-2.5 text-sm text-slate-400"
              />
            </label>

            <div className="grid grid-cols-3 gap-3">
              <label className="block space-y-1.5 text-xs text-slate-300">
                <span>Units</span>
                <select
                  value={unit}
                  onChange={(e) => setUnit(e.target.value as UnitSystem)}
                  className="w-full rounded-xl bg-slate-900/90 border border-white/15 px-3 py-2.5 text-sm text-white"
                >
                  <option value="metric">°C · km/h</option>
                  <option value="imperial">°F · mph</option>
                </select>
              </label>
              <label className="block space-y-1.5 text-xs text-slate-300">
                <span>Language</span>
                <select
                  value={lang}
                  onChange={(e) => setLang(e.target.value as LanguageCode)}
                  className="w-full rounded-xl bg-slate-900/90 border border-white/15 px-3 py-2.5 text-sm text-white"
                >
                  {Object.entries(LANGUAGE_LABELS).map(([k, v]) => (
                    <option key={k} value={k}>
                      {v}
                    </option>
                  ))}
                </select>
              </label>
              <label className="block space-y-1.5 text-xs text-slate-300">
                <span>Spectrum</span>
                <select
                  value={theme}
                  onChange={(e) => setTheme(e.target.value as ChromaTheme)}
                  className="w-full rounded-xl bg-slate-900/90 border border-white/15 px-3 py-2.5 text-sm text-white"
                >
                  <option value="aurora">Aurora</option>
                  <option value="prism">Prism</option>
                  <option value="solar">Solar</option>
                  <option value="oceanic">Oceanic</option>
                </select>
              </label>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                onClick={handleSignOut}
                disabled={busy}
                className="px-4 py-2.5 rounded-xl bg-white/5 hover:bg-rose-500/20 border border-white/10 text-xs font-semibold text-rose-200 inline-flex items-center gap-2 whitespace-nowrap"
              >
                <LogOut className="w-4 h-4" />
                <span>Log Out</span>
              </button>
              <button
                type="submit"
                disabled={busy}
                className="chroma-btn px-5 py-2.5 rounded-xl text-xs whitespace-nowrap"
              >
                {busy ? 'Saving...' : 'Save Account'}
              </button>
            </div>
          </form>
        ) : (
          <div className="space-y-5">
            {/* Mode Switcher */}
            <div className="grid grid-cols-3 gap-1 p-1 rounded-xl bg-white/5 border border-white/10 text-xs">
              <button
                type="button"
                onClick={() => {
                  setMode('login');
                  setErrorMsg(null);
                  setStatusMsg(null);
                }}
                className={`py-2 rounded-lg font-semibold transition-colors whitespace-nowrap ${
                  mode === 'login' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('register');
                  setErrorMsg(null);
                  setStatusMsg(null);
                }}
                className={`py-2 rounded-lg font-semibold transition-colors whitespace-nowrap ${
                  mode === 'register' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Register
              </button>
              <button
                type="button"
                onClick={() => {
                  setMode('reset');
                  setErrorMsg(null);
                  setStatusMsg(null);
                }}
                className={`py-2 rounded-lg font-semibold transition-colors whitespace-nowrap ${
                  mode === 'reset' ? 'bg-white/15 text-white' : 'text-slate-400 hover:text-white'
                }`}
              >
                Reset
              </button>
            </div>

            {mode === 'login' && (
              <form onSubmit={handleLoginSubmit} className="space-y-3.5">
                <label className="block space-y-1 text-xs text-slate-300">
                  <span>Email Address</span>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl bg-slate-900/90 border border-white/15 pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </label>
                <label className="block space-y-1 text-xs text-slate-300">
                  <span>Password</span>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full rounded-xl bg-slate-900/90 border border-white/15 pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="chroma-btn w-full py-2.5 rounded-xl text-sm whitespace-nowrap"
                >
                  {busy ? 'Signing in...' : 'Sign In'}
                </button>
              </form>
            )}

            {mode === 'register' && (
              <form onSubmit={handleRegisterSubmit} className="space-y-3.5">
                <label className="block space-y-1 text-xs text-slate-300">
                  <span>Full Name</span>
                  <div className="relative">
                    <UserIcon className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="text"
                      required
                      value={fullName}
                      onChange={(e) => setFullName(e.target.value)}
                      placeholder="Maya Lin"
                      className="w-full rounded-xl bg-slate-900/90 border border-white/15 pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </label>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <label className="block space-y-1 text-xs text-slate-300">
                    <span>Email Address</span>
                    <div className="relative">
                      <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="email"
                        required
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="w-full rounded-xl bg-slate-900/90 border border-white/15 pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </label>
                  <label className="block space-y-1 text-xs text-slate-300">
                    <span>Phone Number</span>
                    <div className="relative">
                      <Phone className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                      <input
                        type="tel"
                        required
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                        placeholder="+1 555 014 8821"
                        className="w-full rounded-xl bg-slate-900/90 border border-white/15 pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                      />
                    </div>
                  </label>
                </div>
                <label className="block space-y-1 text-xs text-slate-300">
                  <span>Password (min. 6 characters)</span>
                  <div className="relative">
                    <KeyRound className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="password"
                      required
                      minLength={6}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      placeholder="Create a secure password"
                      className="w-full rounded-xl bg-slate-900/90 border border-white/15 pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="chroma-btn w-full py-2.5 rounded-xl text-sm whitespace-nowrap"
                >
                  {busy ? 'Creating Account...' : 'Create Account'}
                </button>
              </form>
            )}

            {mode === 'reset' && (
              <form onSubmit={handleResetSubmit} className="space-y-3.5">
                <label className="block space-y-1 text-xs text-slate-300">
                  <span>Registered Email Address</span>
                  <div className="relative">
                    <Mail className="w-4 h-4 text-slate-400 absolute left-3.5 top-3" />
                    <input
                      type="email"
                      required
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      placeholder="you@example.com"
                      className="w-full rounded-xl bg-slate-900/90 border border-white/15 pl-10 pr-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-cyan-400"
                    />
                  </div>
                </label>
                <button
                  type="submit"
                  disabled={busy}
                  className="chroma-btn w-full py-2.5 rounded-xl text-sm whitespace-nowrap"
                >
                  {busy ? 'Sending Reset Link...' : 'Send Password Reset Email'}
                </button>
              </form>
            )}

            <div className="chroma-divider" />

            <button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={busy}
              className="w-full py-2.5 px-4 rounded-xl bg-white/10 hover:bg-white/15 border border-white/15 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2.5 whitespace-nowrap"
            >
              <span>Continue with Google</span>
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
