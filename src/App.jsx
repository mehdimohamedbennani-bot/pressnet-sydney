import { useState, useEffect, useCallback } from "react";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────
const ADMIN_PASSWORD = "pressnet2024";
const DELIVERY_FEE = 5;
const EXPRESS_FEE = 10;
const DISCOUNT_THRESHOLD = 10;
const DISCOUNT_RATE = 0.15;
const MAX_TRAVEL_MINUTES = 30;

// ─── SUBURB ZONES (proximity clusters) ───────────────────────────────────────
const SUBURB_ZONES = {
  "Surry Hills":   1, "Darlinghurst": 1, "Redfern":     1, "Chippendale": 1, "Waterloo": 1,
  "Newtown":       2, "Erskineville": 2, "Enmore":      2, "Petersham":   2, "St Peters": 2,
  "Glebe":         3, "Forest Lodge": 3, "Ultimo":      3, "Pyrmont":     3,
  "Alexandria":    4, "Zetland":      4, "Rosebery":    4, "Darlington":  4,
  "Balmain":       5, "Rozelle":      5, "Annandale":   5, "Leichhardt":  5,
  "Paddington":    6, "Woollahra":    6,
  "Marrickville":  7, "Dulwich Hill": 7, "Sydenham":    7,
};

// travel time in minutes between zones
const ZONE_TRAVEL = {
  "1-1":0,"1-2":10,"1-3":15,"1-4":10,"1-5":25,"1-6":15,"1-7":20,
  "2-2":0,"2-3":10,"2-4":15,"2-5":20,"2-6":20,"2-7":10,
  "3-3":0,"3-4":20,"3-5":15,"3-6":25,"3-7":25,
  "4-4":0,"4-5":30,"4-6":20,"4-7":15,
  "5-5":0,"5-6":30,"5-7":30,
  "6-6":0,"6-7":25,
  "7-7":0,
};

function getTravelTime(s1, s2) {
  const z1 = SUBURB_ZONES[s1] || 0;
  const z2 = SUBURB_ZONES[s2] || 0;
  if (!z1 || !z2) return 99;
  const key = z1 <= z2 ? `${z1}-${z2}` : `${z2}-${z1}`;
  return ZONE_TRAVEL[key] ?? 30;
}

function checkConflicts(newOrder, allOrders) {
  const conflicts = [];
  const sameSlotOrders = allOrders.filter(o =>
    o.status !== "cancelled" &&
    o.schedule?.slot === newOrder.schedule?.slot &&
    o.schedule?.day === newOrder.schedule?.day &&
    o.id !== newOrder.id
  );
  for (const o of sameSlotOrders) {
    const travel = getTravelTime(newOrder.customer?.suburb, o.customer?.suburb);
    if (travel > MAX_TRAVEL_MINUTES) {
      conflicts.push({ order: o, travelMinutes: travel });
    }
  }
  return conflicts;
}

// ─── DEFAULT SERVICES ─────────────────────────────────────────────────────────
const DEFAULT_SERVICES = [
  { id: "shirt",   label: "Shirt / Blouse",  emoji: "👔", price: 4.50, desc: "Cotton, linen, silk",    active: true },
  { id: "pants",   label: "Pants / Skirt",   emoji: "👖", price: 5.00, desc: "All fabrics",            active: true },
  { id: "dress",   label: "Dress",           emoji: "👗", price: 7.00, desc: "Casual or formal",       active: true },
  { id: "jacket",  label: "Jacket / Blazer", emoji: "🧥", price: 8.00, desc: "Sport or formal",        active: true },
  { id: "suit",    label: "Full Suit",        emoji: "🤵", price: 13.00, desc: "Jacket + pants",        active: true },
  { id: "tshirt",  label: "T-Shirt / Polo",  emoji: "👕", price: 3.00, desc: "Casual wear",            active: true },
  { id: "bedding", label: "Bed Linen",       emoji: "🛏️", price: 9.00, desc: "Sheets, duvet covers",  active: true },
];

const SLOTS = [
  { id: "am",  label: "Morning",   time: "8am – 12pm", icon: "🌅" },
  { id: "pm",  label: "Afternoon", time: "12pm – 5pm", icon: "☀️" },
  { id: "eve", label: "Evening",   time: "5pm – 8pm",  icon: "🌆" },
];

const SUBURBS = [
  "Surry Hills","Newtown","Redfern","Glebe","Paddington",
  "Erskineville","Chippendale","Darlington","Alexandria","Waterloo",
  "Marrickville","Enmore","Annandale","Balmain","Leichhardt",
  "Petersham","St Peters","Rozelle","Forest Lodge","Ultimo",
];

const STATUS_CONFIG = {
  pending:      { label: "Pending",      color: "#F59E0B", bg: "#FFFBEB", next: "picked_up"  },
  picked_up:    { label: "Picked Up",    color: "#3B82F6", bg: "#EFF6FF", next: "at_presser" },
  at_presser:   { label: "At Presser",   color: "#8B5CF6", bg: "#F5F3FF", next: "ready"      },
  ready:        { label: "Ready",        color: "#F97316", bg: "#FFF7ED", next: "delivered"  },
  delivered:    { label: "Delivered",    color: "#10B981", bg: "#F0FDF4", next: null         },
  cancelled:    { label: "Cancelled",    color: "#EF4444", bg: "#FEF2F2", next: null         },
};

// ─── STORAGE ──────────────────────────────────────────────────────────────────
async function loadOrders() {
  try { const r = await window.storage.get("pressnet_orders"); return r ? JSON.parse(r.value) : []; } catch { return []; }
}
async function saveOrders(orders) {
  try { await window.storage.set("pressnet_orders", JSON.stringify(orders)); } catch {}
}
async function loadServices() {
  try { const r = await window.storage.get("pressnet_services"); return r ? JSON.parse(r.value) : DEFAULT_SERVICES; } catch { return DEFAULT_SERVICES; }
}
async function saveServices(services) {
  try { await window.storage.set("pressnet_services", JSON.stringify(services)); } catch {}
}
async function loadCustomers() {
  try { const r = await window.storage.get("pressnet_customers"); return r ? JSON.parse(r.value) : {}; } catch { return {}; }
}
async function saveCustomers(customers) {
  try { await window.storage.set("pressnet_customers", JSON.stringify(customers)); } catch {}
}

// ─── HELPERS ──────────────────────────────────────────────────────────────────
function calcTotal(qty, express, services) {
  const totalItems = Object.values(qty).reduce((a, b) => a + b, 0);
  const subtotal = services.reduce((s, i) => s + (qty[i.id] || 0) * i.price, 0);
  const discount = totalItems >= DISCOUNT_THRESHOLD ? subtotal * DISCOUNT_RATE : 0;
  const expressFee = express ? EXPRESS_FEE : 0;
  return { totalItems, subtotal, discount, expressFee, total: subtotal - discount + DELIVERY_FEE + expressFee };
}

function getDays() {
  const NAMES = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today); d.setDate(today.getDate() + i + 1);
    return { label: NAMES[d.getDay()], num: d.getDate(), month: d.toLocaleString("en", { month: "short" }), date: d };
  });
}

function genId() { return "PN-" + Math.random().toString(36).substring(2, 7).toUpperCase(); }
function fmtDate(ts) { return new Date(ts).toLocaleDateString("en-AU", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" }); }
function fmtDay(ts) { return new Date(ts).toLocaleDateString("en-AU", { weekday: "short", day: "numeric", month: "short" }); }

// ─── DESIGN ───────────────────────────────────────────────────────────────────
const C = {
  navy: "#0D1B2A", teal: "#4CB8A8", red: "#C4472A",
  bg: "#F2F4F7", white: "#FFFFFF", border: "#E5E7EB",
  muted: "#6B7280", faint: "#F3F4F6", orange: "#F97316",
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: cfg.color, background: cfg.bg, padding: "3px 8px", borderRadius: 6 }}>{cfg.label}</span>;
}

function Btn({ children, onClick, variant = "primary", disabled, style: extra = {} }) {
  const base = { border: "none", borderRadius: 12, padding: "13px 20px", fontSize: 14, fontWeight: 700, cursor: disabled ? "default" : "pointer", fontFamily: "inherit", transition: "opacity .15s", opacity: disabled ? .45 : 1, ...extra };
  const variants = { primary: { background: C.red, color: "#fff" }, ghost: { background: C.faint, color: C.navy }, teal: { background: C.teal, color: "#fff" }, navy: { background: C.navy, color: "#fff" }, danger: { background: "#FEF2F2", color: "#EF4444" }, orange: { background: "#FFF7ED", color: C.orange } };
  return <button style={{ ...base, ...variants[variant] }} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Input({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.muted }}>{label}</label>}
      <input value={value} onChange={onChange} placeholder={placeholder} type={type}
        style={{ padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 15, color: C.navy, fontFamily: "inherit", outline: "none", boxSizing: "border-box", width: "100%" }} />
    </div>
  );
}

function Select({ label, value, onChange, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.muted }}>{label}</label>}
      <select value={value} onChange={onChange}
        style={{ padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 15, color: C.navy, fontFamily: "inherit", outline: "none", background: "#fff", boxSizing: "border-box", width: "100%", WebkitAppearance: "none" }}>
        {children}
      </select>
    </div>
  );
}

function Card({ children, style: extra = {} }) {
  return <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, ...extra }}>{children}</div>;
}

function SectionHead({ label, title }) {
  return (
    <div style={{ padding: "22px 16px 10px" }}>
      {label && <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: C.teal, marginBottom: 6 }}>{label}</div>}
      <div style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>{title}</div>
    </div>
  );
}

function BottomBar({ calc, step, canNext, onNext, onBack }) {
  return (
    <div style={{ position: "sticky", bottom: 0, background: C.white, borderTop: `1px solid ${C.border}`, padding: "12px 16px 20px", display: "flex", gap: 10, alignItems: "center" }}>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 12, color: C.muted }}>{calc.totalItems} item{calc.totalItems !== 1 ? "s" : ""}</div>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>${calc.total.toFixed(2)}</div>
      </div>
      {onBack && <Btn variant="ghost" onClick={onBack} style={{ padding: "13px 16px" }}>←</Btn>}
      <Btn onClick={onNext} disabled={!canNext}>{step === 0 ? "Choose time →" : step === 1 ? "My details →" : "Confirm order →"}</Btn>
    </div>
  );
}

// ─── BOOKING APP ──────────────────────────────────────────────────────────────
function BookingApp({ onOrderPlaced, services }) {
  const [step, setStep] = useState(0);
  const [qty, setQty] = useState({});
  const [express, setExpress] = useState(false);
  const [dayIdx, setDayIdx] = useState(null);
  const [slot, setSlot] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", suburb: "", notes: "" });
  const [submitted, setSubmitted] = useState(false);
  const [orderId] = useState(genId);
  const days = getDays();
  const activeServices = services.filter(s => s.active);
  const calc = calcTotal(qty, express, activeServices);
  const canNext = [calc.totalItems > 0, dayIdx !== null && slot !== null, form.name && form.phone && form.address && form.suburb];

  function bump(id, d) { setQty(p => { const n = (p[id] || 0) + d; return n < 0 ? p : { ...p, [id]: n }; }); }

  async function submit() {
    const day = days[dayIdx];
    const slotObj = SLOTS.find(s => s.id === slot);
    const order = {
      id: orderId, createdAt: Date.now(), status: "pending",
      items: activeServices.filter(i => qty[i.id] > 0).map(i => ({ ...i, qty: qty[i.id] })),
      express, calc,
      schedule: { day: `${day.label} ${day.num} ${day.month}`, slot: slotObj.label, slotId: slotObj.id, time: slotObj.time },
      customer: { ...form },
    };
    const existing = await loadOrders();
    await saveOrders([order, ...existing]);

    // Save customer profile
    const customers = await loadCustomers();
    const key = form.phone.replace(/\s/g, "");
    if (!customers[key]) customers[key] = { name: form.name, phone: form.phone, email: form.email, suburb: form.suburb, firstOrder: Date.now(), orders: [] };
    customers[key].orders = [orderId, ...(customers[key].orders || [])];
    customers[key].lastOrder = Date.now();
    customers[key].totalSpent = (customers[key].totalSpent || 0) + calc.total;
    await saveCustomers(customers);

    onOrderPlaced(order);
    setSubmitted(true);
  }

  function buildWA() {
    const day = days[dayIdx];
    const slotObj = SLOTS.find(s => s.id === slot);
    const lines = activeServices.filter(i => qty[i.id] > 0).map(i => `  • ${qty[i.id]}x ${i.label} ($${(qty[i.id]*i.price).toFixed(2)})`).join("\n");
    return encodeURIComponent(`🧺 *New PressNet Order*\nRef: ${orderId}\n\n*Items:*\n${lines}\n\n*Pickup:* ${day?.label} ${day?.num} ${day?.month} — ${slotObj?.label} (${slotObj?.time})\n*Address:* ${form.address}, ${form.suburb}\n*Name:* ${form.name} · ${form.phone}\n${form.notes ? `*Notes:* ${form.notes}\n` : ""}\n*Total: $${calc.total.toFixed(2)}*${express ? " · EXPRESS ⚡" : ""}`);
  }

  if (!submitted && step === 0) return (
    <div style={{ flex: 1, overflowY: "auto", paddingBottom: 100 }}>
      <SectionHead title="What needs ironing?" />
      <div style={{ padding: "0 16px 8px", fontSize: 13, color: C.muted }}>Pickup at your door · Back in 24h · Inner Sydney</div>
      {calc.totalItems >= 8 && calc.totalItems < 10 && (
        <div style={{ margin: "4px 16px 8px", background: C.navy, borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 20 }}>🎯</span>
          <div><div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>Add {10 - calc.totalItems} more for 15% off!</div><div style={{ color: C.teal, fontSize: 12, marginTop: 2 }}>Bundle deal at 10 items</div></div>
        </div>
      )}
      {calc.totalItems >= 10 && (
        <div style={{ margin: "4px 16px 8px", background: C.teal, borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "center" }}>
          <span>✅</span><div><div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>Bundle discount — 15% off!</div><div style={{ color: "#fff", fontSize: 12, opacity: .85 }}>You save ${calc.discount.toFixed(2)}</div></div>
        </div>
      )}
      <div style={{ padding: "8px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {activeServices.map(item => {
          const q = qty[item.id] || 0;
          return (
            <div key={item.id} style={{ display: "flex", alignItems: "center", padding: "13px 14px", borderRadius: 12, border: `1.5px solid ${q > 0 ? C.teal : C.border}`, background: q > 0 ? "#F0FAF9" : C.white, gap: 10 }}>
              <span style={{ fontSize: 24, width: 32, textAlign: "center" }}>{item.emoji}</span>
              <div style={{ flex: 1 }}><div style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>{item.label}</div><div style={{ fontSize: 12, color: "#9CA3AF" }}>{item.desc}</div></div>
              <span style={{ fontSize: 13, fontWeight: 700, color: C.teal, marginRight: 8 }}>${item.price.toFixed(2)}</span>
              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                <button onClick={() => bump(item.id, -1)} style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: q > 0 ? C.navy : C.faint, color: q > 0 ? "#fff" : "#9CA3AF", fontSize: 16, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>−</button>
                <span style={{ fontSize: 15, fontWeight: 700, color: C.navy, width: 18, textAlign: "center" }}>{q}</span>
                <button onClick={() => bump(item.id, 1)} style={{ width: 28, height: 28, borderRadius: 7, border: "none", background: C.navy, color: "#fff", fontSize: 16, fontWeight: 700, cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center" }}>+</button>
              </div>
            </div>
          );
        })}
      </div>
      <div style={{ padding: "10px 16px 0", display: "flex", alignItems: "center", gap: 10 }}>
        <input type="checkbox" checked={express} onChange={e => setExpress(e.target.checked)} style={{ width: 18, height: 18, accentColor: C.red }} />
        <label style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>⚡ Express — same-day in 6h <span style={{ color: C.red }}>+$10</span></label>
      </div>
      <BottomBar calc={calc} step={0} canNext={canNext[0]} onNext={() => setStep(1)} />
    </div>
  );

  if (!submitted && step === 1) return (
    <div style={{ flex: 1, overflowY: "auto", paddingBottom: 100 }}>
      <SectionHead title="When should we pick up?" />
      <div style={{ padding: "4px 16px 8px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.muted }}>Collection day</div>
      <div style={{ display: "flex", gap: 8, padding: "0 16px 16px", overflowX: "auto", scrollbarWidth: "none" }}>
        {days.map((d, i) => (
          <div key={i} onClick={() => setDayIdx(i)} style={{ flexShrink: 0, width: 54, padding: "10px 0", borderRadius: 12, textAlign: "center", border: `1.5px solid ${dayIdx === i ? C.navy : C.border}`, background: dayIdx === i ? C.navy : C.white, cursor: "pointer" }}>
            <div style={{ fontSize: 10, fontWeight: 700, textTransform: "uppercase", color: dayIdx === i ? C.teal : C.muted, marginBottom: 4 }}>{d.label}</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: dayIdx === i ? "#fff" : C.navy }}>{d.num}</div>
            <div style={{ fontSize: 10, color: dayIdx === i ? "#9CA3AF" : "#D1D5DB" }}>{d.month}</div>
          </div>
        ))}
      </div>
      <div style={{ padding: "4px 16px 10px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.muted }}>Time slot</div>
      <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 10 }}>
        {SLOTS.map(s => {
          const sel = slot === s.id;
          return (
            <div key={s.id} onClick={() => setSlot(s.id)} style={{ display: "flex", alignItems: "center", padding: "15px 16px", borderRadius: 12, border: `1.5px solid ${sel ? C.navy : C.border}`, background: sel ? C.navy : C.white, gap: 12, cursor: "pointer" }}>
              <span style={{ fontSize: 22 }}>{s.icon}</span>
              <div style={{ flex: 1 }}><div style={{ fontSize: 15, fontWeight: 700, color: sel ? "#fff" : C.navy }}>{s.label}</div><div style={{ fontSize: 12, color: sel ? C.teal : C.muted }}>{s.time}</div></div>
              <div style={{ width: 22, height: 22, borderRadius: "50%", border: `2px solid ${sel ? C.teal : C.border}`, background: sel ? C.teal : "transparent", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 12, fontWeight: 700 }}>{sel ? "✓" : ""}</div>
            </div>
          );
        })}
      </div>
      <BottomBar calc={calc} step={1} canNext={canNext[1]} onNext={() => setStep(2)} onBack={() => setStep(0)} />
    </div>
  );

  if (!submitted && step === 2) {
    const upd = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
    return (
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 100 }}>
        <SectionHead title="Your details" />
        <div style={{ padding: "0 16px", display: "flex", flexDirection: "column", gap: 14 }}>
          <Input label="First name" value={form.name} onChange={upd("name")} placeholder="e.g. Sarah" />
          <Input label="Mobile number" value={form.phone} onChange={upd("phone")} placeholder="04xx xxx xxx" type="tel" />
          <Input label="Email (optional)" value={form.email} onChange={upd("email")} placeholder="you@email.com" type="email" />
          <Input label="Street address" value={form.address} onChange={upd("address")} placeholder="e.g. 42 King St, Apt 3" />
          <Select label="Suburb" value={form.suburb} onChange={upd("suburb")}>
            <option value="">Select your suburb...</option>
            {SUBURBS.map(z => <option key={z} value={z}>{z}</option>)}
          </Select>
          <Input label="Special instructions (optional)" value={form.notes} onChange={upd("notes")} placeholder="Starch, sharp creases, delicate fabric..." />
        </div>
        <div style={{ margin: "16px 16px 0", padding: "12px 14px", borderRadius: 10, background: "#FFF7ED", display: "flex", gap: 10 }}>
          <span>🔒</span><div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>Pay on delivery — cash or card. Free cancellation up to 2h before pickup.</div>
        </div>
        <div style={{ padding: "18px 16px 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.muted }}>Order summary</div>
        <Card style={{ margin: "0 16px" }}>
          {activeServices.filter(i => qty[i.id] > 0).map(item => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: `1px solid ${C.faint}` }}>
              <span style={{ fontSize: 14, color: C.muted }}>{item.emoji} {qty[item.id]}× {item.label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>${(qty[item.id] * item.price).toFixed(2)}</span>
            </div>
          ))}
          {calc.discount > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: `1px solid ${C.faint}` }}><span style={{ fontSize: 14, color: C.teal }}>✅ Bundle (−15%)</span><span style={{ fontSize: 14, fontWeight: 600, color: C.teal }}>−${calc.discount.toFixed(2)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: `1px solid ${C.faint}` }}><span style={{ fontSize: 14, color: C.muted }}>🚚 Delivery</span><span style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>${DELIVERY_FEE.toFixed(2)}</span></div>
          {express && <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: `1px solid ${C.faint}` }}><span style={{ fontSize: 14, color: C.muted }}>⚡ Express</span><span style={{ fontSize: 14, fontWeight: 600, color: C.red }}>+${EXPRESS_FEE.toFixed(2)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "13px 14px", background: "#F0FAF9", borderTop: `2px solid ${C.teal}` }}><span style={{ fontSize: 15, fontWeight: 700, color: C.navy }}>Total</span><span style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>${calc.total.toFixed(2)}</span></div>
        </Card>
        <BottomBar calc={calc} step={2} canNext={canNext[2]} onNext={submit} onBack={() => setStep(1)} />
      </div>
    );
  }

  if (submitted) {
    const day = days[dayIdx];
    const slotObj = SLOTS.find(s => s.id === slot);
    return (
      <div style={{ flex: 1, overflowY: "auto", padding: "40px 20px", display: "flex", flexDirection: "column", alignItems: "center", textAlign: "center" }}>
        <div style={{ width: 80, height: 80, borderRadius: "50%", background: "#F0FAF9", border: `3px solid ${C.teal}`, display: "flex", alignItems: "center", justifyContent: "center", fontSize: 36, marginBottom: 20 }}>✅</div>
        <div style={{ fontSize: 26, fontWeight: 800, color: C.navy, marginBottom: 8 }}>You're booked!</div>
        <div style={{ fontSize: 14, color: C.muted, lineHeight: 1.6, marginBottom: 24, maxWidth: 300 }}>We'll pick up on <strong>{day?.label} {day?.num} {day?.month}</strong> between <strong>{slotObj?.time}</strong>.<br/>SMS confirmation coming shortly.</div>
        <div style={{ fontFamily: "monospace", fontSize: 16, fontWeight: 800, letterSpacing: ".1em", background: C.navy, color: C.teal, borderRadius: 10, padding: "10px 24px", marginBottom: 28 }}>{orderId}</div>
        <button onClick={() => window.open(`https://wa.me/61400000000?text=${buildWA()}`, "_blank")} style={{ width: "100%", maxWidth: 380, display: "flex", alignItems: "center", justifyContent: "center", gap: 10, background: "#25D366", color: "#fff", border: "none", borderRadius: 12, padding: "14px 24px", fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "inherit", marginBottom: 12 }}>
          <span>📱</span> Confirm via WhatsApp
        </button>
        <button onClick={() => { setStep(0); setQty({}); setDayIdx(null); setSlot(null); setExpress(false); setForm({ name:"",phone:"",email:"",address:"",suburb:"",notes:"" }); }} style={{ width: "100%", maxWidth: 380, background: C.faint, color: C.navy, border: "none", borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>New Order →</button>
      </div>
    );
  }
}

// ─── ADMIN SERVICES MANAGER ───────────────────────────────────────────────────
function ServicesManager({ services, onSave }) {
  const [list, setList] = useState(services);
  const [editing, setEditing] = useState(null);
  const [newService, setNewService] = useState({ label: "", emoji: "🧺", price: "", desc: "", active: true });
  const [showNew, setShowNew] = useState(false);

  function updateField(id, field, val) {
    setList(l => l.map(s => s.id === id ? { ...s, [field]: field === "price" ? parseFloat(val) || 0 : val } : s));
  }

  async function handleSave() { await onSave(list); setEditing(null); }

  async function addService() {
    if (!newService.label || !newService.price) return;
    const id = newService.label.toLowerCase().replace(/\s+/g, "_") + "_" + Date.now();
    const updated = [...list, { ...newService, id, price: parseFloat(newService.price) }];
    setList(updated);
    await onSave(updated);
    setNewService({ label: "", emoji: "🧺", price: "", desc: "", active: true });
    setShowNew(false);
  }

  async function toggleActive(id) {
    const updated = list.map(s => s.id === id ? { ...s, active: !s.active } : s);
    setList(updated);
    await onSave(updated);
  }

  async function deleteService(id) {
    if (!window.confirm("Remove this service?")) return;
    const updated = list.filter(s => s.id !== id);
    setList(updated);
    await onSave(updated);
  }

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 12 }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>Services & Pricing</div>
        <Btn variant="teal" onClick={() => setShowNew(!showNew)} style={{ padding: "8px 14px", fontSize: 13 }}>+ Add</Btn>
      </div>

      {showNew && (
        <Card style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10, border: `2px solid ${C.teal}` }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: C.teal }}>New service</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            <Input label="Name" value={newService.label} onChange={e => setNewService(s => ({ ...s, label: e.target.value }))} placeholder="e.g. Sweater" />
            <Input label="Emoji" value={newService.emoji} onChange={e => setNewService(s => ({ ...s, emoji: e.target.value }))} placeholder="🧺" />
            <Input label="Price ($)" value={newService.price} onChange={e => setNewService(s => ({ ...s, price: e.target.value }))} placeholder="0.00" type="number" />
            <Input label="Description" value={newService.desc} onChange={e => setNewService(s => ({ ...s, desc: e.target.value }))} placeholder="Short desc" />
          </div>
          <div style={{ display: "flex", gap: 8 }}>
            <Btn variant="teal" onClick={addService} style={{ flex: 1, textAlign: "center" }}>Save service</Btn>
            <Btn variant="ghost" onClick={() => setShowNew(false)} style={{ padding: "13px 16px" }}>Cancel</Btn>
          </div>
        </Card>
      )}

      {list.map(s => (
        <Card key={s.id} style={{ padding: 0, opacity: s.active ? 1 : .5 }}>
          {editing === s.id ? (
            <div style={{ padding: 14, display: "flex", flexDirection: "column", gap: 10 }}>
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                <Input label="Name" value={s.label} onChange={e => updateField(s.id, "label", e.target.value)} />
                <Input label="Emoji" value={s.emoji} onChange={e => updateField(s.id, "emoji", e.target.value)} />
                <Input label="Price ($)" value={s.price} onChange={e => updateField(s.id, "price", e.target.value)} type="number" />
                <Input label="Description" value={s.desc} onChange={e => updateField(s.id, "desc", e.target.value)} />
              </div>
              <div style={{ display: "flex", gap: 8 }}>
                <Btn variant="teal" onClick={handleSave} style={{ flex: 1, textAlign: "center" }}>Save</Btn>
                <Btn variant="ghost" onClick={() => setEditing(null)} style={{ padding: "13px 16px" }}>Cancel</Btn>
              </div>
            </div>
          ) : (
            <div style={{ padding: "13px 14px", display: "flex", alignItems: "center", gap: 12 }}>
              <span style={{ fontSize: 22 }}>{s.emoji}</span>
              <div style={{ flex: 1 }}>
                <div style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>{s.label}</div>
                <div style={{ fontSize: 12, color: C.muted }}>{s.desc}</div>
              </div>
              <div style={{ fontSize: 16, fontWeight: 800, color: C.teal, marginRight: 8 }}>${s.price.toFixed(2)}</div>
              <button onClick={() => toggleActive(s.id)} style={{ background: s.active ? "#D1FAE5" : C.faint, border: "none", borderRadius: 6, padding: "4px 8px", fontSize: 11, fontWeight: 700, color: s.active ? "#065F46" : C.muted, cursor: "pointer" }}>{s.active ? "ON" : "OFF"}</button>
              <button onClick={() => setEditing(s.id)} style={{ background: C.faint, border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 13, cursor: "pointer" }}>✏️</button>
              <button onClick={() => deleteService(s.id)} style={{ background: "#FEF2F2", border: "none", borderRadius: 6, padding: "6px 10px", fontSize: 13, cursor: "pointer" }}>🗑️</button>
            </div>
          )}
        </Card>
      ))}
    </div>
  );
}

// ─── ADMIN CUSTOMERS ──────────────────────────────────────────────────────────
function CustomersView({ allOrders }) {
  const [customers, setCustomers] = useState({});
  const [selected, setSelected] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    loadCustomers().then(c => { setCustomers(c); setLoading(false); });
  }, []);

  const list = Object.values(customers).sort((a, b) => (b.lastOrder || 0) - (a.lastOrder || 0));

  if (selected) {
    const c = customers[selected];
    const cOrders = allOrders.filter(o => o.customer?.phone?.replace(/\s/g, "") === selected);
    return (
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 24 }}>
        <div style={{ padding: "16px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${C.border}`, background: C.white, position: "sticky", top: 0 }}>
          <button onClick={() => setSelected(null)} style={{ background: C.faint, border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>← Back</button>
          <div style={{ flex: 1 }}><div style={{ fontWeight: 800, color: C.navy }}>{c.name}</div><div style={{ fontSize: 12, color: C.muted }}>{c.phone}</div></div>
        </div>
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
          <Card>
            {[["📱 Phone", c.phone], ["📧 Email", c.email || "—"], ["📍 Suburb", c.suburb], ["🛍️ Orders", cOrders.length], ["💰 Total spent", `$${(c.totalSpent || 0).toFixed(2)}`], ["📅 First order", fmtDay(c.firstOrder)], ["🕐 Last order", fmtDay(c.lastOrder)]].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${C.faint}` }}>
                <span style={{ fontSize: 13, color: C.muted }}>{l}</span><span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{v}</span>
              </div>
            ))}
          </Card>
          <div style={{ fontSize: 12, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.muted }}>Order history</div>
          {cOrders.map(o => (
            <Card key={o.id} style={{ padding: "13px 14px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                <span style={{ fontFamily: "monospace", fontWeight: 800, color: C.navy, fontSize: 13 }}>{o.id}</span>
                <StatusBadge status={o.status} />
              </div>
              <div style={{ fontSize: 12, color: C.muted }}>{fmtDate(o.createdAt)} · {o.schedule?.day} · ${o.calc?.total?.toFixed(2)}</div>
            </Card>
          ))}
        </div>
      </div>
    );
  }

  if (loading) return <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Loading customers...</div>;

  return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 10 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.navy, marginBottom: 4 }}>Customers <span style={{ fontSize: 14, color: C.muted, fontWeight: 400 }}>({list.length})</span></div>
      {list.length === 0 && <div style={{ padding: 40, textAlign: "center", color: C.muted }}><div style={{ fontSize: 32, marginBottom: 12 }}>👥</div><div style={{ fontWeight: 600 }}>No customers yet</div></div>}
      {list.map((c, i) => {
        const key = c.phone?.replace(/\s/g, "");
        return (
          <Card key={key || i} style={{ padding: "13px 14px", cursor: "pointer" }} onClick={() => setSelected(key)}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <div>
                <div style={{ fontSize: 14, fontWeight: 700, color: C.navy }}>{c.name}</div>
                <div style={{ fontSize: 12, color: C.muted }}>📍 {c.suburb} · {c.orders?.length || 0} order{c.orders?.length !== 1 ? "s" : ""}</div>
              </div>
              <div style={{ textAlign: "right" }}>
                <div style={{ fontSize: 15, fontWeight: 800, color: C.teal }}>${(c.totalSpent || 0).toFixed(0)}</div>
                <div style={{ fontSize: 11, color: C.muted }}>total</div>
              </div>
            </div>
          </Card>
        );
      })}
    </div>
  );
}

// ─── ADMIN PANEL ──────────────────────────────────────────────────────────────
function AdminPanel({ services, onServicesUpdate }) {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState("orders");
  const [search, setSearch] = useState("");
  const [filterStatus, setFilter] = useState("all");
  const [selected, setSelected] = useState(null);

  const refresh = useCallback(async () => { setLoading(true); const o = await loadOrders(); setOrders(o); setLoading(false); }, []);
  useEffect(() => { refresh(); }, [refresh]);

  async function updateStatus(id, newStatus) {
    const updated = orders.map(o => o.id === id ? { ...o, status: newStatus } : o);
    setOrders(updated); await saveOrders(updated);
    if (selected?.id === id) setSelected(s => ({ ...s, status: newStatus }));
  }

  async function deleteOrder(id) { const updated = orders.filter(o => o.id !== id); setOrders(updated); await saveOrders(updated); setSelected(null); }

  const today = new Date(); today.setHours(0,0,0,0);
  const todayOrders = orders.filter(o => new Date(o.createdAt) >= today);
  const weekAgo = new Date(today); weekAgo.setDate(today.getDate() - 7);
  const weekOrders = orders.filter(o => new Date(o.createdAt) >= weekAgo);
  const revenue = arr => arr.reduce((s, o) => s + (o.calc?.total || 0), 0);
  const countByStatus = s => orders.filter(o => o.status === s).length;

  // Conflict detection
  const conflicts = [];
  orders.filter(o => o.status === "pending").forEach(o => {
    const c = checkConflicts(o, orders.filter(x => x.status === "pending"));
    if (c.length > 0) conflicts.push({ order: o, conflicts: c });
  });

  const filtered = orders.filter(o => {
    const matchSearch = !search || [o.id, o.customer?.name, o.customer?.suburb, o.customer?.phone].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return matchSearch && (filterStatus === "all" || o.status === filterStatus);
  });

  // ORDER DETAIL
  if (selected) {
    const nextStatus = STATUS_CONFIG[selected.status]?.next;
    const orderConflicts = checkConflicts(selected, orders);
    return (
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 24 }}>
        <div style={{ padding: "16px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${C.border}`, background: C.white, position: "sticky", top: 0, zIndex: 10 }}>
          <button onClick={() => setSelected(null)} style={{ background: C.faint, border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>← Back</button>
          <div style={{ flex: 1 }}><div style={{ fontFamily: "monospace", fontWeight: 800, color: C.navy, fontSize: 14 }}>{selected.id}</div><div style={{ fontSize: 12, color: C.muted }}>{fmtDate(selected.createdAt)}</div></div>
          <StatusBadge status={selected.status} />
        </div>

        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
          {orderConflicts.length > 0 && (
            <div style={{ background: "#FEF3C7", border: "1.5px solid #F59E0B", borderRadius: 12, padding: "12px 14px" }}>
              <div style={{ fontWeight: 700, color: "#92400E", fontSize: 13, marginBottom: 8 }}>⚠️ Pickup conflict detected</div>
              {orderConflicts.map((c, i) => (
                <div key={i} style={{ fontSize: 12, color: "#92400E", marginBottom: 4 }}>
                  Order <strong>{c.order.id}</strong> — {c.order.customer?.suburb} — {c.travelMinutes} min away
                </div>
              ))}
            </div>
          )}

          <Card>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.faint}`, fontWeight: 700, fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>Customer</div>
            {[["👤 Name", selected.customer?.name], ["📱 Phone", selected.customer?.phone], ["📧 Email", selected.customer?.email || "—"], ["📍 Address", `${selected.customer?.address}`], ["🏘️ Suburb", selected.customer?.suburb], ["🗒️ Notes", selected.customer?.notes || "—"]].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${C.faint}`, gap: 10 }}>
                <span style={{ fontSize: 13, color: C.muted, flexShrink: 0 }}>{l}</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: C.navy, textAlign: "right" }}>{v}</span>
              </div>
            ))}
          </Card>

          <Card>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.faint}`, fontWeight: 700, fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>Schedule</div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${C.faint}` }}><span style={{ fontSize: 13, color: C.muted }}>📅 Day</span><span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{selected.schedule?.day}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px" }}><span style={{ fontSize: 13, color: C.muted }}>🕐 Slot</span><span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{selected.schedule?.slot} ({selected.schedule?.time})</span></div>
          </Card>

          <Card>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.faint}`, fontWeight: 700, fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>Items</div>
            {selected.items?.map(item => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${C.faint}` }}><span style={{ fontSize: 13, color: C.muted }}>{item.emoji} {item.qty}× {item.label}</span><span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>${(item.qty * item.price).toFixed(2)}</span></div>)}
            {selected.calc?.discount > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${C.faint}` }}><span style={{ fontSize: 13, color: C.teal }}>Bundle</span><span style={{ fontSize: 13, fontWeight: 600, color: C.teal }}>−${selected.calc.discount.toFixed(2)}</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: "#F0FAF9", borderTop: `2px solid ${C.teal}` }}><span style={{ fontWeight: 700, color: C.navy }}>Total</span><span style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>${selected.calc?.total?.toFixed(2)}</span></div>
          </Card>

          {/* Presser tracking */}
          <Card>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.faint}`, fontWeight: 700, fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>Presser tracking</div>
            <div style={{ padding: "14px" }}>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                {["picked_up","at_presser","ready","delivered"].map(st => {
                  const cfg = STATUS_CONFIG[st];
                  const isActive = selected.status === st;
                  const isDone = Object.keys(STATUS_CONFIG).indexOf(selected.status) > Object.keys(STATUS_CONFIG).indexOf(st);
                  return (
                    <div key={st} style={{ flex: 1, minWidth: 70, textAlign: "center", padding: "8px 4px", borderRadius: 8, background: isActive ? cfg.bg : isDone ? "#F0FDF4" : C.faint }}>
                      <div style={{ fontSize: 18 }}>{st === "picked_up" ? "🚗" : st === "at_presser" ? "👔" : st === "ready" ? "✅" : "🏠"}</div>
                      <div style={{ fontSize: 10, fontWeight: 700, color: isActive ? cfg.color : isDone ? "#10B981" : C.muted, marginTop: 4 }}>{cfg.label}</div>
                    </div>
                  );
                })}
              </div>
            </div>
          </Card>

          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {nextStatus && <Btn variant="teal" onClick={() => updateStatus(selected.id, nextStatus)} style={{ width: "100%" }}>Mark as {STATUS_CONFIG[nextStatus]?.label} →</Btn>}
            {selected.status !== "cancelled" && selected.status !== "delivered" && <Btn variant="danger" onClick={() => updateStatus(selected.id, "cancelled")} style={{ width: "100%" }}>Cancel order</Btn>}
            <Btn variant="ghost" onClick={() => { if (window.confirm("Delete permanently?")) deleteOrder(selected.id); }} style={{ width: "100%" }}>🗑️ Delete</Btn>
          </div>
        </div>
      </div>
    );
  }

  // DASHBOARD
  if (activeTab === "dashboard") {
    const suburbCount = {};
    orders.forEach(o => { const s = o.customer?.suburb; if (s) suburbCount[s] = (suburbCount[s] || 0) + 1; });
    const topSuburbs = Object.entries(suburbCount).sort((a, b) => b[1] - a[1]).slice(0, 6);
    const maxCount = topSuburbs[0]?.[1] || 1;

    return (
      <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>Dashboard</div>

        {conflicts.length > 0 && (
          <div style={{ background: "#FEF3C7", border: "1.5px solid #F59E0B", borderRadius: 12, padding: "12px 14px" }}>
            <div style={{ fontWeight: 700, color: "#92400E", fontSize: 13, marginBottom: 6 }}>⚠️ {conflicts.length} pickup conflict{conflicts.length > 1 ? "s" : ""} detected</div>
            {conflicts.map(({ order, conflicts: c }, i) => (
              <div key={i} style={{ fontSize: 12, color: "#92400E", marginBottom: 2 }}>
                {order.id} ({order.customer?.suburb}) ↔ {c[0].order.id} ({c[0].order.customer?.suburb}) — {c[0].travelMinutes} min
              </div>
            ))}
          </div>
        )}

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
          {[
            { label: "Today's orders", val: todayOrders.length, icon: "📦", color: C.navy },
            { label: "Today's revenue", val: `$${revenue(todayOrders).toFixed(0)}`, icon: "💰", color: "#10B981" },
            { label: "Week orders", val: weekOrders.length, icon: "📅", color: "#8B5CF6" },
            { label: "Week revenue", val: `$${revenue(weekOrders).toFixed(0)}`, icon: "📈", color: C.red },
          ].map(k => (
            <Card key={k.label} style={{ padding: "14px" }}>
              <div style={{ fontSize: 22, marginBottom: 4 }}>{k.icon}</div>
              <div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.val}</div>
              <div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{k.label}</div>
            </Card>
          ))}
        </div>

        <Card>
          <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.faint}`, fontWeight: 700, fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>By status</div>
          {Object.entries(STATUS_CONFIG).map(([key]) => (
            <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "10px 14px", borderBottom: `1px solid ${C.faint}` }}>
              <StatusBadge status={key} /><span style={{ fontWeight: 800, fontSize: 16, color: C.navy }}>{countByStatus(key)}</span>
            </div>
          ))}
        </Card>

        {topSuburbs.length > 0 && (
          <Card>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.faint}`, fontWeight: 700, fontSize: 12, color: C.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>Top suburbs</div>
            <div style={{ padding: "14px", display: "flex", flexDirection: "column", gap: 10 }}>
              {topSuburbs.map(([suburb, count]) => (
                <div key={suburb}>
                  <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 4 }}>
                    <span style={{ fontSize: 13, color: C.navy, fontWeight: 600 }}>📍 {suburb}</span>
                    <span style={{ fontSize: 13, color: C.muted }}>{count} order{count !== 1 ? "s" : ""}</span>
                  </div>
                  <div style={{ height: 6, borderRadius: 3, background: C.faint, overflow: "hidden" }}>
                    <div style={{ height: "100%", width: `${(count / maxCount) * 100}%`, background: C.teal, borderRadius: 3, transition: "width .3s" }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )}

        <Btn variant="ghost" onClick={refresh} style={{ width: "100%", textAlign: "center" }}>🔄 Refresh</Btn>
      </div>
    );
  }

  // SERVICES TAB
  if (activeTab === "services") return <ServicesManager services={services} onSave={onServicesUpdate} />;

  // CUSTOMERS TAB
  if (activeTab === "customers") return <CustomersView allOrders={orders} />;

  // ORDERS LIST
  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10, borderBottom: `1px solid ${C.border}`, background: C.white }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by name, suburb, phone..." style={{ padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
          {["all", ...Object.keys(STATUS_CONFIG)].map(s => <button key={s} onClick={() => setFilter(s)} style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 8, border: "none", background: filterStatus === s ? C.navy : C.faint, color: filterStatus === s ? "#fff" : C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{s === "all" ? "All" : STATUS_CONFIG[s].label}</button>)}
        </div>
      </div>

      {loading ? <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Loading...</div>
        : filtered.length === 0 ? (
          <div style={{ padding: 40, textAlign: "center", color: C.muted }}>
            <div style={{ fontSize: 32, marginBottom: 12 }}>📭</div>
            <div style={{ fontWeight: 600 }}>{orders.length === 0 ? "No orders yet" : "No matches"}</div>
          </div>
        ) : (
          <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {filtered.map(order => {
              const hasConflict = checkConflicts(order, orders.filter(o => o.status === "pending")).length > 0 && order.status === "pending";
              return (
                <Card key={order.id} style={{ padding: 0, cursor: "pointer", border: hasConflict ? `1.5px solid #F59E0B` : `1px solid ${C.border}` }} onClick={() => setSelected(order)}>
                  <div style={{ padding: "13px 14px" }}>
                    {hasConflict && <div style={{ fontSize: 11, fontWeight: 700, color: "#92400E", background: "#FEF3C7", borderRadius: 6, padding: "3px 8px", marginBottom: 8, display: "inline-block" }}>⚠️ Conflict</div>}
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                      <div><div style={{ fontFamily: "monospace", fontWeight: 800, color: C.navy, fontSize: 13 }}>{order.id}</div><div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{fmtDate(order.createdAt)}</div></div>
                      <StatusBadge status={order.status} />
                    </div>
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <div><div style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>{order.customer?.name}</div><div style={{ fontSize: 12, color: C.muted }}>📍 {order.customer?.suburb} · {order.calc?.totalItems} items · {order.schedule?.day}</div></div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>${order.calc?.total?.toFixed(2)}</div>
                    </div>
                  </div>
                </Card>
              );
            })}
          </div>
        )}
    </div>
  );
}

// ─── ADMIN LOGIN ──────────────────────────────────────────────────────────────
function AdminLogin({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 20 }}>
      <div style={{ fontSize: 48 }}>🔐</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>Admin Access</div>
      <div style={{ fontSize: 13, color: C.muted }}>PressNet Sydney — Operations Panel</div>
      <input type="password" placeholder="Enter password" value={pw} onChange={e => { setPw(e.target.value); setErr(false); }} onKeyDown={e => e.key === "Enter" && (pw === ADMIN_PASSWORD ? onLogin() : setErr(true))}
        style={{ width: "100%", maxWidth: 300, padding: "13px 14px", borderRadius: 10, border: `1.5px solid ${err ? "#EF4444" : C.border}`, fontSize: 15, fontFamily: "inherit", outline: "none", textAlign: "center", boxSizing: "border-box" }} />
      {err && <div style={{ color: "#EF4444", fontSize: 13, fontWeight: 600 }}>Incorrect password</div>}
      <Btn variant="navy" onClick={() => pw === ADMIN_PASSWORD ? onLogin() : setErr(true)} style={{ width: "100%", maxWidth: 300, textAlign: "center" }}>Sign In →</Btn>
    </div>
  );
}

// ─── ROOT ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("home");
  const [adminAuth, setAdminAuth] = useState(false);
  const [adminTab, setAdminTab] = useState("orders");
  const [liveOrders, setLiveOrders] = useState(0);
  const [services, setServices] = useState(DEFAULT_SERVICES);

  useEffect(() => {
    loadOrders().then(o => setLiveOrders(o.filter(x => x.status === "pending").length));
    loadServices().then(s => setServices(s));
  }, []);

  async function handleServicesUpdate(updated) { setServices(updated); await saveServices(updated); }

  const ADMIN_TABS = [
    { id: "orders",    icon: "📋", label: "Orders"    },
    { id: "dashboard", icon: "📊", label: "Stats"     },
    { id: "customers", icon: "👥", label: "Customers" },
    { id: "services",  icon: "⚙️", label: "Services"  },
  ];

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: C.bg, minHeight: "100vh", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 430, minHeight: "100vh", background: C.white, display: "flex", flexDirection: "column", boxShadow: "0 0 60px rgba(0,0,0,.12)" }}>

        {/* TOP BAR */}
        <div style={{ background: C.navy, color: "#fff", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 100 }}>
          {view === "admin" && <button onClick={() => { setView("home"); setAdminAuth(false); }} style={{ background: "rgba(255,255,255,.1)", border: "none", borderRadius: 8, color: "#fff", padding: "6px 10px", cursor: "pointer", fontSize: 14 }}>←</button>}
          <div style={{ flex: 1 }}>
            <span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em" }}>Press<span style={{ color: C.teal }}>Net</span></span>
            <span style={{ fontSize: 12, color: "#6B7280", fontWeight: 400, marginLeft: 8 }}>{view === "admin" ? "Admin" : "Sydney"}</span>
          </div>
          {view === "home" && (
            <button onClick={() => setView("admin")} style={{ background: "rgba(255,255,255,.1)", border: "none", borderRadius: 8, color: "#fff", padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>
              {liveOrders > 0 && <span style={{ background: C.red, borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "1px 6px" }}>{liveOrders}</span>}
              Admin
            </button>
          )}

        </div>

        {/* CONTENT */}
        {view === "home" && (
          <>
            <div style={{ background: "linear-gradient(135deg, #0D1B2A 0%, #1a3a52 100%)", padding: "20px 18px 22px" }}>
              <div style={{ fontSize: 13, color: C.teal, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 8 }}>Ironing pickup & delivery · Inner Sydney</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 10 }}>Perfectly pressed.<br/><span style={{ color: C.teal }}>Delivered to your door.</span></div>
              <div style={{ display: "flex", gap: 16 }}>{["Pickup in 2h", "Back in 24h", "From $3/item"].map(t => <div key={t} style={{ fontSize: 12, color: "#9CA3AF" }}>✓ {t}</div>)}</div>
            </div>
            <BookingApp onOrderPlaced={() => setLiveOrders(n => n + 1)} services={services} />
          </>
        )}
        {view === "admin" && !adminAuth && <AdminLogin onLogin={() => setAdminAuth(true)} />}
        {view === "admin" && adminAuth && <AdminPanel services={services} onServicesUpdate={handleServicesUpdate} activeTab={adminTab} setActiveTab={setAdminTab} />}

        {/* BOTTOM ADMIN NAV */}
        {view === "admin" && adminAuth && (
          <div style={{ background: C.navy, borderTop: "1px solid rgba(255,255,255,.1)", display: "flex", position: "sticky", bottom: 0, zIndex: 100 }}>
            {ADMIN_TABS.map(t => (
              <button key={t.id} onClick={() => setAdminTab(t.id)}
                style={{ flex: 1, background: adminTab === t.id ? "rgba(255,255,255,.15)" : "transparent", border: "none", color: adminTab === t.id ? "#fff" : "#6B7280", padding: "10px 4px 14px", cursor: "pointer", fontFamily: "inherit", display: "flex", flexDirection: "column", alignItems: "center", gap: 3 }}>
                <span style={{ fontSize: 20 }}>{t.icon}</span>
                <span style={{ fontSize: 10, fontWeight: 700, letterSpacing: ".04em" }}>{t.label}</span>
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
