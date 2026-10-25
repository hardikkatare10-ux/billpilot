import { useState, useEffect } from "react";
import { Store, Eye, EyeOff } from "lucide-react";

export interface AuthSessionUser {
  username: string;
  shopName: string;
  phone: string;
  email?: string;
}

const STORAGE_KEY = "billpilot_local_account";
const isValidEmail = (value: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());

interface LocalAccount {
  username: string;
  email?: string;
  shopName: string;
  phone: string;
  passwordHash: string;
}

// Simple hash — not cryptographic, but fine for local device-only auth
function simpleHash(str: string): string {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = (hash << 5) - hash + char;
    hash = hash & hash;
  }
  return hash.toString(36);
}

function getStoredAccount(): LocalAccount | null {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function saveAccount(account: LocalAccount) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(account));
}

export default function AuthScreen({
  onAuthSuccess,
}: {
  onAuthSuccess: (user: AuthSessionUser) => void;
}) {
  const [account, setAccount] = useState<LocalAccount | null>(null);
  const [loading, setLoading] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");

  // Setup form (first launch only)
  const [setup, setSetup] = useState({
    username: "",
    email: "",
    shopName: "",
    phone: "",
    password: "",
    confirmPassword: "",
  });

  // Login form
  const [loginPassword, setLoginPassword] = useState("");

  useEffect(() => {
    const stored = getStoredAccount();
    setAccount(stored);
    setLoading(false);
  }, []);

  const handleSetup = () => {
    if (!setup.username.trim() || !isValidEmail(setup.email) || !setup.shopName.trim() || !setup.password) {
      setError("Please fill in all fields.");
      return;
    }
    if (setup.password !== setup.confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    if (setup.password.length < 4) {
      setError("Password must be at least 4 characters.");
      return;
    }

    const newAccount: LocalAccount = {
      username: setup.username.trim(),
      email: setup.email.trim().toLowerCase(),
      shopName: setup.shopName.trim(),
      phone: setup.phone.trim(),
      passwordHash: simpleHash(setup.password),
    };
    saveAccount(newAccount);
    setAccount(newAccount);
    onAuthSuccess({
      username: newAccount.username,
      email: newAccount.email,
      shopName: newAccount.shopName,
      phone: newAccount.phone,
    });
  };

  const handleLogin = () => {
    if (!account) return;
    if (!loginPassword) {
      setError("Enter your password.");
      return;
    }
    if (simpleHash(loginPassword) !== account.passwordHash) {
      setError("Incorrect password.");
      return;
    }
    setError("");
    onAuthSuccess({
      username: account.username,
      email: isValidEmail(account.email || "") ? account.email : undefined,
      shopName: account.shopName,
      phone: account.phone,
    });
  };

  const handleResetAccount = () => {
    if (
      confirm(
        "This will delete all saved account data on this device. Are you sure?"
      )
    ) {
      localStorage.removeItem(STORAGE_KEY);
      setAccount(null);
      setLoginPassword("");
      setError("");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0f2557] flex items-center justify-center">
        <div className="text-white text-sm opacity-60">Loading…</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0f2557] flex items-center justify-center p-4">
      <div className="bg-white rounded-3xl shadow-2xl w-full max-w-md overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-br from-[#1e40af] to-[#0f2557] p-8 text-white text-center">
          <div className="w-16 h-16 rounded-2xl bg-[#f59e0b] flex items-center justify-center mx-auto mb-4 shadow-lg">
            <Store className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold">Bill Pilot</h1>
          <p className="text-blue-200 text-sm mt-1">
            {account
              ? `Welcome back, ${account.shopName}`
              : "Set up your local account"}
          </p>
        </div>

        <div className="p-7 space-y-4">
          {account ? (
            /* ── Login screen ── */
            <>
              <div>
                <p className="text-sm text-muted-foreground mb-4">
                  This device is registered to{" "}
                  <span className="font-medium text-foreground">
                    {account.email || account.username}
                  </span>
                  . Enter your password to continue.
                </p>
              </div>

              <div>
                <label className="block text-xs font-medium text-muted-foreground mb-1">
                  Password
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={loginPassword}
                    onChange={(e) => {
                      setLoginPassword(e.target.value);
                      setError("");
                    }}
                    onKeyDown={(e) => e.key === "Enter" && handleLogin()}
                    placeholder="Enter your password"
                    className="w-full px-3.5 py-2.5 bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>

              {error && <p className="text-xs text-red-600">{error}</p>}

              <button
                onClick={handleLogin}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors"
              >
                Sign In
              </button>

              <button
                type="button"
                onClick={handleResetAccount}
                className="w-full py-2 text-xs text-muted-foreground hover:text-destructive transition-colors"
              >
                Reset device account
              </button>
            </>
          ) : (
            /* ── First-time setup screen ── */
            <>
              <p className="text-sm text-muted-foreground">
                No account found on this device. Set one up — your data stays
                here and is never sent anywhere.
              </p>

              {[
                {
                  label: "Your Name",
                  key: "username" as const,
                  placeholder: "e.g. Rahul",
                  type: "text",
                },
                {
                  label: "Email Address",
                  key: "email" as const,
                  placeholder: "you@example.com",
                  type: "email",
                },
                {
                  label: "Shop Name",
                  key: "shopName" as const,
                  placeholder: "e.g. Sharma Electronics",
                  type: "text",
                },
                {
                  label: "Phone (optional)",
                  key: "phone" as const,
                  placeholder: "10-digit number",
                  type: "tel",
                },
                {
                  label: "Password",
                  key: "password" as const,
                  placeholder: "Choose a password",
                  type: "password",
                },
                {
                  label: "Confirm Password",
                  key: "confirmPassword" as const,
                  placeholder: "Repeat password",
                  type: "password",
                },
              ].map(({ label, key, placeholder, type }) => (
                <div key={key} className={type === "password" ? "relative" : undefined}>
                  <label className="block text-xs font-medium text-muted-foreground mb-1">
                    {label}
                  </label>
                  <input
                    type={type === "password" && showPassword ? "text" : type}
                    value={setup[key]}
                    onChange={(e) => {
                      setSetup((s) => ({ ...s, [key]: e.target.value }));
                      setError("");
                    }}
                    placeholder={placeholder}
                    className={`w-full px-3.5 py-2.5 ${type === "password" ? "pr-10" : ""} bg-background border border-border rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-primary/30`}
                  />
                  {type === "password" && (
                    <button
                      type="button"
                      onClick={() => setShowPassword((visible) => !visible)}
                      aria-label={showPassword ? "Hide password" : "Show password"}
                      className="absolute right-3 top-[34px] text-muted-foreground hover:text-foreground"
                    >
                      {showPassword ? (
                        <EyeOff className="w-4 h-4" />
                      ) : (
                        <Eye className="w-4 h-4" />
                      )}
                    </button>
                  )}
                </div>
              ))}

              {error && <p className="text-xs text-red-600">{error}</p>}

              <button
                onClick={handleSetup}
                className="w-full py-3 bg-primary text-primary-foreground rounded-xl font-medium text-sm hover:bg-primary/90 transition-colors"
              >
                Create Local Account
              </button>

              <p className="text-xs text-muted-foreground text-center pt-1">
                🔒 All data is saved only on this device. No internet required.
              </p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
