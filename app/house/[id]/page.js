"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabaseClient";
import { ensureSession, friendlyError } from "../../../lib/auth";
import { computeNet, transfers, fmt, fmtDate, ago } from "../../../lib/money";
import MoneyForm from "../../../components/MoneyForm";
import MsgBox from "../../../components/MsgBox";
import Footer from "../../../components/Footer";
import Brand from "../../../components/Brand";

export default function HousePage() {
  const { id } = useParams();
  const router = useRouter();

  const [status, setStatus] = useState("loading"); // loading | ready | away | error
  const [problem, setProblem] = useState("");
  const [userId, setUserId] = useState(null);
  const [house, setHouse] = useState(null);
  const [members, setMembers] = useState([]);
  const [expenses, setExpenses] = useState([]);
  const [payments, setPayments] = useState([]);
  const [chores, setChores] = useState([]);
  const [completions, setCompletions] = useState([]);
  const [tab, setTab] = useState("money");
  const [toast, setToast] = useState("");
  const [armed, setArmed] = useState("");
  const [showInvite, setShowInvite] = useState(false);
  const [newMember, setNewMember] = useState("");
  const [choreTitle, setChoreTitle] = useState("");
  const [choreAssign, setChoreAssign] = useState("");
  const [choreFreq, setChoreFreq] = useState("Weekly");

  const channelRef = useRef(null);
  const toastTimer = useRef(null);
  const armTimer = useRef(null);
  const loadTimer = useRef(null);

  function say(msg) {
    setToast(msg);
    clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(""), 4200);
  }

  // Two-tap confirm: first tap arms the button, second tap does it.
  function confirmTap(key) {
    if (armed === key) {
      setArmed("");
      return true;
    }
    setArmed(key);
    clearTimeout(armTimer.current);
    armTimer.current = setTimeout(() => setArmed(""), 3500);
    return false;
  }

  // ---------- loading ----------
  const load = useCallback(
    async (uid) => {
      const [h, m, e, p, c, cc] = await Promise.all([
        supabase.from("houses").select("id,name,currency,invite_code").eq("id", id).maybeSingle(),
        supabase.from("members").select("id,name,user_id,created_at").eq("house_id", id).order("created_at"),
        supabase
          .from("expenses")
          .select("id,payer_id,amount_cents,note,created_at,expense_splits(member_id,share_cents)")
          .eq("house_id", id)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("payments")
          .select("id,from_id,to_id,amount_cents,created_at")
          .eq("house_id", id)
          .order("created_at", { ascending: false })
          .limit(1000),
        supabase
          .from("chores")
          .select("id,title,frequency,assignee_id,last_done_by,last_done_at,created_at")
          .eq("house_id", id)
          .order("created_at"),
        supabase.from("chore_completions").select("chore_id,member_id"),
      ]);
      const firstErr = [h, m, e, p, c, cc].find((r) => r.error);
      if (firstErr) throw firstErr.error;

      if (!h.data) {
        setStatus("away");
        return;
      }
      const ms = (m.data || []).slice().sort(
        (a, b) => new Date(a.created_at) - new Date(b.created_at) || String(a.name).localeCompare(String(b.name))
      );
      const uidToUse = uid || userId;
      if (!ms.some((x) => x.user_id === uidToUse)) {
        setStatus("away");
        return;
      }
      const choreIds = new Set((c.data || []).map((x) => x.id));
      setHouse(h.data);
      setMembers(ms);
      setExpenses(e.data || []);
      setPayments(p.data || []);
      setChores(c.data || []);
      setCompletions((cc.data || []).filter((x) => choreIds.has(x.chore_id)));
      setStatus("ready");
    },
    [id, userId]
  );

  const loadRef = useRef(load);
  loadRef.current = load;

  function scheduleLoad() {
    clearTimeout(loadTimer.current);
    loadTimer.current = setTimeout(() => {
      loadRef.current().catch(() => {});
    }, 250);
  }

  // Tell everyone else in the house something changed.
  function notify() {
    if (channelRef.current) {
      channelRef.current.send({ type: "broadcast", event: "changed", payload: {} });
    }
  }

  async function refreshAndNotify() {
    try {
      await loadRef.current();
    } catch {
      /* ignore */
    }
    notify();
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const user = await ensureSession();
        if (cancelled) return;
        setUserId(user.id);
        await load(user.id);
      } catch (e) {
        if (!cancelled) {
          setProblem(friendlyError(e));
          setStatus("error");
        }
      }
    })();

    const channel = supabase
      .channel(`house-${id}`)
      .on("broadcast", { event: "changed" }, () => scheduleLoad())
      .subscribe();
    channelRef.current = channel;

    const onVisible = () => {
      if (document.visibilityState === "visible") scheduleLoad();
    };
    document.addEventListener("visibilitychange", onVisible);
    const poll = setInterval(() => {
      if (document.visibilityState === "visible") scheduleLoad();
    }, 30000);

    return () => {
      cancelled = true;
      clearInterval(poll);
      document.removeEventListener("visibilitychange", onVisible);
      clearTimeout(loadTimer.current);
      supabase.removeChannel(channel);
      channelRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // ---------- derived ----------
  const cur = house ? house.currency : "$";
  const me = useMemo(() => members.find((m) => m.user_id === userId) || null, [members, userId]);
  const meId = me ? me.id : "";
  const nameOf = (mid) => {
    const m = members.find((x) => x.id === mid);
    return m ? m.name : "Someone";
  };
  const net = useMemo(() => computeNet(members, expenses, payments), [members, expenses, payments]);
  const allTransfers = useMemo(() => transfers(net), [net]);
  const myTransfers = allTransfers.filter((t) => t.from === meId || t.to === meId);
  const myNet = net[meId] || 0;

  const sortedTransfers = allTransfers.slice().sort((a, b) => {
    const am = a.from === meId || a.to === meId ? 0 : 1;
    const bm = b.from === meId || b.to === meId ? 0 : 1;
    return am - bm || b.amt - a.amt;
  });

  const activity = useMemo(() => {
    const list = [
      ...expenses.map((e) => ({ kind: "expense", ...e })),
      ...payments.map((p) => ({ kind: "payment", ...p })),
    ];
    list.sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
    return list;
  }, [expenses, payments]);

  const usedMembers = useMemo(() => {
    const used = new Set();
    expenses.forEach((e) => {
      used.add(e.payer_id);
      (e.expense_splits || []).forEach((s) => used.add(s.member_id));
    });
    payments.forEach((p) => {
      used.add(p.from_id);
      used.add(p.to_id);
    });
    chores.forEach((c) => {
      if (c.assignee_id) used.add(c.assignee_id);
      if (c.last_done_by) used.add(c.last_done_by);
    });
    completions.forEach((c) => used.add(c.member_id));
    return used;
  }, [expenses, payments, chores, completions]);

  const doneCounts = useMemo(() => {
    const counts = {};
    completions.forEach((c) => {
      counts[c.member_id] = (counts[c.member_id] || 0) + 1;
    });
    return counts;
  }, [completions]);

  function nextAfter(mid) {
    if (!members.length) return null;
    const i = members.findIndex((m) => m.id === mid);
    return members[(i + 1) % members.length].id;
  }

  function describe(e) {
    if (e.kind === "payment") {
      return { t: `${nameOf(e.from_id)} paid ${nameOf(e.to_id)}`, amt: e.amount_cents, meta: "Payment" };
    }
    const splits = e.expense_splits || [];
    const note = e.note ? ` · ${e.note}` : "";
    if (splits.length === 1 && splits[0].member_id !== e.payer_id) {
      return { t: `${nameOf(e.payer_id)} lent ${nameOf(splits[0].member_id)}${note}`, amt: e.amount_cents, meta: "Loan" };
    }
    const vals = splits.map((s) => s.share_cents);
    const even = vals.length > 0 && Math.max(...vals) - Math.min(...vals) <= 1;
    const meta = even
      ? `Split ${splits.length} ways`
      : "Split: " + splits.map((s) => `${nameOf(s.member_id)} ${fmt(cur, s.share_cents)}`).join(", ");
    return { t: `${nameOf(e.payer_id)} paid${note}`, amt: e.amount_cents, meta };
  }

  // ---------- actions ----------
  async function run(promise, okMsg) {
    const { error } = await promise;
    if (error) {
      say("Couldn't save. Try again in a moment.");
      return false;
    }
    await refreshAndNotify();
    if (okMsg) say(okMsg);
    return true;
  }

  async function submitMoney(kind, payload) {
    if (kind === "expense") {
      return run(
        supabase.rpc("add_expense", {
          h: id,
          payer: payload.payer,
          amount: payload.amount,
          note: payload.note,
          splits: payload.splits,
        }),
        "Added."
      );
    }
    return run(
      supabase.from("payments").insert({
        house_id: id,
        from_id: payload.from,
        to_id: payload.to,
        amount_cents: payload.amount,
      }),
      "Added."
    );
  }

  function markPaid(t) {
    return run(
      supabase.from("payments").insert({ house_id: id, from_id: t.from, to_id: t.to, amount_cents: t.amt }),
      "Marked paid."
    );
  }

  function deleteEntry(e) {
    if (!confirmTap("del-" + e.kind + e.id)) return;
    return run(supabase.from(e.kind === "expense" ? "expenses" : "payments").delete().eq("id", e.id));
  }

  async function addMember() {
    const name = newMember.trim();
    if (!name) return;
    if (members.some((m) => m.name.toLowerCase() === name.toLowerCase())) {
      say(`${name} is already in the house.`);
      return;
    }
    const ok = await run(supabase.from("members").insert({ house_id: id, name }));
    if (ok) setNewMember("");
  }

  function removeMember(m) {
    if (!confirmTap("rm-" + m.id)) return;
    return run(supabase.from("members").delete().eq("id", m.id));
  }

  function setCurrency(v) {
    return run(supabase.from("houses").update({ currency: v }).eq("id", id));
  }

  async function addChore() {
    const title = choreTitle.trim();
    if (!title) {
      say("Name the chore first.");
      return;
    }
    if (!members.length) return;
    const ok = await run(
      supabase.from("chores").insert({
        house_id: id,
        title,
        frequency: choreFreq,
        assignee_id: choreAssign || members[0].id,
      })
    );
    if (ok) setChoreTitle("");
  }

  async function choreDone(c) {
    if (!meId) return;
    const nxt = nextAfter(c.assignee_id);
    const ins = await supabase.from("chore_completions").insert({ chore_id: c.id, member_id: meId });
    if (ins.error) {
      say("Couldn't save. Try again in a moment.");
      return;
    }
    await run(
      supabase
        .from("chores")
        .update({ last_done_by: meId, last_done_at: new Date().toISOString(), assignee_id: nxt })
        .eq("id", c.id),
      `Done. Next up: ${nameOf(nxt)}.`
    );
  }

  function choreSkip(c) {
    return run(supabase.from("chores").update({ assignee_id: nextAfter(c.assignee_id) }).eq("id", c.id));
  }

  function choreDelete(c) {
    if (!confirmTap("chore-" + c.id)) return;
    return run(supabase.from("chores").delete().eq("id", c.id));
  }

  async function clearAll() {
    if (!confirmTap("clear")) return;
    const results = await Promise.all([
      supabase.from("expenses").delete().eq("house_id", id),
      supabase.from("payments").delete().eq("house_id", id),
      supabase.from("chores").delete().eq("house_id", id),
    ]);
    if (results.some((r) => r.error)) {
      say("Couldn't clear everything. Try again.");
      return;
    }
    await refreshAndNotify();
    say("Bills and chores cleared.");
  }

  async function deleteHouse() {
    if (!confirmTap("deleteHouse")) return;
    const { error } = await supabase.from("houses").delete().eq("id", id);
    if (error) {
      say("Couldn't delete the house.");
      return;
    }
    notify();
    router.push("/");
  }

  // ---------- render ----------
  if (status === "loading") {
    return (
      <main>
        <Brand />
        <div className="notice">Connecting to the house…</div>
        <Footer />
      </main>
    );
  }
  if (status === "error") {
    return (
      <main>
        <Brand />
        <div className="notice">{problem}</div>
        <Footer />
      </main>
    );
  }
  if (status === "away") {
    return (
      <main>
        <a className="mini" href="/">← Your houses</a>
        <div className="empty">
          This house isn&apos;t available on this phone or browser. Open the invite link your housemate sent to
          get back in.
        </div>
        <Footer />
      </main>
    );
  }

  const inviteLink = typeof window !== "undefined" ? `${window.location.origin}/join/${house.invite_code}` : "";
  const inviteText = `Join "${house.name}" on Housemates Wizard to split bills and share chores: ${inviteLink}`;

  const heroLabel = myNet > 0 ? "You're owed" : myNet < 0 ? "You owe" : "All square";
  const heroClass = myNet > 0 ? "net pos" : myNet < 0 ? "net neg" : "net";
  const heroSub =
    myNet === 0
      ? "Nothing to settle with anyone."
      : `${myTransfers.length} ${myTransfers.length === 1 ? "person" : "people"} to settle with.`;

  return (
    <main>
      <Brand />
      <a className="mini" href="/">← Your houses</a>

      <section className="hero">
        <p className="label">{house.name}</p>
        <h1 className={heroClass} aria-live="polite">{fmt(cur, myNet)}</h1>
        <p className="sub">{heroLabel} · {heroSub}</p>
      </section>

      <div className="panel">
        <button type="button" className="mini solid" onClick={() => setShowInvite(!showInvite)}>
          {showInvite ? "Hide invite" : "Invite housemates"}
        </button>
        {showInvite && (
          <div style={{ marginTop: 10 }}>
            <p className="hint">Send this to your housemates. They tap the link and pick their name.</p>
            <MsgBox text={inviteText} subject={`Join ${house.name}`} onToast={say} />
          </div>
        )}
      </div>

      <div className="tabs" role="tablist" aria-label="Sections">
        <button type="button" role="tab" aria-selected={tab === "money"} onClick={() => setTab("money")}>Money</button>
        <button type="button" role="tab" aria-selected={tab === "chores"} onClick={() => setTab("chores")}>Chores</button>
      </div>

      {tab === "money" && (
        <section>
          <MoneyForm members={members} meId={meId} cur={cur} onSubmit={submitMoney} />

          <div className="sec"><h2>Who owes what</h2></div>
          <div className="list">
            {!sortedTransfers.length ? (
              <div className="empty">Everyone is settled up.</div>
            ) : (
              sortedTransfers.map((t) => {
                const toMe = t.to === meId;
                const fromMe = t.from === meId;
                const text = toMe
                  ? `${nameOf(t.from)} owes you`
                  : fromMe
                  ? `You owe ${nameOf(t.to)}`
                  : `${nameOf(t.from)} owes ${nameOf(t.to)}`;
                return (
                  <div key={t.from + t.to}>
                    <div className="li">
                      <span className="t">{text}</span>
                      <span className={"amt " + (toMe ? "pos" : fromMe ? "neg" : "")}>{fmt(cur, t.amt)}</span>
                    </div>
                    <div className="acts">
                      <button type="button" className="mini" onClick={() => markPaid(t)}>Mark paid</button>
                    </div>
                  </div>
                );
              })
            )}
          </div>

          <div className="sec">
            <h2>Activity</h2>
            <span>{activity.length ? `${activity.length} ${activity.length === 1 ? "entry" : "entries"}` : ""}</span>
          </div>
          <div className="list">
            {!activity.length ? (
              <div className="empty">Nothing yet. Split the first bill above.</div>
            ) : (
              activity.slice(0, 40).map((e) => {
                const d = describe(e);
                const key = e.kind + e.id;
                return (
                  <div key={key}>
                    <div className="li">
                      <span className="t">{d.t}</span>
                      <span className="amt">{fmt(cur, d.amt)}</span>
                    </div>
                    <div className="meta">{fmtDate(e.created_at)} · {d.meta}</div>
                    <div className="acts">
                      <button type="button" className="mini quiet" onClick={() => deleteEntry(e)}>
                        {armed === "del-" + key ? "Tap again to delete" : "Delete"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      {tab === "chores" && (
        <section>
          <div className="panel">
            <h2>New chore</h2>
            <input
              className="field"
              placeholder="What needs doing? (bins, dishes, bathroom)"
              aria-label="Chore"
              value={choreTitle}
              onChange={(e) => setChoreTitle(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && addChore()}
              style={{ marginBottom: 8 }}
            />
            <div className="grid2b">
              <div>
                <label className="lab" htmlFor="eAssign">Starts with</label>
                <select
                  className="field"
                  id="eAssign"
                  value={choreAssign || (members[0] ? members[0].id : "")}
                  onChange={(e) => setChoreAssign(e.target.value)}
                >
                  {members.map((m) => (
                    <option key={m.id} value={m.id}>{m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="lab" htmlFor="eFreq">How often</label>
                <select className="field" id="eFreq" value={choreFreq} onChange={(e) => setChoreFreq(e.target.value)}>
                  <option>Daily</option>
                  <option>Weekly</option>
                  <option>Monthly</option>
                  <option>As needed</option>
                </select>
              </div>
            </div>
            <p className="hint">Each time someone marks it done, the turn passes to the next housemate.</p>
            <button type="button" className="primary" onClick={addChore}>Add chore</button>
          </div>

          <div className="chips" aria-label="Chores done so far">
            {members
              .filter((m) => doneCounts[m.id])
              .map((m) => (
                <span key={m.id} className="chip tally">{m.name} <b>{doneCounts[m.id]}</b> done</span>
              ))}
          </div>

          <div className="sec"><h2>Whose turn</h2></div>
          <div className="list">
            {!chores.length ? (
              <div className="empty">No chores yet. Add one above.</div>
            ) : (
              chores.map((c) => {
                const mine = c.assignee_id === meId;
                const hasTurn = members.some((m) => m.id === c.assignee_id);
                const who = hasTurn ? (mine ? "Your turn" : `${nameOf(c.assignee_id)}'s turn`) : "No one's turn yet";
                const last = c.last_done_at
                  ? `Last done by ${nameOf(c.last_done_by)} ${ago(c.last_done_at)}`
                  : "Not done yet";
                return (
                  <div key={c.id}>
                    <div className="li">
                      <span className="t">{c.title}</span>
                      <span className={"turn" + (mine ? " mine" : "")}>{who}</span>
                    </div>
                    <div className="meta">{c.frequency} · {last}</div>
                    <div className="acts">
                      <button type="button" className="mini solid" onClick={() => choreDone(c)}>I did it</button>
                      <button type="button" className="mini" onClick={() => choreSkip(c)}>Skip turn</button>
                      <button type="button" className="mini quiet" onClick={() => choreDelete(c)}>
                        {armed === "chore-" + c.id ? "Tap again to delete" : "Delete"}
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </section>
      )}

      <section className="panel" style={{ marginTop: 28 }}>
        <h2>Housemates</h2>
        <div>
          {members.map((m) => (
            <div className="mrow" key={m.id}>
              <span>
                {m.name}
                {m.id === meId && <span className="share"> (you)</span>}
                {m.id !== meId && !m.user_id && <span className="share"> · hasn&apos;t joined yet</span>}
              </span>
              <span>
                {!usedMembers.has(m.id) && m.id !== meId && (
                  <button type="button" className="mini quiet" onClick={() => removeMember(m)}>
                    {armed === "rm-" + m.id ? "Tap again to remove" : "Remove"}
                  </button>
                )}
              </span>
            </div>
          ))}
        </div>
        <div className="inline">
          <input
            className="field"
            placeholder="Add a housemate"
            aria-label="Housemate name"
            autoComplete="off"
            value={newMember}
            onChange={(e) => setNewMember(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && addMember()}
          />
          <button type="button" className="mini solid" onClick={addMember}>Add</button>
        </div>
        <p className="hint" style={{ marginTop: 8 }}>
          Adding someone here lets you split bills with them before they join. When they open the invite link, they
          tap their name.
        </p>

        <div style={{ marginTop: 14, display: "flex", alignItems: "center", gap: 8 }}>
          <label htmlFor="cur" className="hint" style={{ margin: 0 }}>Currency</label>
          <select
            className="field"
            id="cur"
            style={{ width: "auto" }}
            value={cur}
            onChange={(e) => setCurrency(e.target.value)}
          >
            <option>$</option>
            <option>€</option>
            <option>£</option>
            <option>₹</option>
            <option>¥</option>
          </select>
        </div>

        <div style={{ marginTop: 14, display: "flex", gap: 6, flexWrap: "wrap" }}>
          <button type="button" className="mini quiet" onClick={clearAll}>
            {armed === "clear" ? "Tap again to clear all bills and chores" : "Clear bills and chores"}
          </button>
          <button type="button" className="mini quiet" onClick={deleteHouse}>
            {armed === "deleteHouse" ? "Tap again to delete for everyone" : "Delete this house"}
          </button>
        </div>
      </section>

      <p className="foot">Everyone in the house sees the same tab, live.</p>

      {toast && <div className="toast" role="status">{toast}</div>}
      <Footer />
    </main>
  );
}
