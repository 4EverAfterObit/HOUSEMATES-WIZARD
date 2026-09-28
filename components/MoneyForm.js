"use client";

import { useState } from "react";
import { toCents, dec, fmt, equalShares } from "../lib/money";

// The "Add to the tab" panel: split a bill, lend/borrow, or record a payment.
// onSubmit(kind, payload) returns a promise that resolves true when saved.
export default function MoneyForm({ members, meId, cur, onSubmit }) {
  const [mode, setMode] = useState(null);
  const [f, setF] = useState(null);
  const [err, setErr] = useState("");
  const [saving, setSaving] = useState(false);

  function fresh(m) {
    const parts = {}; // anyone not set to false counts as included
    const me = meId || (members[0] ? members[0].id : "");
    const other = members.find((x) => x.id !== me);
    return {
      payer: me,
      amount: "",
      note: "",
      parts,
      custom: false,
      cust: {},
      lender: me,
      borrower: other ? other.id : "",
      from: me,
      to: other ? other.id : "",
    };
  }

  function open(m) {
    setErr("");
    if (mode === m) {
      setMode(null);
      setF(null);
      return;
    }
    setMode(m);
    setF(fresh(m));
  }

  function set(patch) {
    setF((prev) => ({ ...prev, ...patch }));
  }

  const chosen = f ? members.filter((x) => f.parts[x.id] !== false).map((x) => x.id) : [];
  const totalCents = f ? (isNaN(toCents(f.amount)) ? 0 : toCents(f.amount)) : 0;

  function toggleCustom(on) {
    if (on) {
      const sh = equalShares(totalCents, chosen);
      const cust = {};
      Object.keys(sh).forEach((k) => {
        cust[k] = dec(sh[k]);
      });
      set({ custom: true, cust });
    } else {
      set({ custom: false });
    }
  }

  async function submit() {
    setErr("");
    const total = toCents(f.amount);
    if (isNaN(total)) return setErr("Enter an amount greater than zero.");

    let kind;
    let payload;
    if (mode === "split") {
      if (!chosen.length) return setErr("Pick at least one person to split with.");
      let splits;
      if (f.custom) {
        splits = {};
        let sum = 0;
        let bad = false;
        chosen.forEach((id) => {
          const c = toCents(f.cust[id] || "");
          if (isNaN(c)) bad = true;
          else {
            splits[id] = c;
            sum += c;
          }
        });
        if (bad) return setErr("Enter a share for each person, or untick them.");
        if (sum !== total) return setErr("Shares must add up to " + fmt(cur, total) + ".");
      } else {
        splits = equalShares(total, chosen);
      }
      kind = "expense";
      payload = { payer: f.payer, amount: total, note: f.note.trim(), splits };
    } else if (mode === "lend") {
      if (!f.lender || !f.borrower || f.lender === f.borrower) return setErr("Pick two different people.");
      kind = "expense";
      payload = { payer: f.lender, amount: total, note: f.note.trim(), splits: { [f.borrower]: total } };
    } else {
      if (!f.from || !f.to || f.from === f.to) return setErr("Pick two different people.");
      kind = "payment";
      payload = { from: f.from, to: f.to, amount: total };
    }

    setSaving(true);
    const ok = await onSubmit(kind, payload);
    setSaving(false);
    if (ok) {
      setMode(null);
      setF(null);
    }
  }

  const sel = (value, onChange, id) => (
    <select className="field" id={id} value={value} onChange={(e) => onChange(e.target.value)}>
      {members.map((m) => (
        <option key={m.id} value={m.id}>{m.name}</option>
      ))}
    </select>
  );

  const shares = f && mode === "split" && !f.custom ? equalShares(totalCents, chosen) : {};
  let shareNote = "";
  if (f && mode === "split") {
    if (!f.custom) {
      shareNote = chosen.length ? "" : "Pick at least one person.";
    } else {
      let sum = 0;
      chosen.forEach((id) => {
        const c = toCents(f.cust[id] || "");
        if (!isNaN(c)) sum += c;
      });
      const left = totalCents - sum;
      shareNote =
        left === 0 && totalCents > 0
          ? "Shares add up."
          : left > 0
          ? "Left to assign: " + fmt(cur, left)
          : "Over by " + fmt(cur, -left);
    }
  }

  return (
    <div className="panel">
      <h2>Add to the tab</h2>
      <div className="modes" role="group" aria-label="What to add">
        <button type="button" className="mini" aria-pressed={mode === "split"} onClick={() => open("split")}>Split a bill</button>
        <button type="button" className="mini" aria-pressed={mode === "lend"} onClick={() => open("lend")}>Lend or borrow</button>
        <button type="button" className="mini" aria-pressed={mode === "pay"} onClick={() => open("pay")}>Record a payment</button>
      </div>

      {f && (
        <div className="form">
          {mode === "split" && (
            <>
              <div className="grid2">
                <div>
                  <label className="lab" htmlFor="fPayer">Paid by</label>
                  {sel(f.payer, (v) => set({ payer: v }), "fPayer")}
                </div>
                <div>
                  <label className="lab" htmlFor="fAmt">Total</label>
                  <input
                    className="field"
                    id="fAmt"
                    inputMode="decimal"
                    placeholder="0.00"
                    value={f.amount}
                    onChange={(e) => set({ amount: e.target.value })}
                  />
                </div>
              </div>
              <input
                className="field"
                placeholder="What for? (rent, groceries, internet)"
                aria-label="What for"
                value={f.note}
                onChange={(e) => set({ note: e.target.value })}
                style={{ marginBottom: 10 }}
              />
              <label className="lab">Split between</label>
              {members.map((m) => {
                const on = f.parts[m.id] !== false;
                return (
                  <div className="prow" key={m.id}>
                    <label className="pchk">
                      <input
                        type="checkbox"
                        checked={on}
                        onChange={(e) => set({ parts: { ...f.parts, [m.id]: e.target.checked } })}
                      />{" "}
                      {m.name}
                    </label>
                    {f.custom ? (
                      <input
                        className="field small"
                        inputMode="decimal"
                        value={f.cust[m.id] || ""}
                        disabled={!on}
                        aria-label={"Share for " + m.name}
                        onChange={(e) => set({ cust: { ...f.cust, [m.id]: e.target.value } })}
                      />
                    ) : (
                      <span className="share">{on ? fmt(cur, shares[m.id] || 0) : "Not included"}</span>
                    )}
                  </div>
                );
              })}
              <label className="check">
                <input type="checkbox" checked={f.custom} onChange={(e) => toggleCustom(e.target.checked)} /> Split unevenly
              </label>
              <p className="hint">{shareNote}</p>
            </>
          )}

          {mode === "lend" && (
            <>
              <div className="grid2b">
                <div>
                  <label className="lab" htmlFor="fLender">Who lent</label>
                  {sel(f.lender, (v) => set({ lender: v }), "fLender")}
                </div>
                <div>
                  <label className="lab" htmlFor="fBorrower">To</label>
                  {sel(f.borrower, (v) => set({ borrower: v }), "fBorrower")}
                </div>
              </div>
              <div className="grid2">
                <input
                  className="field"
                  placeholder="What for?"
                  aria-label="What for"
                  value={f.note}
                  onChange={(e) => set({ note: e.target.value })}
                />
                <input
                  className="field"
                  inputMode="decimal"
                  placeholder="0.00"
                  aria-label="Amount"
                  value={f.amount}
                  onChange={(e) => set({ amount: e.target.value })}
                />
              </div>
            </>
          )}

          {mode === "pay" && (
            <>
              <div className="grid2b">
                <div>
                  <label className="lab" htmlFor="fFrom">Who paid</label>
                  {sel(f.from, (v) => set({ from: v }), "fFrom")}
                </div>
                <div>
                  <label className="lab" htmlFor="fTo">Paid to</label>
                  {sel(f.to, (v) => set({ to: v }), "fTo")}
                </div>
              </div>
              <input
                className="field"
                inputMode="decimal"
                placeholder="Amount, e.g. 25.00"
                aria-label="Amount"
                value={f.amount}
                onChange={(e) => set({ amount: e.target.value })}
              />
            </>
          )}

          <p className="ferr" role="alert">{err}</p>
          <button type="button" className="primary" disabled={saving} onClick={submit}>
            {mode === "split" ? "Add bill" : mode === "lend" ? "Add loan" : "Record payment"}
          </button>
        </div>
      )}
    </div>
  );
}
