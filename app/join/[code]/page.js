"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { ensureSession, friendlyError } from "../../../lib/auth";
import Footer from "../../../components/Footer";
import Brand from "../../../components/Brand";

export default function JoinPage() {
  const { code } = useParams();
  const router = useRouter();
  const [state, setState] = useState("loading"); // loading | ready | invalid | error
  const [problem, setProblem] = useState("");
  const [preview, setPreview] = useState(null);
  const [newName, setNewName] = useState("");
  const [confirmId, setConfirmId] = useState("");
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState("");

  function say(msg) {
    setToast(msg);
    setTimeout(() => setToast(""), 4200);
  }

  useEffect(() => {
    (async () => {
      try {
        await ensureSession();
        const { data, error } = await supabase.rpc("house_preview", { code: String(code) });
        if (error) throw error;
        if (!data) {
          setState("invalid");
          return;
        }
        if (data.already_member) {
          router.replace(`/house/${data.id}`);
          return;
        }
        setPreview(data);
        setState("ready");
      } catch (e) {
        setProblem(friendlyError(e));
        setState("error");
      }
    })();
  }, [code, router]);

  async function join(args) {
    setBusy(true);
    const { error } = await supabase.rpc("join_house", { code: String(code), ...args });
    setBusy(false);
    if (error) {
      say("Couldn't join. Try again.");
      return;
    }
    router.push(`/house/${preview.id}`);
  }

  function pickExisting(m) {
    if (m.claimed && confirmId !== m.id) {
      setConfirmId(m.id);
      return;
    }
    join({ claim_member: m.id });
  }

  function joinNew() {
    if (!newName.trim()) {
      say("Type your name first.");
      return;
    }
    join({ member_name: newName });
  }

  return (
    <main>
      <Brand />

      {state === "loading" && <div className="notice">Loading…</div>}
      {state === "error" && <div className="notice">{problem}</div>}
      {state === "invalid" && (
        <>
          <div className="empty">That invite link isn&apos;t valid. Ask your housemate to send it again.</div>
          <a className="mini" href="/">← Home</a>
        </>
      )}

      {state === "ready" && preview && (
        <>
          <section className="hero">
            <p className="label" style={{ margin: 0, color: "var(--muted)", fontWeight: 500 }}>You&apos;re invited to</p>
            <h1 className="title">{preview.name}</h1>
          </section>

          {preview.members.length > 0 && (
            <div className="panel">
              <h2>Which one are you?</h2>
              <div className="chips">
                {preview.members.map((m) => (
                  <button key={m.id} type="button" className="chip" disabled={busy} onClick={() => pickExisting(m)}>
                    {m.name}
                  </button>
                ))}
              </div>
              {confirmId ? (
                <p className="hint" style={{ marginTop: 10 }}>
                  That name is already in use on another phone or browser. If that&apos;s you on a new device, tap
                  the name again to take it over. The old device will lose access.
                </p>
              ) : (
                <p className="hint" style={{ marginTop: 10 }}>Not listed? Add yourself below.</p>
              )}
            </div>
          )}

          <div className="panel">
            <h2>I&apos;m new here</h2>
            <div className="inline" style={{ marginTop: 0 }}>
              <input
                className="field"
                placeholder="Your name"
                aria-label="Your name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && joinNew()}
              />
              <button type="button" className="mini solid" disabled={busy} onClick={joinNew}>Join</button>
            </div>
          </div>
        </>
      )}

      {toast && <div className="toast" role="status">{toast}</div>}
      <Footer />
    </main>
  );
}
