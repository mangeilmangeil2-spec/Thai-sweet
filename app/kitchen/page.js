"use client";

import { useEffect, useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const ACTIVE_STATUSES = ["received", "cooking"];

function sortByCreatedAtAsc(list) {
  return [...list].sort(
    (a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
  );
}

function formatTime(dateStr) {
  const d = new Date(dateStr);
  return d.toLocaleTimeString("th-TH", { hour: "2-digit", minute: "2-digit" });
}

function minutesAgo(dateStr, nowTick) {
  const diffMs = nowTick - new Date(dateStr).getTime();
  return Math.max(0, Math.floor(diffMs / 60000));
}

export default function KitchenPage() {
  const [orders, setOrders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [nowTick, setNowTick] = useState(Date.now());

  // นาฬิกาไว้อัปเดต "สั่งมาแล้ว N นาที" ทุก 30 วินาที
  useEffect(() => {
    const timer = setInterval(() => setNowTick(Date.now()), 30000);
    return () => clearInterval(timer);
  }, []);

  // โหลดออเดอร์เริ่มต้น + subscribe realtime
  useEffect(() => {
    let cancelled = false;

    async function loadInitial() {
      setLoading(true);
      const { data, error } = await supabase
        .from("orders")
        .select("*")
        .in("status", ACTIVE_STATUSES)
        .order("created_at", { ascending: true });

      if (!cancelled && !error && data) {
        setOrders(data);
      }
      setLoading(false);
    }

    loadInitial();

    function upsertOrder(row) {
      setOrders((prev) => {
        const filtered = prev.filter((o) => o.id !== row.id);
        if (ACTIVE_STATUSES.includes(row.status)) {
          return sortByCreatedAtAsc([...filtered, row]);
        }
        return filtered; // served / closed ฯลฯ -> เอาออกจากจอ
      });
    }

    const channel = supabase
      .channel("kitchen-orders")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "orders" },
        (payload) => upsertOrder(payload.new)
      )
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "orders" },
        (payload) => upsertOrder(payload.new)
      )
      .subscribe();

    return () => {
      cancelled = true;
      supabase.removeChannel(channel);
    };
  }, []);

  async function updateStatus(orderId, newStatus) {
    // อัปเดตหน้าจอทันที (optimistic) แล้วให้ realtime ยืนยันซ้ำ
    setOrders((prev) => {
      if (newStatus === "served") {
        return prev.filter((o) => o.id !== orderId);
      }
      return prev.map((o) => (o.id === orderId ? { ...o, status: newStatus } : o));
    });

    const { error } = await supabase
      .from("orders")
      .update({ status: newStatus })
      .eq("id", orderId);

    if (error) {
      console.error("อัปเดตสถานะไม่สำเร็จ", error);
      // โหลดใหม่เผื่อ optimistic update ผิดพลาด
      const { data } = await supabase
        .from("orders")
        .select("*")
        .in("status", ACTIVE_STATUSES)
        .order("created_at", { ascending: true });
      if (data) setOrders(data);
    }
  }

  return (
    <main style={pageWrap}>
      <header style={header}>
        <h1 style={{ fontSize: "2rem", margin: 0 }}>🍳 จอครัว</h1>
        <span style={{ fontSize: "1.2rem", color: "#666" }}>
          {orders.length} ออเดอร์ค้าง
        </span>
      </header>

      {loading ? (
        <p style={{ fontSize: "1.3rem", textAlign: "center", marginTop: "3rem" }}>
          กำลังโหลด...
        </p>
      ) : orders.length === 0 ? (
        <p style={{ fontSize: "1.5rem", textAlign: "center", marginTop: "3rem", color: "#999" }}>
          ยังไม่มีออเดอร์ค้าง 🎉
        </p>
      ) : (
        <div style={grid}>
          {orders.map((order) => {
            const isCooking = order.status === "cooking";
            const items = Array.isArray(order.items) ? order.items : [];

            return (
              <div
                key={order.id}
                style={{
                  ...card,
                  ...(isCooking ? cardCooking : cardReceived),
                }}
              >
                <div style={cardTop}>
                  <span style={tableNumberStyle}>โต๊ะ {order.table_number}</span>
                  <div style={{ textAlign: "right" }}>
                    <div style={{ fontSize: "1.1rem", fontWeight: 700 }}>
                      {formatTime(order.created_at)}
                    </div>
                    <div style={{ fontSize: "1rem", color: "#555" }}>
                      {minutesAgo(order.created_at, nowTick)} นาทีที่แล้ว
                    </div>
                  </div>
                </div>

                <ul style={itemList}>
                  {items.length === 0 ? (
                    <li style={{ fontSize: "1.1rem", color: "#888" }}>—</li>
                  ) : (
                    items.map((it, idx) => (
                      <li key={idx} style={itemLine}>
                        <span>{it.name}</span>
                        <span style={{ fontWeight: 800 }}>x{it.qty}</span>
                      </li>
                    ))
                  )}
                </ul>

                <div style={buttonRow}>
                  {order.status === "received" && (
                    <button
                      style={btnCooking}
                      onClick={() => updateStatus(order.id, "cooking")}
                    >
                      กำลังจัดเตรียม
                    </button>
                  )}
                  <button
                    style={btnServed}
                    onClick={() => updateStatus(order.id, "served")}
                  >
                    เสิร์ฟแล้ว
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </main>
  );
}

// ---------- styles ----------

const pageWrap = {
  minHeight: "100vh",
  background: "#f4f4f4",
  fontFamily: "system-ui, sans-serif",
  padding: "1.5rem",
  boxSizing: "border-box",
};

const header = {
  display: "flex",
  alignItems: "baseline",
  justifyContent: "space-between",
  marginBottom: "1.5rem",
};

const grid = {
  display: "grid",
  gridTemplateColumns: "repeat(auto-fill, minmax(300px, 1fr))",
  gap: "1.25rem",
};

const card = {
  borderRadius: "18px",
  padding: "1.25rem",
  boxShadow: "0 2px 10px rgba(0,0,0,0.08)",
  border: "3px solid transparent",
  display: "flex",
  flexDirection: "column",
  gap: "0.75rem",
};

const cardReceived = {
  background: "#ffffff",
  borderColor: "#3498db",
};

const cardCooking = {
  background: "#fff3d6",
  borderColor: "#f39c12",
};

const cardTop = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "flex-start",
};

const tableNumberStyle = {
  fontSize: "2.2rem",
  fontWeight: 900,
  lineHeight: 1,
};

const itemList = {
  listStyle: "none",
  margin: 0,
  padding: 0,
  display: "flex",
  flexDirection: "column",
  gap: "0.4rem",
};

const itemLine = {
  display: "flex",
  justifyContent: "space-between",
  fontSize: "1.25rem",
  fontWeight: 600,
  borderBottom: "1px dashed #ddd",
  paddingBottom: "0.3rem",
};

const buttonRow = {
  display: "flex",
  gap: "0.6rem",
  marginTop: "auto",
};

const btnCooking = {
  flex: 1,
  fontSize: "1.05rem",
  fontWeight: 700,
  padding: "0.85rem",
  borderRadius: "10px",
  border: "none",
  background: "#f39c12",
  color: "#fff",
  cursor: "pointer",
};

const btnServed = {
  flex: 1,
  fontSize: "1.05rem",
  fontWeight: 700,
  padding: "0.85rem",
  borderRadius: "10px",
  border: "none",
  background: "#27ae60",
  color: "#fff",
  cursor: "pointer",
};
