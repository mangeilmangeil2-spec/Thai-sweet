"use client";

import { use, useEffect, useMemo, useState } from "react";
import { supabase } from "../../../lib/supabaseClient";

const BUFFET_PRICE = 199;
const DRINK_PRICE = 39;

export default function OrderPage({ params }) {
  // Next.js เวอร์ชันใหม่: params เป็น Promise ต้อง unwrap ด้วย use()
  const { tableNumber } = use(params);

  const [loadingSession, setLoadingSession] = useState(true);
  const [session, setSession] = useState(null);
  const [notFound, setNotFound] = useState(false);

  const [categories, setCategories] = useState([]);
  const [items, setItems] = useState([]);
  const [activeCategoryId, setActiveCategoryId] = useState(null);
  const [loadingMenu, setLoadingMenu] = useState(true);

  const [cart, setCart] = useState({}); // { [itemId]: { id, name, qty } }
  const [showCart, setShowCart] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [orderMsg, setOrderMsg] = useState("");

  const [showBill, setShowBill] = useState(false);
  const [closingBill, setClosingBill] = useState(false);
  const [thankYou, setThankYou] = useState(false);

  // ---------- โหลด session ของโต๊ะนี้ ----------
  useEffect(() => {
    let cancelled = false;

    async function loadSession() {
      setLoadingSession(true);
      const tNumber = Number(tableNumber);

      const { data, error } = await supabase
        .from("sessions")
        .select("*")
        .eq("table_number", tNumber)
        .eq("status", "open")
        .limit(1);

      if (cancelled) return;

      if (error || !data || data.length === 0) {
        setNotFound(true);
        setSession(null);
      } else {
        setSession(data[0]);
        setNotFound(false);
      }
      setLoadingSession(false);
    }

    loadSession();
    return () => {
      cancelled = true;
    };
  }, [tableNumber]);

  // ---------- โหลดเมนู (เฉพาะตอนมี session ที่เปิดอยู่) ----------
  useEffect(() => {
    if (!session) return;
    let cancelled = false;

    async function loadMenu() {
      setLoadingMenu(true);

      const [{ data: cats, error: catErr }, { data: menuItems, error: itemErr }] =
        await Promise.all([
          supabase
            .from("menu_categories")
            .select("*")
            .order("sort_order", { ascending: true }),
          supabase.from("menu_items").select("*"),
        ]);

      if (cancelled) return;

      if (!catErr && cats) {
        setCategories(cats);
        if (cats.length > 0) setActiveCategoryId(cats[0].id);
      }
      if (!itemErr && menuItems) {
        setItems(menuItems);
      }
      setLoadingMenu(false);
    }

    loadMenu();
    return () => {
      cancelled = true;
    };
  }, [session]);

  const itemsInActiveCategory = useMemo(
    () => items.filter((it) => it.category_id === activeCategoryId),
    [items, activeCategoryId]
  );

  const cartList = Object.values(cart);
  const cartCount = cartList.reduce((sum, it) => sum + it.qty, 0);

  function addToCart(item) {
    setCart((prev) => {
      const existing = prev[item.id];
      return {
        ...prev,
        [item.id]: {
          id: item.id,
          name: item.name,
          qty: existing ? existing.qty + 1 : 1,
        },
      };
    });
  }

  function decreaseFromCart(itemId) {
    setCart((prev) => {
      const existing = prev[itemId];
      if (!existing) return prev;
      if (existing.qty <= 1) {
        const next = { ...prev };
        delete next[itemId];
        return next;
      }
      return { ...prev, [itemId]: { ...existing, qty: existing.qty - 1 } };
    });
  }

  function getQtyInCart(itemId) {
    return cart[itemId]?.qty || 0;
  }

  async function handleSubmitOrder() {
    if (!session || cartList.length === 0) return;
    setSubmitting(true);
    setOrderMsg("");

    try {
      const payloadItems = cartList.map((it) => ({
        item_id: it.id,
        name: it.name,
        qty: it.qty,
      }));

      const { error } = await supabase.from("orders").insert({
        session_id: session.id,
        table_number: Number(tableNumber),
        items: payloadItems,
        status: "received",
      });

      if (error) throw error;

      setCart({});
      setOrderMsg("ส่งออเดอร์เรียบร้อย! ครัวได้รับรายการแล้ว");
      setShowCart(false);
    } catch (err) {
      console.error(err);
      setOrderMsg("ส่งออเดอร์ไม่สำเร็จ: " + (err.message || ""));
    } finally {
      setSubmitting(false);
    }
  }

  const buffetTotal = (session?.buffet_count || 0) * BUFFET_PRICE;
  const drinkTotal = (session?.drink_count || 0) * DRINK_PRICE;
  const grandTotal = buffetTotal + drinkTotal;

  async function handleConfirmBill() {
    if (!session) return;
    setClosingBill(true);
    try {
      const { error } = await supabase
        .from("sessions")
        .update({ status: "closed" })
        .eq("id", session.id);

      if (error) throw error;

      setShowBill(false);
      setThankYou(true);
    } catch (err) {
      console.error(err);
      alert("เรียกเก็บเงินไม่สำเร็จ: " + (err.message || ""));
    } finally {
      setClosingBill(false);
    }
  }

  // ---------- สถานะ: กำลังโหลด ----------
  if (loadingSession) {
    return (
      <main style={fullScreenMsg}>
        <p style={{ fontSize: "1.3rem" }}>กำลังโหลด...</p>
      </main>
    );
  }

  // ---------- สถานะ: โต๊ะยังไม่เปิด ----------
  if (notFound) {
    return (
      <main style={fullScreenMsg}>
        <p style={{ fontSize: "1.5rem", fontWeight: 700, textAlign: "center" }}>
          โต๊ะนี้ยังไม่เปิดใช้งาน
          <br />
          กรุณาแจ้งพนักงาน
        </p>
      </main>
    );
  }

  // ---------- สถานะ: ปิดโต๊ะแล้ว / ขอบคุณที่ใช้บริการ ----------
  if (thankYou) {
    return (
      <main style={fullScreenMsg}>
        <p style={{ fontSize: "2rem", marginBottom: "0.5rem" }}>🙏</p>
        <p style={{ fontSize: "1.6rem", fontWeight: 700, textAlign: "center" }}>
          ขอบคุณที่ใช้บริการ
        </p>
        <p style={{ fontSize: "1.1rem", color: "#666", marginTop: "0.5rem" }}>
          โต๊ะ {tableNumber}
        </p>
      </main>
    );
  }

  // ---------- หน้าสั่งอาหารหลัก ----------
  return (
    <div style={{ paddingBottom: cartCount > 0 ? "90px" : "20px" }}>
      {/* Top bar */}
      <header style={topBar}>
        <div>
          <div style={{ fontSize: "1rem", color: "#888" }}>โต๊ะ</div>
          <div style={{ fontSize: "1.6rem", fontWeight: 800 }}>{tableNumber}</div>
        </div>
        <button style={billButton} onClick={() => setShowBill(true)}>
          💰 เรียกเก็บเงิน
        </button>
      </header>

      {orderMsg && (
        <div style={toast}>
          <span>{orderMsg}</span>
          <button
            onClick={() => setOrderMsg("")}
            style={{ background: "none", border: "none", fontSize: "1.2rem", cursor: "pointer" }}
          >
            ✕
          </button>
        </div>
      )}

      {/* Category tabs */}
      <nav style={tabsWrap}>
        {categories.map((cat) => (
          <button
            key={cat.id}
            onClick={() => setActiveCategoryId(cat.id)}
            style={{
              ...tabButton,
              ...(activeCategoryId === cat.id ? tabButtonActive : {}),
            }}
          >
            {cat.name}
          </button>
        ))}
      </nav>

      {/* Menu list */}
      <section style={{ padding: "0.5rem 1rem 1rem" }}>
        {loadingMenu ? (
          <p style={{ fontSize: "1.1rem", textAlign: "center", marginTop: "2rem" }}>
            กำลังโหลดเมนู...
          </p>
        ) : itemsInActiveCategory.length === 0 ? (
          <p style={{ fontSize: "1.1rem", textAlign: "center", marginTop: "2rem", color: "#888" }}>
            ยังไม่มีเมนูในหมวดนี้
          </p>
        ) : (
          itemsInActiveCategory.map((item) => {
            const qty = getQtyInCart(item.id);
            return (
              <div key={item.id} style={menuRow}>
                <span style={{ fontSize: "1.15rem", fontWeight: 600 }}>{item.name}</span>

                {qty === 0 ? (
                  <button style={addButton} onClick={() => addToCart(item)}>
                    + เพิ่ม
                  </button>
                ) : (
                  <div style={stepperWrap}>
                    <button style={stepperButton} onClick={() => decreaseFromCart(item.id)}>
                      −
                    </button>
                    <span style={{ fontSize: "1.2rem", fontWeight: 700, minWidth: "24px", textAlign: "center" }}>
                      {qty}
                    </span>
                    <button style={stepperButton} onClick={() => addToCart(item)}>
                      +
                    </button>
                  </div>
                )}
              </div>
            );
          })
        )}
      </section>

      {/* Floating cart bar */}
      {cartCount > 0 && (
        <button style={floatingCartBar} onClick={() => setShowCart(true)}>
          🧺 ตะกร้า ({cartCount} รายการ) — แตะเพื่อดู/ส่งออเดอร์
        </button>
      )}

      {/* Cart modal */}
      {showCart && (
        <div style={overlay} onClick={() => setShowCart(false)}>
          <div style={sheetBox} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: "1.4rem", marginTop: 0 }}>ตะกร้าของคุณ</h2>

            {cartList.length === 0 ? (
              <p>ไม่มีรายการในตะกร้า</p>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", maxHeight: "40vh", overflowY: "auto" }}>
                {cartList.map((it) => (
                  <div key={it.id} style={cartRow}>
                    <span style={{ fontSize: "1.1rem", fontWeight: 600 }}>{it.name}</span>
                    <div style={stepperWrap}>
                      <button style={stepperButton} onClick={() => decreaseFromCart(it.id)}>
                        −
                      </button>
                      <span style={{ fontSize: "1.1rem", fontWeight: 700, minWidth: "24px", textAlign: "center" }}>
                        {it.qty}
                      </span>
                      <button
                        style={stepperButton}
                        onClick={() => addToCart({ id: it.id, name: it.name })}
                      >
                        +
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
              <button style={secondaryButton} onClick={() => setShowCart(false)}>
                ปิด
              </button>
              <button
                style={primaryButton}
                onClick={handleSubmitOrder}
                disabled={submitting || cartList.length === 0}
              >
                {submitting ? "กำลังส่ง..." : "ส่งออเดอร์"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Bill popup */}
      {showBill && (
        <div style={overlay} onClick={() => !closingBill && setShowBill(false)}>
          <div style={sheetBox} onClick={(e) => e.stopPropagation()}>
            <h2 style={{ fontSize: "1.4rem", marginTop: 0 }}>สรุปยอดเงิน</h2>

            <div style={{ fontSize: "1.15rem", lineHeight: 2 }}>
              <div style={billRow}>
                <span>บุฟเฟต์ขนมไทย</span>
                <span>
                  {session?.buffet_count || 0} x {BUFFET_PRICE} ={" "}
                  {buffetTotal.toLocaleString()} บาท
                </span>
              </div>
              <div style={billRow}>
                <span>น้ำรีฟิล</span>
                <span>
                  {session?.drink_count || 0} x {DRINK_PRICE} ={" "}
                  {drinkTotal.toLocaleString()} บาท
                </span>
              </div>
              <hr style={{ margin: "0.5rem 0" }} />
              <div style={{ ...billRow, fontWeight: 800, fontSize: "1.3rem" }}>
                <span>ยอดรวมทั้งสิ้น</span>
                <span>{grandTotal.toLocaleString()} บาท</span>
              </div>
            </div>

            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1.25rem" }}>
              <button
                style={secondaryButton}
                onClick={() => setShowBill(false)}
                disabled={closingBill}
              >
                ยกเลิก
              </button>
              <button
                style={primaryButton}
                onClick={handleConfirmBill}
                disabled={closingBill}
              >
                {closingBill ? "กำลังปิด..." : "ยืนยันเรียกเก็บเงิน"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ---------- styles ----------

const fullScreenMsg = {
  minHeight: "100vh",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  justifyContent: "center",
  padding: "2rem",
  fontFamily: "system-ui, sans-serif",
  textAlign: "center",
};

const topBar = {
  position: "sticky",
  top: 0,
  zIndex: 20,
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "0.85rem 1rem",
  background: "#fff",
  borderBottom: "1px solid #eee",
  fontFamily: "system-ui, sans-serif",
};

const billButton = {
  fontSize: "1rem",
  fontWeight: 700,
  padding: "0.6rem 1rem",
  borderRadius: "999px",
  border: "2px solid #111",
  background: "#fff",
  cursor: "pointer",
};

const toast = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  background: "#e8f8ee",
  color: "#1e7d3c",
  padding: "0.75rem 1rem",
  fontSize: "1rem",
  fontWeight: 600,
};

const tabsWrap = {
  display: "flex",
  gap: "0.5rem",
  overflowX: "auto",
  padding: "0.75rem 1rem",
  fontFamily: "system-ui, sans-serif",
  WebkitOverflowScrolling: "touch",
};

const tabButton = {
  flex: "0 0 auto",
  padding: "0.6rem 1.1rem",
  borderRadius: "999px",
  border: "2px solid #ddd",
  background: "#fff",
  fontSize: "1rem",
  fontWeight: 600,
  whiteSpace: "nowrap",
  cursor: "pointer",
};

const tabButtonActive = {
  background: "#111",
  color: "#fff",
  border: "2px solid #111",
};

const menuRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
  padding: "1rem 0.25rem",
  borderBottom: "1px solid #f0f0f0",
  fontFamily: "system-ui, sans-serif",
};

const addButton = {
  fontSize: "1rem",
  fontWeight: 700,
  padding: "0.6rem 1.1rem",
  borderRadius: "10px",
  border: "none",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
};

const stepperWrap = {
  display: "flex",
  alignItems: "center",
  gap: "0.75rem",
};

const stepperButton = {
  width: "40px",
  height: "40px",
  borderRadius: "50%",
  border: "2px solid #111",
  background: "#fff",
  fontSize: "1.4rem",
  fontWeight: 700,
  lineHeight: 1,
  cursor: "pointer",
};

const floatingCartBar = {
  position: "fixed",
  bottom: "16px",
  left: "16px",
  right: "16px",
  padding: "1.1rem",
  borderRadius: "14px",
  border: "none",
  background: "#111",
  color: "#fff",
  fontSize: "1.15rem",
  fontWeight: 700,
  cursor: "pointer",
  boxShadow: "0 4px 16px rgba(0,0,0,0.25)",
  zIndex: 30,
};

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "flex-end",
  justifyContent: "center",
  zIndex: 40,
};

const sheetBox = {
  background: "#fff",
  borderTopLeftRadius: "20px",
  borderTopRightRadius: "20px",
  padding: "1.5rem",
  width: "100%",
  maxWidth: "480px",
  boxSizing: "border-box",
  fontFamily: "system-ui, sans-serif",
};

const cartRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const billRow = {
  display: "flex",
  justifyContent: "space-between",
};

const primaryButton = {
  flex: 1,
  fontSize: "1.1rem",
  fontWeight: 700,
  padding: "0.9rem",
  borderRadius: "12px",
  border: "none",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
};

const secondaryButton = {
  flex: 1,
  fontSize: "1.1rem",
  fontWeight: 700,
  padding: "0.9rem",
  borderRadius: "12px",
  border: "2px solid #111",
  background: "#fff",
  color: "#111",
  cursor: "pointer",
};
