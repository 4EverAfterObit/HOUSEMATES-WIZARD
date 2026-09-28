// All money is whole cents.

export function toCents(v) {
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ""));
  return isFinite(n) && n > 0 ? Math.round(n * 100) : NaN;
}

export function dec(c) {
  return (c / 100).toFixed(2);
}

export function fmt(cur, cents) {
  return (
    cur +
    (Math.abs(cents) / 100).toLocaleString(undefined, {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    })
  );
}

export function equalShares(total, ids) {
  const n = ids.length;
  const out = {};
  if (!n) return out;
  const base = Math.floor(total / n);
  const rem = total - base * n;
  ids.forEach((id, i) => {
    out[id] = base + (i < rem ? 1 : 0);
  });
  return out;
}

// Each person's net: what they paid + payments they made - their shares - payments they received.
export function computeNet(members, expenses, payments) {
  const net = {};
  members.forEach((m) => {
    net[m.id] = 0;
  });
  expenses.forEach((e) => {
    net[e.payer_id] = (net[e.payer_id] || 0) + e.amount_cents;
    (e.expense_splits || []).forEach((s) => {
      net[s.member_id] = (net[s.member_id] || 0) - s.share_cents;
    });
  });
  payments.forEach((p) => {
    net[p.from_id] = (net[p.from_id] || 0) + p.amount_cents;
    net[p.to_id] = (net[p.to_id] || 0) - p.amount_cents;
  });
  return net;
}

// Fewest possible payments to settle everyone.
export function transfers(net) {
  const cr = [];
  const de = [];
  Object.keys(net).forEach((id) => {
    if (net[id] > 0) cr.push({ id, v: net[id] });
    else if (net[id] < 0) de.push({ id, v: -net[id] });
  });
  cr.sort((a, b) => b.v - a.v);
  de.sort((a, b) => b.v - a.v);
  const out = [];
  let i = 0;
  let j = 0;
  while (i < cr.length && j < de.length) {
    const t = Math.min(cr[i].v, de[j].v);
    out.push({ from: de[j].id, to: cr[i].id, amt: t });
    cr[i].v -= t;
    de[j].v -= t;
    if (cr[i].v === 0) i++;
    if (de[j].v === 0) j++;
  }
  return out;
}

export function fmtDate(t) {
  try {
    return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric" });
  } catch {
    return "";
  }
}

export function ago(t) {
  if (!t) return "";
  const d = Math.floor((Date.now() - new Date(t).getTime()) / 86400000);
  return d <= 0 ? "today" : d === 1 ? "yesterday" : d + " days ago";
}
