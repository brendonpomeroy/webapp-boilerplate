import { useEffect, useState } from "react";

// In dev, requests to /api are proxied to the Hono server (see vite.config.ts).
// In production, set VITE_API_URL to your deployed API's URL.
const API_URL = import.meta.env.VITE_API_URL ?? "";

export default function App() {
  const [message, setMessage] = useState("loading…");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`${API_URL}/api/hello?name=Railway`)
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((data: { message: string }) => setMessage(data.message))
      .catch((err: Error) => setError(err.message));
  }, []);

  return (
    <main style={{ fontFamily: "system-ui, sans-serif", padding: "2rem" }}>
      <h1>ai-test</h1>
      <p>Vite + React talking to a Hono API.</p>
      <p>
        API says: <strong>{error ? `error: ${error}` : message}</strong>
      </p>
    </main>
  );
}
