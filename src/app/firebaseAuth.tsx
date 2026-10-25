import { useEffect, useRef, useState, type ReactNode } from "react";
import { Store, Eye, EyeOff, Cloud, WifiOff } from "lucide-react";
import {
  onAuthStateChanged,
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword,
  sendPasswordResetEmail,
  signOut,
  type User,
} from "firebase/auth";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { auth, db } from "../lib/firebase";
import {
  hydrateFromCloud,
  flushPending,
  stopSync,
  clearLocalBusinessData,
} from "../lib/cloudSync";

export interface AuthSessionUser {
  username: string;
  shopName: string;
  phone: string;
}

interface AccountDoc extends AuthSessionUser {}

// Sign-up details are held here for the instant between "Firebase user created" and
// "account document written", because onAuthStateChanged fires in between.
let pendingAccount: AccountDoc | null = null;

const withTimeout = <T,>(p: Promise<T>, ms: number): Promise<T> =>
  Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error("timeout")), ms)),
  ]);

function friendlyError(e: unknown): string {
  const code = (e as { code?: string })?.code || "";
  switch (code) {
    case "auth/invalid-email": return "That email address doesn't look right.";
    case "auth/user-not-found":
    case "auth/wrong-password":
    case "auth/invalid-credential": return "Incorrect email or password.";
    case "auth/email-already-in-use": return "An account with this email already exists. Try signing in.";
    case "auth/weak-password": return "Password must be at least 6 characters.";
    case "auth/too-many-requests": return "Too many attempts. Please wait a few minutes and try again.";
    case "auth/network-request-failed": return "No internet connection. Check your network and try again.";
    case "auth/operation-not-allowed": return "Email/password sign-in is not enabled in your Firebase project yet.";
    default: return "Something went wrong. Please try again.";
  }
}

async function loadOrCreateAccount(user: User): Promise<AccountDoc> {
  const cacheKey = `bp_account_${user.uid}`;
  const fallback: AccountDoc = {
    username: user.displayName || user.email?.split("@")[0] || "Owner",
    shopName: "",
    phone: "",
  };
  try {
    const ref = doc(db!, "users", user.uid);
    const snap = await withTimeout(getDoc(ref), 10000);
    let account: AccountDoc;
    if (snap.exists()) {
      const d = snap.data() as Partial<AccountDoc>;
      account = {
        username: d.username || fallback.username,
        shopName: d.shopName || "",
        phone: d.phone || "",
      };
    } else {
      account = pendingAccount ?? fallback;
      await setDoc(ref, { ...account, email: user.email ?? "", createdAt: Date.now() });
    }
    pendingAccount = null;
    try { localStorage.setItem(cacheKey, JSON.stringify(account)); } catch { /* noop */ }
    return account;
  } catch {
    // Offline or slow: use what we cached last time on this device.
    try {
      const cached = localStorage.getItem(cacheKey);
      if (cached) return JSON.parse(cached) as AccountDoc;
    } catch { /* noop */ }
    return pendingAccount ?? fallback;
  }
}

type GateState = "loading" | "signedOut" | "hydrating" | "ready" | "syncError";

export default function FirebaseGate({
  children,
}: {
  children: (ctx: { user: AuthSessionUser; logout: () => Promise<void> }) => ReactNode;
}) {
  const [state, setState] = useState<GateState>("loading");
  const [user, setUser] = useState<AuthSessionUser | null>(null);
  const fbUserRef = useRef<User | null>(null);

  const bootstrap = async (fbUser: User, allowOffline = false) => {
    fbUserRef.current = fbUser;
    setState("hydrating");
    const account = await loadOrCreateAccount(fbUser);
    try {
      if (!allowOffline) await withTimeout(hydrateFromCloud(fbUser.uid), 15000);
    } catch (e) {
      console.warn("[firebase] initial sync failed:", e);
      setUser(account);
      setState("syncError");
      return;
    }
    setUser(account);
    setState("ready");
  };

  useEffect(() => {
    if (!auth) return;
    return onAuthStateChanged(auth, (fbUser) => {
      if (!fbUser) {
        stopSync();
        fbUserRef.current = null;
        setUser(null);
        setState("signedOut");
        return;
      }
      void bootstrap(fbUser);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const logout = async () => {
    const synced = await flushPending();
    if (
      !synced &&
      !window.confirm(
        "Some recent changes haven't been uploaded yet (you may be offline). " +
          "Signing out now will lose them from this device. Sign out anyway?"
      )
    ) {
      return;
    }
    stopSync();
    clearLocalBusinessData();
    await signOut(auth!);
  };

  if (state === "loading" || state === "hydrating") {
    return (
      <div className="min-h-screen bg-[#0f2557] flex flex-col items-center justify-center gap-3">
        <Cloud className="w-8 h-8 text-white/70 animate-pulse" />
        <div className="text-white text-sm opacity-70">
          {state === "hydrating" ? "Syncing your data…" : "Loading…"}
        </div>
      </div>
    );
  }

  if (state === "syncError") {
    return (
      <div className="min-h-screen bg-[#0f2557] flex items-center justify-center p-4">
        <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md p-8 text-center space-y-4">
          <WifiOff className="w-10 h-10 mx-auto text-amber-500" />
          <h2 className="text-lg font-semibold">Couldn't reach the cloud</h2>
          <p className="text-sm text-muted-foreground">
            Your latest data couldn't be downloaded. You can try again, or continue offline with
            the data already on this device — changes will upload when you're back online.
          </p>
          <button
            onClick={() => fbUserRef.current && void bootstrap(fbUserRef.current)}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90"
          >
            Try again
          </button>
          <button
            onClick={() => setState("ready")}
            className="w-full py-3 border border-border rounded-xl font-medium text-sm hover:bg-muted"
          >
            Continue offline
          </button>
          <button
            onClick={() => void logout()}
            className="w-full py-2 text-xs text-muted-foreground hover:text-destructive"
          >
            Sign out
          </button>
        </div>
      </div>
    );
  }

  if (state === "signedOut" || !user) {
    return <FirebaseAuthScreen />;
  }

  return <>{children({ user, logout })}</>;
}

function FirebaseAuthScreen() {
  const [mode, setMode] = useState<"signin" | "signup" | "reset">("signin");
  const [showPassword, setShowPassword] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [info, setInfo] = useState("");
  const [form, setForm] = useState({
    username: "",
    shopName: "",
    phone: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const set = (key: keyof typeof form, value: string) => {
    setForm((f) => ({ ...f, [key]: value }));
    setError("");
    setInfo("");
  };

  const submit = async () => {
    if (busy || !auth) return;
    setError("");
    setInfo("");
    const email = form.email.trim();

    if (!email) { setError("Enter your email address."); return; }

    if (mode === "reset") {
      setBusy(true);
      try {
        await sendPasswordResetEmail(auth, email);
        setInfo("If an account exists for that email, a reset link is on its way.");
      } catch (e) { setError(friendlyError(e)); }
      setBusy(false);
      return;
    }

    if (!form.password) { setError("Enter your password."); return; }

    if (mode === "signup") {
      if (!form.username.trim() || !form.shopName.trim()) { setError("Please fill in your name and shop name."); return; }
      if (form.password.length < 6) { setError("Password must be at least 6 characters."); return; }
      if (form.password !== form.confirmPassword) { setError("Passwords do not match."); return; }
    }

    setBusy(true);
    try {
      if (mode === "signup") {
        pendingAccount = {
          username: form.username.trim(),
          shopName: form.shopName.trim(),
          phone: form.phone.trim(),
        };
        await createUserWithEmailAndPassword(auth, email, form.password);
      } else {
        await signInWithEmailAndPassword(auth, email, form.password);
      }
      // onAuthStateChanged in FirebaseGate takes over from here.
    } catch (e) {
      pendingAccount = null;
      setError(friendlyError(e));
      setBusy(false);
    }
  };

  const inputCls =
    "w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30";

  const field = (
    label: string,
    key: keyof typeof form,
    type: string,
    placeholder: string
  ) => (
    <div key={key}>
      <label className="block text-xs font-medium text-muted-foreground mb-1">{label}</label>
      <input
        type={type}
        value={form[key]}
        onChange={(e) => set(key, e.target.value)}
        onKeyDown={(e) => e.key === "Enter" && void submit()}
        placeholder={placeholder}
        autoComplete={type === "password" ? (mode === "signup" ? "new-password" : "current-password") : key === "email" ? "email" : "off"}
        className={inputCls}
      />
    </div>
  );

  const subtitle =
    mode === "signup" ? "Create your cloud account" : mode === "reset" ? "Reset your password" : "Sign in to continue";

  return (
    <div className="min-h-screen bg-[#0f2557] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        <div className="bg-gradient-to-br from-[#1e40af] to-[#0f2557] p-8 text-white text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#f59e0b] flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Bill Pilot</h1>
          <p className="text-blue-200 text-sm mt-1">{subtitle}</p>
        </div>

        <div className="p-7 space-y-4">
          {mode === "signup" && (
            <>
              {field("Your Name", "username", "text", "e.g. Rahul")}
              {field("Shop Name", "shopName", "text", "e.g. Sharma Electronics")}
              {field("Phone (optional)", "phone", "tel", "10-digit number")}
            </>
          )}

          {field("Email", "email", "email", "you@example.com")}

          {mode !== "reset" && (
            <div>
              <label className="block text-xs font-medium text-muted-foreground mb-1">Password</label>
              <div className="relative">
                <input
                  type={showPassword ? "text" : "password"}
                  value={form.password}
                  onChange={(e) => set("password", e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && void submit()}
                  placeholder={mode === "signup" ? "At least 6 characters" : "Enter your password"}
                  autoComplete={mode === "signup" ? "new-password" : "current-password"}
                  className={inputCls + " pr-10"}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          )}

          {mode === "signup" && field("Confirm Password", "confirmPassword", "password", "Repeat password")}

          {error && <p className="text-xs text-red-600">{error}</p>}
          {info && <p className="text-xs text-green-700">{info}</p>}

          <button
            onClick={() => void submit()}
            disabled={busy}
            className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors disabled:opacity-60"
          >
            {busy
              ? "Please wait…"
              : mode === "signup"
              ? "Create Account"
              : mode === "reset"
              ? "Send Reset Link"
              : "Sign In"}
          </button>

          <div className="flex items-center justify-between text-xs pt-1">
            {mode === "signin" ? (
              <>
                <button type="button" onClick={() => { setMode("signup"); setError(""); setInfo(""); }} className="text-primary hover:underline">
                  Create an account
                </button>
                <button type="button" onClick={() => { setMode("reset"); setError(""); setInfo(""); }} className="text-muted-foreground hover:text-foreground">
                  Forgot password?
                </button>
              </>
            ) : (
              <button type="button" onClick={() => { setMode("signin"); setError(""); setInfo(""); }} className="text-primary hover:underline">
                ← Back to sign in
              </button>
            )}
          </div>

          <p className="text-xs text-muted-foreground text-center pt-1">
            ☁️ Your data is backed up to your account and works offline too.
          </p>
        </div>
      </div>
    </div>
  );
}
