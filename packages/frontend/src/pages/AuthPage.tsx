import React, { useState } from "react";

interface AuthPageProps {
  onAuth: (
    mode: "login" | "signup",
    username: string,
    password: string,
    setError: (e: string) => void,
  ) => void;
}

export default function AuthPage({ onAuth }: AuthPageProps) {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onAuth(mode, username, password, setError);
  };

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
          {mode === "login" ? "Welcome back" : "Create account"}
        </h2>
        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg bg-[#24272c] border border-[#2a2d33] text-white text-sm focus:outline-none focus:border-[#00cfff]"
          />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg bg-[#24272c] border border-[#2a2d33] text-white text-sm focus:outline-none focus:border-[#00cfff]"
          />
          {error && <p className="text-red-500 text-sm">{error}</p>}
          <button
            type="submit"
            className="w-full py-3 bg-[#00cfff] text-[#111315] font-semibold rounded-lg hover:bg-[#00b5e6] transition"
          >
            {mode === "login" ? "Log in" : "Sign up"}
          </button>
        </form>
        <p className="mt-4 text-gray-400 text-sm">
          {mode === "login" ? (
            <>
              Don't have an account?{" "}
              <button
                onClick={() => setMode("signup")}
                className="text-[#00cfff] underline"
              >
                Sign up
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                onClick={() => setMode("login")}
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
