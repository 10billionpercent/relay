import React, { useState } from "react";
import { motion } from "framer-motion";

interface AuthPageProps {
  onAuth: (
    mode: "login" | "signup",
    username: string,
    password: string,
    setError: (e: string) => void,
  ) => void;
  onGuest: () => void;
}

const cardVariants = {
  hidden: { opacity: 0, y: 30, scale: 0.95 },
  visible: {
    opacity: 1,
    y: 0,
    scale: 1,
    transition: { duration: 0.5, ease: [0.25, 0.1, 0.25, 1] as const },
  },
};

const childVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.3 },
  }),
};

export default function AuthPage({ onAuth, onGuest }: AuthPageProps) {
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
      style={{ fontFamily: "'Radio Canada', sans-serif", fontWeight: "500" }}
    >
      <motion.div
        variants={cardVariants}
        initial="hidden"
        animate="visible"
        className="bg-[#1a1d21] rounded-2xl p-6 sm:p-10 max-w-md w-full text-center shadow-lg"
      >
        <motion.img
          src="/relay.png"
          alt="Relay"
          className="w-16 mx-auto mb-4"
          custom={0}
          variants={childVariants}
          initial="hidden"
          animate="visible"
        />
        <motion.h1
          className="text-white text-3xl font-bold mb-2"
          style={{ fontFamily: "'Racing Sans One', cursive" }}
          custom={1}
          variants={childVariants}
          initial="hidden"
          animate="visible"
        >
          Relay
        </motion.h1>
        <motion.h2
          className="text-white text-xl font-semibold mb-6"
          custom={2}
          variants={childVariants}
          initial="hidden"
          animate="visible"
        >
          {mode === "login" ? "Welcome back" : "Create account"}
        </motion.h2>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <motion.input
            type="text"
            placeholder="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg bg-[#24272c] border border-[#2a2d33] text-white text-sm focus:outline-none focus:border-[#00cfff]"
            custom={3}
            variants={childVariants}
            initial="hidden"
            animate="visible"
          />
          <motion.input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            className="w-full px-4 py-3 rounded-lg bg-[#24272c] border border-[#2a2d33] text-white text-sm focus:outline-none focus:border-[#00cfff]"
            custom={4}
            variants={childVariants}
            initial="hidden"
            animate="visible"
          />
          {error && (
            <motion.p
              className="text-red-500 text-sm"
              custom={5}
              variants={childVariants}
              initial="hidden"
              animate="visible"
            >
              {error}
            </motion.p>
          )}
          <motion.button
            type="submit"
            className="w-full py-3 bg-[#00cfff] text-[#111315] font-semibold rounded-lg hover:bg-[#00b5e6] transition"
            custom={error ? 6 : 5}
            variants={childVariants}
            initial="hidden"
            animate="visible"
          >
            {mode === "login" ? "Log in" : "Sign up"}
          </motion.button>
        </form>

        <motion.p
          className="mt-4 text-gray-400 text-sm"
          custom={7}
          variants={childVariants}
          initial="hidden"
          animate="visible"
        >
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
        </motion.p>

        <motion.button
          onClick={onGuest}
          className="mt-4 w-full py-3 bg-[#24272c] text-white font-semibold rounded-lg hover:bg-[#2a2d33] transition"
          custom={8}
          variants={childVariants}
          initial="hidden"
          animate="visible"
        >
          Continue as Guest
        </motion.button>
      </motion.div>
    </div>
  );
}
