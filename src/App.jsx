import { useState, useEffect, useCallback } from "react";

const ADMIN_PASSWORD = "pressnet2024";

const ITEMS = [
  { id: "shirt",   label: "Shirt / Blouse",  emoji: "👔", price: 4.50, desc: "Cotton, linen, silk" },
  { id: "pants",   label: "Pants / Skirt",   emoji: "👖", price: 5.00, desc: "All fabrics" },
  { id: "dress",   label: "Dress",           emoji: "👗", price: 7.00, desc: "Casual or formal" },
  { id: "jacket",  label: "Jacket / Blazer", emoji: "🧥", price: 8.00, desc: "Sport or formal" },
  { id: "suit",    label: "Full Suit",        emoji: "🤵", price: 13.00, desc: "Jacket + pants" },
  { id: "tshirt",  label: "T-Shirt / Polo",  emoji: "👕", price: 3.00, desc: "Casual wear" },
  { id: "bedding", label: "Bed Linen",       emoji: "🛏️", price: 9.00, desc: "Sheets, duvet covers" },
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
  pending:   { label: "Pending",   color: "#F59E0B", bg: "#FFFBEB", next: "picked_up" },
  picked_up: { label: "Picked Up", color: "#3B82F6", bg: "#EFF6FF", next: "pressing"  },
  pressing:  { label: "Pressing",  color: "#8B5CF6", bg: "#F5F3FF", next: "delivered" },
  delivered: { label: "Delivered", color: "#10B981", bg: "#F0FDF4", next: null        },
  cancelled: { label: "Cancelled", color: "#EF4444", bg: "#FEF2F2", next: null        },
};

const DELIVERY_FEE = 5;
const EXPRESS_FEE = 10;
const DISCOUNT_THRESHOLD = 10;
const DISCOUNT_RATE = 0.15;

async function loadOrders() {
  try {
    const r = await window.storage.get("pressnet_orders");
    return r ? JSON.parse(r.value) : [];
  } catch { return []; }
}

async function saveOrders(orders) {
  try { await window.storage.set("pressnet_orders", JSON.stringify(orders)); } catch {}
}

function calcTotal(qty, express) {
  const totalItems = Object.values(qty).reduce((a, b) => a + b, 0);
  const subtotal = ITEMS.reduce((s, i) => s + (qty[i.id] || 0) * i.price, 0);
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

const C = {
  navy: "#0D1B2A", teal: "#4CB8A8", red: "#C4472A",
  bg: "#F2F4F7", white: "#FFFFFF", border: "#E5E7EB",
  muted: "#6B7280", faint: "#F3F4F6",
};

function StatusBadge({ status }) {
  const cfg = STATUS_CONFIG[status] || STATUS_CONFIG.pending;
  return <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".06em", textTransform: "uppercase", color: cfg.color, background: cfg.bg, padding: "3px 8px", borderRadius: 6 }}>{cfg.label}</span>;
}

function Btn({ children, onClick, variant = "primary", disabled, style: extra = {} }) {
  const base = { border: "none", borderRadius: 12, padding: "13px 20px", fontSize: 14, fontWeight: 700, cursor: disabled ? "default" : "pointer", fontFamily: "inherit", transition: "opacity .15s", opacity: disabled ? .45 : 1, ...extra };
  const variants = { primary: { background: C.red, color: "#fff" }, ghost: { background: C.faint, color: C.navy }, teal: { background: C.teal, color: "#fff" }, navy: { background: C.navy, color: "#fff" }, danger: { background: "#FEF2F2", color: "#EF4444" } };
  return <button style={{ ...base, ...variants[variant] }} onClick={onClick} disabled={disabled}>{children}</button>;
}

function Input({ label, value, onChange, placeholder, type = "text" }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.muted }}>{label}</label>}
      <input value={value} onChange={onChange} placeholder={placeholder} type={type} style={{ padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 15, color: C.navy, fontFamily: "inherit", outline: "none", boxSizing: "border-box", width: "100%" }} />
    </div>
  );
}

function Select({ label, value, onChange, children }) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
      {label && <label style={{ fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.muted }}>{label}</label>}
      <select value={value} onChange={onChange} style={{ padding: "12px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 15, color: C.navy, fontFamily: "inherit", outline: "none", background: "#fff", boxSizing: "border-box", width: "100%", WebkitAppearance: "none" }}>{children}</select>
    </div>
  );
}

function Card({ children, style: extra = {} }) {
  return <div style={{ background: C.white, borderRadius: 14, border: `1px solid ${C.border}`, ...extra }}>{children}</div>;
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

function BookingApp({ onOrderPlaced }) {
  const [step, setStep] = useState(0);
  const [qty, setQty] = useState({});
  const [express, setExpress] = useState(false);
  const [dayIdx, setDayIdx] = useState(null);
  const [slot, setSlot] = useState(null);
  const [form, setForm] = useState({ name: "", phone: "", email: "", address: "", suburb: "", notes: "" });
  const [submitted, setSubmitted] = useState(false);
  const [orderId] = useState(genId);
  const days = getDays();
  const calc = calcTotal(qty, express);
  const canNext = [calc.totalItems > 0, dayIdx !== null && slot !== null, form.name && form.phone && form.address && form.suburb];

  function bump(id, d) { setQty(p => { const n = (p[id] || 0) + d; return n < 0 ? p : { ...p, [id]: n }; }); }

  async function submit() {
    const day = days[dayIdx];
    const slotObj = SLOTS.find(s => s.id === slot);
    const order = { id: orderId, createdAt: Date.now(), status: "pending", items: ITEMS.filter(i => qty[i.id] > 0).map(i => ({ ...i, qty: qty[i.id] })), express, calc, schedule: { day: `${day.label} ${day.num} ${day.month}`, slot: slotObj.label, time: slotObj.time }, customer: { ...form } };
    const existing = await loadOrders();
    await saveOrders([order, ...existing]);
    onOrderPlaced(order);
    setSubmitted(true);
  }

  function buildWA() {
    const day = days[dayIdx];
    const slotObj = SLOTS.find(s => s.id === slot);
    const lines = ITEMS.filter(i => qty[i.id] > 0).map(i => `  • ${qty[i.id]}x ${i.label} ($${(qty[i.id]*i.price).toFixed(2)})`).join("\n");
    return encodeURIComponent(`🧺 *New PressNet Order*\nRef: ${orderId}\n\n*Items:*\n${lines}\n\n*Pickup:* ${day?.label} ${day?.num} ${day?.month} — ${slotObj?.label} (${slotObj?.time})\n*Address:* ${form.address}, ${form.suburb}\n*Name:* ${form.name} · ${form.phone}\n${form.notes ? `*Notes:* ${form.notes}\n` : ""}\n*Total: $${calc.total.toFixed(2)}*${express ? " · EXPRESS ⚡" : ""}`);
  }

  if (!submitted && step === 0) return (
    <div style={{ flex: 1, overflowY: "auto", paddingBottom: 100 }}>
      <div style={{ padding: "22px 16px 10px" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: C.navy, marginBottom: 4 }}>What needs ironing?</div>
        <div style={{ fontSize: 13, color: C.muted }}>Pickup at your door · Back in 24h · Inner Sydney</div>
      </div>
      {calc.totalItems >= 8 && calc.totalItems < 10 && (
        <div style={{ margin: "4px 16px 8px", background: C.navy, borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 20 }}>🎯</span>
          <div><div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>Add {10 - calc.totalItems} more for a 15% discount!</div><div style={{ color: C.teal, fontSize: 12, marginTop: 2 }}>Bundle deal kicks in at 10 items</div></div>
        </div>
      )}
      {calc.totalItems >= 10 && (
        <div style={{ margin: "4px 16px 8px", background: C.teal, borderRadius: 12, padding: "12px 14px", display: "flex", gap: 10, alignItems: "center" }}>
          <span style={{ fontSize: 20 }}>✅</span>
          <div><div style={{ color: "#fff", fontWeight: 700, fontSize: 13 }}>Bundle discount applied — 15% off!</div><div style={{ color: "#fff", fontSize: 12, marginTop: 2, opacity: .85 }}>You save ${calc.discount.toFixed(2)}</div></div>
        </div>
      )}
      <div style={{ padding: "8px 16px", display: "flex", flexDirection: "column", gap: 8 }}>
        {ITEMS.map(item => {
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
        <label style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>⚡ Express — same-day return in 6h <span style={{ color: C.red }}>+$10</span></label>
      </div>
      <BottomBar calc={calc} step={0} canNext={canNext[0]} onNext={() => setStep(1)} />
    </div>
  );

  if (!submitted && step === 1) return (
    <div style={{ flex: 1, overflowY: "auto", paddingBottom: 100 }}>
      <div style={{ padding: "22px 16px 10px" }}><div style={{ fontSize: 22, fontWeight: 800, color: C.navy, marginBottom: 4 }}>When should we pick up?</div><div style={{ fontSize: 13, color: C.muted }}>Choose your collection day and time slot</div></div>
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
      <div style={{ margin: "16px 16px 0", padding: "12px 14px", borderRadius: 10, background: "#EFF6FF", display: "flex", gap: 10 }}>
        <span>ℹ️</span><div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>Delivery is next day in the same time slot. Express = same-day return within 6 hours.</div>
      </div>
      <BottomBar calc={calc} step={1} canNext={canNext[1]} onNext={() => setStep(2)} onBack={() => setStep(0)} />
    </div>
  );

  if (!submitted && step === 2) {
    const upd = k => e => setForm(f => ({ ...f, [k]: e.target.value }));
    return (
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 100 }}>
        <div style={{ padding: "22px 16px 10px" }}><div style={{ fontSize: 22, fontWeight: 800, color: C.navy, marginBottom: 4 }}>Your details</div><div style={{ fontSize: 13, color: C.muted }}>Where should we come?</div></div>
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
          <span>🔒</span><div style={{ fontSize: 13, color: "#374151", lineHeight: 1.5 }}>Pay on delivery — cash or card. No prepayment required. Free cancellation up to 2h before pickup.</div>
        </div>
        <div style={{ padding: "18px 16px 6px", fontSize: 11, fontWeight: 700, letterSpacing: ".08em", textTransform: "uppercase", color: C.muted }}>Order summary</div>
        <Card style={{ margin: "0 16px" }}>
          {ITEMS.filter(i => qty[i.id] > 0).map(item => (
            <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: `1px solid ${C.faint}` }}>
              <span style={{ fontSize: 14, color: C.muted }}>{item.emoji} {qty[item.id]}× {item.label}</span>
              <span style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>${(qty[item.id] * item.price).toFixed(2)}</span>
            </div>
          ))}
          {calc.discount > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: `1px solid ${C.faint}` }}><span style={{ fontSize: 14, color: C.teal }}>✅ Bundle discount (−15%)</span><span style={{ fontSize: 14, fontWeight: 600, color: C.teal }}>−${calc.discount.toFixed(2)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: `1px solid ${C.faint}` }}><span style={{ fontSize: 14, color: C.muted }}>🚚 Pickup & delivery</span><span style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>${DELIVERY_FEE.toFixed(2)}</span></div>
          {express && <div style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: `1px solid ${C.faint}` }}><span style={{ fontSize: 14, color: C.muted }}>⚡ Express fee</span><span style={{ fontSize: 14, fontWeight: 600, color: C.red }}>+${EXPRESS_FEE.toFixed(2)}</span></div>}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "13px 14px", background: "#F0FAF9", borderTop: `2px solid ${C.teal}` }}><span style={{ fontSize: 15, fontWeight: 700, color: C.navy }}>Total estimate</span><span style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>${calc.total.toFixed(2)}</span></div>
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
          <span style={{ fontSize: 20 }}>📱</span> Confirm via WhatsApp
        </button>
        <Card style={{ width: "100%", maxWidth: 380, marginBottom: 16, textAlign: "left" }}>
          {[["Items", `${calc.totalItems} pieces`], ["Pickup", `${day?.label} ${day?.num} — ${slotObj?.label}`], ["Suburb", form.suburb], ["Name", form.name]].map(([l, v], i, a) => (
            <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "11px 14px", borderBottom: i < a.length - 1 ? `1px solid ${C.faint}` : "none" }}>
              <span style={{ fontSize: 14, color: C.muted }}>{l}</span><span style={{ fontSize: 14, fontWeight: 600, color: C.navy }}>{v}</span>
            </div>
          ))}
          <div style={{ display: "flex", justifyContent: "space-between", padding: "13px 14px", background: "#F0FAF9", borderTop: `2px solid ${C.teal}` }}><span style={{ fontSize: 15, fontWeight: 700, color: C.navy }}>Total</span><span style={{ fontSize: 20, fontWeight: 800, color: C.navy }}>${calc.total.toFixed(2)}</span></div>
        </Card>
        <button onClick={() => { setStep(0); setQty({}); setDayIdx(null); setSlot(null); setExpress(false); setForm({ name:"",phone:"",email:"",address:"",suburb:"",notes:"" }); }} style={{ width: "100%", maxWidth: 380, background: C.faint, color: C.navy, border: "none", borderRadius: 12, padding: "13px", fontSize: 14, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>New Order →</button>
      </div>
    );
  }
}

function AdminPanel() {
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
  const filtered = orders.filter(o => {
    const matchSearch = !search || [o.id, o.customer?.name, o.customer?.suburb, o.customer?.phone].some(v => v?.toLowerCase().includes(search.toLowerCase()));
    return matchSearch && (filterStatus === "all" || o.status === filterStatus);
  });

  if (selected) {
    const nextStatus = STATUS_CONFIG[selected.status]?.next;
    return (
      <div style={{ flex: 1, overflowY: "auto", paddingBottom: 24 }}>
        <div style={{ padding: "16px", display: "flex", alignItems: "center", gap: 12, borderBottom: `1px solid ${C.border}`, background: C.white, position: "sticky", top: 0, zIndex: 10 }}>
          <button onClick={() => setSelected(null)} style={{ background: C.faint, border: "none", borderRadius: 8, padding: "8px 12px", fontSize: 14, cursor: "pointer", fontFamily: "inherit" }}>← Back</button>
          <div style={{ flex: 1 }}><div style={{ fontFamily: "monospace", fontWeight: 800, color: C.navy, fontSize: 14 }}>{selected.id}</div><div style={{ fontSize: 12, color: C.muted }}>{fmtDate(selected.createdAt)}</div></div>
          <StatusBadge status={selected.status} />
        </div>
        <div style={{ padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
          <Card>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.faint}`, fontWeight: 700, fontSize: 13, color: C.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>Customer</div>
            {[["👤 Name", selected.customer?.name], ["📱 Phone", selected.customer?.phone], ["📧 Email", selected.customer?.email || "—"], ["📍 Address", `${selected.customer?.address}, ${selected.customer?.suburb}`], ["🗒️ Notes", selected.customer?.notes || "—"]].map(([l, v]) => (
              <div key={l} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${C.faint}`, gap: 10 }}><span style={{ fontSize: 13, color: C.muted, flexShrink: 0 }}>{l}</span><span style={{ fontSize: 13, fontWeight: 600, color: C.navy, textAlign: "right" }}>{v}</span></div>
            ))}
          </Card>
          <Card>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.faint}`, fontWeight: 700, fontSize: 13, color: C.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>Schedule</div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${C.faint}` }}><span style={{ fontSize: 13, color: C.muted }}>📅 Day</span><span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{selected.schedule?.day}</span></div>
            <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px" }}><span style={{ fontSize: 13, color: C.muted }}>🕐 Slot</span><span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>{selected.schedule?.slot} ({selected.schedule?.time})</span></div>
          </Card>
          <Card>
            <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.faint}`, fontWeight: 700, fontSize: 13, color: C.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>Items</div>
            {selected.items?.map(item => <div key={item.id} style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${C.faint}` }}><span style={{ fontSize: 13, color: C.muted }}>{item.emoji} {item.qty}× {item.label}</span><span style={{ fontSize: 13, fontWeight: 600, color: C.navy }}>${(item.qty * item.price).toFixed(2)}</span></div>)}
            {selected.calc?.discount > 0 && <div style={{ display: "flex", justifyContent: "space-between", padding: "10px 14px", borderBottom: `1px solid ${C.faint}` }}><span style={{ fontSize: 13, color: C.teal }}>Bundle discount</span><span style={{ fontSize: 13, fontWeight: 600, color: C.teal }}>−${selected.calc.discount.toFixed(2)}</span></div>}
            <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: "#F0FAF9", borderTop: `2px solid ${C.teal}` }}><span style={{ fontWeight: 700, color: C.navy }}>Total</span><span style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>${selected.calc?.total?.toFixed(2)}</span></div>
          </Card>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {nextStatus && <Btn variant="teal" onClick={() => updateStatus(selected.id, nextStatus)} style={{ width: "100%" }}>Mark as {STATUS_CONFIG[nextStatus]?.label} →</Btn>}
            {selected.status !== "cancelled" && selected.status !== "delivered" && <Btn variant="danger" onClick={() => updateStatus(selected.id, "cancelled")} style={{ width: "100%" }}>Cancel order</Btn>}
            <Btn variant="ghost" onClick={() => { if (window.confirm("Delete this order permanently?")) deleteOrder(selected.id); }} style={{ width: "100%" }}>🗑️ Delete record</Btn>
          </div>
        </div>
      </div>
    );
  }

  if (activeTab === "dashboard") return (
    <div style={{ flex: 1, overflowY: "auto", padding: "16px", display: "flex", flexDirection: "column", gap: 14 }}>
      <div style={{ fontSize: 18, fontWeight: 800, color: C.navy }}>Dashboard</div>
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
        {[{ label: "Today's orders", val: todayOrders.length, icon: "📦", color: C.navy }, { label: "Today's revenue", val: `$${revenue(todayOrders).toFixed(0)}`, icon: "💰", color: "#10B981" }, { label: "Week orders", val: weekOrders.length, icon: "📅", color: "#8B5CF6" }, { label: "Week revenue", val: `$${revenue(weekOrders).toFixed(0)}`, icon: "📈", color: C.red }].map(k => (
          <Card key={k.label} style={{ padding: "14px" }}><div style={{ fontSize: 22, marginBottom: 4 }}>{k.icon}</div><div style={{ fontSize: 24, fontWeight: 800, color: k.color }}>{k.val}</div><div style={{ fontSize: 12, color: C.muted, marginTop: 2 }}>{k.label}</div></Card>
        ))}
      </div>
      <Card>
        <div style={{ padding: "12px 14px", borderBottom: `1px solid ${C.faint}`, fontWeight: 700, fontSize: 13, color: C.muted, textTransform: "uppercase", letterSpacing: ".06em" }}>Order status</div>
        {Object.entries(STATUS_CONFIG).map(([key]) => (
          <div key={key} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "11px 14px", borderBottom: `1px solid ${C.faint}` }}><StatusBadge status={key} /><span style={{ fontWeight: 800, fontSize: 18, color: C.navy }}>{countByStatus(key)}</span></div>
        ))}
        <div style={{ display: "flex", justifyContent: "space-between", padding: "12px 14px", background: C.faint }}><span style={{ fontWeight: 700, color: C.navy, fontSize: 14 }}>Total orders</span><span style={{ fontWeight: 800, fontSize: 18, color: C.navy }}>{orders.length}</span></div>
      </Card>
      <Btn variant="ghost" onClick={refresh} style={{ width: "100%", textAlign: "center" }}>🔄 Refresh data</Btn>
    </div>
  );

  return (
    <div style={{ flex: 1, overflowY: "auto", display: "flex", flexDirection: "column" }}>
      <div style={{ padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10, borderBottom: `1px solid ${C.border}`, background: C.white }}>
        <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search orders..." style={{ padding: "10px 14px", borderRadius: 10, border: `1.5px solid ${C.border}`, fontSize: 14, fontFamily: "inherit", outline: "none", width: "100%", boxSizing: "border-box" }} />
        <div style={{ display: "flex", gap: 6, overflowX: "auto", scrollbarWidth: "none" }}>
          {["all", ...Object.keys(STATUS_CONFIG)].map(s => <button key={s} onClick={() => setFilter(s)} style={{ flexShrink: 0, padding: "6px 12px", borderRadius: 8, border: "none", background: filterStatus === s ? C.navy : C.faint, color: filterStatus === s ? "#fff" : C.muted, fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "inherit" }}>{s === "all" ? "All" : STATUS_CONFIG[s].label}</button>)}
        </div>
      </div>
      {loading ? <div style={{ padding: 40, textAlign: "center", color: C.muted }}>Loading orders...</div>
        : filtered.length === 0 ? <div style={{ padding: 40, textAlign: "center", color: C.muted }}><div style={{ fontSize: 32, marginBottom: 12 }}>📭</div><div style={{ fontWeight: 600 }}>{orders.length === 0 ? "No orders yet" : "No matching orders"}</div></div>
        : <div style={{ flex: 1, overflowY: "auto", padding: "12px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
          {filtered.map(order => (
            <Card key={order.id} style={{ padding: 0, cursor: "pointer" }} onClick={() => setSelected(order)}>
              <div style={{ padding: "13px 14px" }}>
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
          ))}
        </div>}
    </div>
  );
}

function AdminLogin({ onLogin }) {
  const [pw, setPw] = useState("");
  const [err, setErr] = useState(false);
  return (
    <div style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: 24, gap: 20 }}>
      <div style={{ fontSize: 48 }}>🔐</div>
      <div style={{ fontSize: 22, fontWeight: 800, color: C.navy }}>Admin Access</div>
      <div style={{ fontSize: 13, color: C.muted }}>PressNet Sydney — Operations Panel</div>
      <input type="password" placeholder="Enter admin password" value={pw} onChange={e => { setPw(e.target.value); setErr(false); }} onKeyDown={e => e.key === "Enter" && (pw === ADMIN_PASSWORD ? onLogin() : setErr(true))} style={{ width: "100%", maxWidth: 300, padding: "13px 14px", borderRadius: 10, border: `1.5px solid ${err ? "#EF4444" : C.border}`, fontSize: 15, fontFamily: "inherit", outline: "none", textAlign: "center", boxSizing: "border-box" }} />
      {err && <div style={{ color: "#EF4444", fontSize: 13, fontWeight: 600 }}>Incorrect password</div>}
      <Btn variant="navy" onClick={() => pw === ADMIN_PASSWORD ? onLogin() : setErr(true)} style={{ width: "100%", maxWidth: 300, textAlign: "center" }}>Sign In →</Btn>
      <div style={{ fontSize: 11, color: "#D1D5DB" }}>Hint: pressnet2024</div>
    </div>
  );
}

export default function App() {
  const [view, setView] = useState("home");
  const [adminAuth, setAdminAuth] = useState(false);
  const [adminTab, setAdminTab] = useState("orders");
  const [liveOrders, setLiveOrders] = useState(0);

  useEffect(() => { loadOrders().then(o => setLiveOrders(o.filter(x => x.status === "pending").length)); }, []);

  return (
    <div style={{ fontFamily: "'Inter', -apple-system, sans-serif", background: C.bg, minHeight: "100vh", display: "flex", justifyContent: "center" }}>
      <div style={{ width: "100%", maxWidth: 430, minHeight: "100vh", background: C.white, display: "flex", flexDirection: "column", boxShadow: "0 0 60px rgba(0,0,0,.12)" }}>
        <div style={{ background: C.navy, color: "#fff", padding: "14px 18px", display: "flex", alignItems: "center", gap: 12, position: "sticky", top: 0, zIndex: 100 }}>
          {view === "admin" && <button onClick={() => { setView("home"); setAdminAuth(false); }} style={{ background: "rgba(255,255,255,.1)", border: "none", borderRadius: 8, color: "#fff", padding: "6px 10px", cursor: "pointer", fontSize: 14 }}>←</button>}
          <div style={{ flex: 1 }}><span style={{ fontSize: 18, fontWeight: 800, letterSpacing: "-0.03em" }}>Press<span style={{ color: C.teal }}>Net</span></span><span style={{ fontSize: 12, color: "#6B7280", fontWeight: 400, marginLeft: 8 }}>{view === "admin" ? "Admin" : "Sydney"}</span></div>
          {view === "home" && <button onClick={() => setView("admin")} style={{ background: "rgba(255,255,255,.1)", border: "none", borderRadius: 8, color: "#fff", padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit", display: "flex", alignItems: "center", gap: 6 }}>{liveOrders > 0 && <span style={{ background: C.red, borderRadius: 10, fontSize: 10, fontWeight: 700, padding: "1px 6px" }}>{liveOrders}</span>}Admin</button>}
          {view === "admin" && adminAuth && <div style={{ display: "flex", gap: 6 }}>{["orders", "dashboard"].map(t => <button key={t} onClick={() => setAdminTab(t)} style={{ background: adminTab === t ? "rgba(255,255,255,.2)" : "transparent", border: "none", borderRadius: 8, color: adminTab === t ? "#fff" : "#9CA3AF", padding: "6px 12px", cursor: "pointer", fontSize: 12, fontWeight: 600, fontFamily: "inherit" }}>{t === "orders" ? "📋 Orders" : "📊 Stats"}</button>)}</div>}
        </div>
        {view === "home" && (
          <>
            <div style={{ background: "linear-gradient(135deg, #0D1B2A 0%, #1a3a52 100%)", padding: "20px 18px 22px" }}>
              <div style={{ fontSize: 13, color: C.teal, fontWeight: 600, letterSpacing: ".06em", textTransform: "uppercase", marginBottom: 8 }}>Ironing pickup & delivery · Inner Sydney</div>
              <div style={{ fontSize: 26, fontWeight: 800, color: "#fff", lineHeight: 1.2, marginBottom: 10 }}>Perfectly pressed.<br/><span style={{ color: C.teal }}>Delivered to your door.</span></div>
              <div style={{ display: "flex", gap: 16 }}>{["Pickup in 2h", "Back in 24h", "From $3/item"].map(t => <div key={t} style={{ fontSize: 12, color: "#9CA3AF" }}>✓ {t}</div>)}</div>
            </div>
            <BookingApp onOrderPlaced={() => setLiveOrders(n => n + 1)} />
          </>
        )}
        {view === "admin" && !adminAuth && <AdminLogin onLogin={() => setAdminAuth(true)} />}
        {view === "admin" && adminAuth && <AdminPanel activeTab={adminTab} setActiveTab={setAdminTab} />}
      </div>
    </div>
  );
}
