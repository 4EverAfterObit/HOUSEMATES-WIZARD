"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../lib/supabaseClient";
import { ensureSession, friendlyError } from "../lib/auth";
import Footer from "../components/Footer";
import Brand from "../components/Brand";

export default function Home() {
  const router = useRouter();
  const [ready, setReady] = useState(false);
  const [problem, setProblem] = useState("");
  const [houses, setHouses] = useState([]);
  const [showStart, setShowStart] = useState(false);
  const [houseName, setHouseName] = useState("");
  const [yourName, setYourName] = useState("");
  const [cur, setCur] = useState("$");
  const [code, setCode] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  function say(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 4200);
  }

  useEffect(() => {
    (async () => {
      try {
        const user = await ensureSession();
        const { data, error } = await supabase
          .from("members")
          .select("house_id, houses(id, name)")
          .eq("user_id", user.id);
        if (error) throw error;
        setHouses(
          (data || [])
            .filter((r) => r.houses)
            .map((r) => ({ id: r.houses.id, name: r.houses.name }))
        );
        setReady(true);
      } catch (e) {
        setProblem(friendlyError(e));
      }
    })();
  }, []);

  async function startHouse() {
    if (!houseName.trim() || !yourName.trim()) {
      say("Add a house name and your name.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.rpc("create_house", {
      house_name: houseName,
      member_name: yourName,
      cur,
    });
    setBusy(false);
    if (error || !data) {
      say("Couldn't start the house. Try again.");
      return;
    }
    router.push(`/house/${data.id}`);
  }

  function openCode() {
    // Accepts a bare code or a whole pasted link.
    const raw = code.trim().replace(/\/+$/, "");
    const last = raw.split("/").pop();
    if (!last) return;
    router.push(`/join/${encodeURIComponent(last.toLowerCase())}`);
  }

  return (
    <main>
      <Brand size="large" />
      <section className="hero">
        <h1 className="title">Share the house, fairly.</h1>
        <p className="sub">Split bills, settle up, and take turns on the chores.</p>
      </section>

      {problem && <div className="notice">{problem}</div>}
      {!ready && !problem && <div className="notice">Connecting…</div>}

      {ready && (
        <>
          {!showStart ? (
            <button type="button" className="primary" onClick={() => setShowStart(true)}>
              Start a house
            </button>
          ) : (
            <div className="panel">
              <h2>Start a house</h2>
              <input
                className="field"
                placeholder="House name (e.g. 42 Elm St)"
                aria-label="House name"
                value={houseName}
                onChange={(e) => setHouseName(e.target.value)}
                style={{ marginBottom: 8 }}
              />
              <div className="grid2" style={{ gridTemplateColumns: "1fr 90px" }}>
                <input
                  className="field"
                  placeholder="Your name"
                  aria-label="Your name"
                  value={yourName}
                  onChange={(e) => setYourName(e.target.value)}
                />
                <select className="field" aria-label="Currency" value={cur} onChange={(e) => setCur(e.target.value)}>
                  <option>$</option>
                  <option>€</option>
                  <option>£</option>
                  <option>₹</option>
                  <option>¥</option>
                </select>
              </div>
              <p className="hint">You&apos;ll get a link to send your housemates next.</p>
              <button type="button" className="primary" disabled={busy} onClick={startHouse}>
                {busy ? "Starting…" : "Create house"}
              </button>
            </div>
          )}

          <div className="panel" style={{ marginTop: 16 }}>
            <label className="lab" htmlFor="code">Got an invite code or link?</label>
            <div className="inline" style={{ marginTop: 0 }}>
              <input
                id="code"
                className="field"
                placeholder="Paste it here"
                value={code}
                onChange={(e) => setCode(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && openCode()}
              />
              <button type="button" className="mini solid" onClick={openCode}>Open</button>
            </div>
          </div>

          <div className="sec"><h2>Your houses</h2></div>
          {houses.length ? (
            <div className="house-list">
              {houses.map((h) => (
                <a key={h.id} className="house-link" href={`/house/${h.id}`}>{h.name}</a>
              ))}
            </div>
          ) : (
            <div className="empty">Nothing here yet. Start a house, or open an invite from a housemate.</div>
          )}
        </>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
      <Footer />
    </main>
  );
}
