import React from "react";

interface AuthScreenProps {
  authMode: "login" | "signup";
  setAuthMode: (mode: "login" | "signup") => void;
  authUsername: string;
  setAuthUsername: (v: string) => void;
  authPassword: string;
  setAuthPassword: (v: string) => void;
  authError: string;
  handleAuth: (e: React.FormEvent) => void;
}

export default function AuthScreen({
  authMode,
  setAuthMode,
  authUsername,
  setAuthUsername,
  authPassword,
  setAuthPassword,
  authError,
  handleAuth,
}: AuthScreenProps) {
  return (
    <div
      className="min-h-screen flex items-center justify-center bg-[#111315] p-4"
      style={{ fontFamily: "'Cabin', sans-serif", fontWeight: "500" }}
    >
      <div className="bg-[#1a1d21] rounded-2xl p-6 sm:p-10 max-w-md w-full text-center shadow-lg">
        <img src="/relay.png" alt="Relay" className="w-16 mx-auto mb-4" />
        <h1
          className="text-white text-3xl font-bold mb-2"
          style={{ fontFamily: "'Racing Sans One', cursive" }}
        >
          Relay
        </h1>
        <h2 className="text-white text-xl font-semibold mb-6">
          {authMode === "login" ? "Welcome back" : "Create account"}
        </h2>
        <form onSubmit={handleAuth} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Username"
            value={authUsername}
            onChange={(e) => setAuthUsername(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg bg-[#24272c] border border-[#2a2d33] text-white text-sm focus:outline-none focus:border-[#00cfff]"
          />
          <input
            type="password"
            placeholder="Password"
            value={authPassword}
            onChange={(e) => setAuthPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg bg-[#24272c] border border-[#2a2d33] text-white text-sm focus:outline-none focus:border-[#00cfff]"
          />
          {authError && (
            <p className="text-red-500 text-sm break-words">{authError}</p>
          )}
          <button
            type="submit"
            className="w-full py-3 bg-[#00cfff] text-[#111315] font-semibold rounded-lg hover:bg-[#00b5e6] transition"
          >
            {authMode === "login" ? "Log in" : "Sign up"}
          </button>
        </form>
        <p className="mt-4 text-gray-400 text-sm">
          {authMode === "login" ? (
            <>
              Don't have an account?{" "}
              <button
                onClick={() => setAuthMode("signup")}
                className="text-[#00cfff] underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => setAuthMode("login")}
                className="text-[#00cfff] underline"
              >
                Log in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
