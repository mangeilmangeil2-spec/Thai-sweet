"use client";

import { useState } from "react";
import { supabase } from "../../lib/supabaseClient";

const BUFFET_PRICE = 199;
const DRINK_PRICE = 39;

const inputStyle = {
  width: "100%",
  fontSize: "1.3rem",
  padding: "0.75rem 1rem",
  borderRadius: "10px",
  border: "2px solid #ddd",
  boxSizing: "border-box",
};

const labelStyle = {
  fontSize: "1.1rem",
  fontWeight: 600,
  marginBottom: "0.4rem",
  display: "block",
};

const buttonPrimary = {
  fontSize: "1.3rem",
  fontWeight: 700,
  padding: "1rem",
  width: "100%",
  borderRadius: "12px",
  border: "none",
  background: "#111",
  color: "#fff",
  cursor: "pointer",
};

const buttonSecondary = {
  ...buttonPrimary,
  background: "#fff",
  color: "#111",
  border: "2px solid #111",
};

const buttonDanger = {
  ...buttonPrimary,
  background: "#c0392b",
};

export default function GenerateQrPage() {
  const [tableNumber, setTableNumber] = useState("");
  const [buffetCount, setBuffetCount] = useState("");
  const [drinkCount, setDrinkCount] = useState("");

  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const [existingSession, setExistingSession] = useState(null); // แถวเก่าที่ยัง open อยู่
  const [showCloseConfirm, setShowCloseConfirm] = useState(false);
  const [closing, setClosing] = useState(false);

  const [qrData, setQrData] = useState(null); // { tableNumber, buffetCount, drinkCount, url }
  const [copied, setCopied] = useState(false);

  function resetForm() {
    setTableNumber("");
    setBuffetCount("");
    setDrinkCount("");
    setErrorMsg("");
    setExistingSession(null);
    setShowCloseConfirm(false);
    setQrData(null);
    setCopied(false);
  }

  function buildOrderUrl(tNumber) {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    return `${origin}/order/${tNumber}`;
  }

  async function handleOpenTable(e) {
    e.preventDefault();
    setErrorMsg("");

    const tNumber = Number(tableNumber);
    const bCount = Number(buffetCount);
    const dCount = Number(drinkCount);

    if (!tNumber || tNumber <= 0) {
      setErrorMsg("กรุณากรอกเลขโต๊ะให้ถูกต้อง");
      return;
    }
    if (bCount < 0 || dCount < 0 || (bCount === 0 && dCount === 0)) {
      setErrorMsg("กรุณากรอกจำนวนคนอย่างน้อย 1 ท่าน");
      return;
    }

    setLoading(true);
    try {
      // 1) เช็คว่าโต๊ะนี้มี session ที่ยัง open อยู่หรือไม่
      const { data: openSessions, error: checkError } = await supabase
        .from("sessions")
        .select("*")
        .eq("table_number", tNumber)
        .eq("status", "open")
        .limit(1);

      if (checkError) throw checkError;

      if (openSessions && openSessions.length > 0) {
        setExistingSession(openSessions[0]);
        setLoading(false);
        return;
      }

      // 2) ไม่มีโต๊ะเปิดอยู่ -> insert session ใหม่
      const { error: insertError } = await supabase.from("sessions").insert({
        table_number: tNumber,
        buffet_count: bCount,
        drink_count: dCount,
        status: "open",
      });

      if (insertError) throw insertError;

      setQrData({
        tableNumber: tNumber,
        buffetCount: bCount,
        drinkCount: dCount,
        url: buildOrderUrl(tNumber),
      });
    } catch (err) {
      console.error(err);
      setErrorMsg("เกิดข้อผิดพลาด: " + (err.message || "ไม่ทราบสาเหตุ"));
    } finally {
      setLoading(false);
    }
  }

  function minutesSince(createdAt) {
    if (!createdAt) return "-";
    const diffMs = Date.now() - new Date(createdAt).getTime();
    return Math.max(0, Math.floor(diffMs / 60000));
  }

  async function handleConfirmCloseOldSession() {
    if (!existingSession) return;
    setClosing(true);
    try {
      const { error } = await supabase
        .from("sessions")
        .update({ status: "closed" })
        .eq("id", existingSession.id);

      if (error) throw error;

      setShowCloseConfirm(false);
      setExistingSession(null);
      setErrorMsg("");
    } catch (err) {
      console.error(err);
      setErrorMsg("ปิดออเดอร์เดิมไม่สำเร็จ: " + (err.message || ""));
    } finally {
      setClosing(false);
    }
  }

  async function handleCopyLink() {
    if (!qrData) return;
    try {
      await navigator.clipboard.writeText(qrData.url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (err) {
      console.error(err);
    }
  }

  // ---------- หน้าจอสำเร็จ: แสดง QR ----------
  if (qrData) {
    const qrSrc = `https://api.qrserver.com/v1/create-qr-code/?size=300x300&data=${encodeURIComponent(
      qrData.url
    )}`;

    return (
      <main style={pageWrap}>
        <div style={cardCenter}>
          <h1 style={{ fontSize: "1.8rem", marginBottom: "0.25rem" }}>
            ✅ เปิดโต๊ะสำเร็จ
          </h1>

          <p style={{ fontSize: "1.3rem", fontWeight: 700, margin: "0.5rem 0" }}>
            โต๊ะ {qrData.tableNumber} | ขนมไทย {qrData.buffetCount} ท่าน | น้ำรีฟิล{" "}
            {qrData.drinkCount} ท่าน
          </p>

          <img
            src={qrSrc}
            alt={`QR Code โต๊ะ ${qrData.tableNumber}`}
            width={300}
            height={300}
            style={{ borderRadius: "12px", border: "1px solid #eee" }}
          />

          <p
            style={{
              fontSize: "1rem",
              wordBreak: "break-all",
              background: "#f5f5f5",
              padding: "0.75rem",
              borderRadius: "8px",
              marginTop: "1rem",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            {qrData.url}
          </p>

          <button style={buttonSecondary} onClick={handleCopyLink}>
            {copied ? "คัดลอกแล้ว ✓" : "คัดลอกลิงก์"}
          </button>

          <button
            style={{ ...buttonPrimary, marginTop: "0.75rem" }}
            onClick={resetForm}
          >
            เปิดโต๊ะใหม่
          </button>
        </div>
      </main>
    );
  }

  // ---------- หน้าจอหลัก: ฟอร์ม ----------
  return (
    <main style={pageWrap}>
      <div style={cardCenter}>
        <h1 style={{ fontSize: "1.8rem", marginBottom: "1rem" }}>
          เปิดโต๊ะบุฟเฟต์ขนมไทย
        </h1>

        {existingSession ? (
          <div style={warningBox}>
            <p style={{ fontSize: "1.2rem", fontWeight: 700, margin: 0 }}>
              ⚠️ โต๊ะนี้มีลูกค้าอยู่
            </p>
            <p style={{ fontSize: "1.05rem", margin: "0.5rem 0 1rem" }}>
              กรุณาปิดออเดอร์เดิมก่อน
            </p>
            <button
              style={buttonDanger}
              onClick={() => setShowCloseConfirm(true)}
            >
              ปิดออเดอร์เดิม
            </button>
            <button
              style={{ ...buttonSecondary, marginTop: "0.75rem" }}
              onClick={() => setExistingSession(null)}
            >
              ยกเลิก
            </button>
          </div>
        ) : (
          <form
            onSubmit={handleOpenTable}
            style={{ width: "100%", display: "flex", flexDirection: "column", gap: "1.1rem" }}
          >
            <div>
              <label style={labelStyle}>เลขโต๊ะ</label>
              <input
                type="number"
                inputMode="numeric"
                min="1"
                style={inputStyle}
                value={tableNumber}
                onChange={(e) => setTableNumber(e.target.value)}
                placeholder="เช่น 1"
                required
              />
            </div>

            <div>
              <label style={labelStyle}>
                จำนวนบุฟเฟต์ขนมไทย (คน) — {BUFFET_PRICE} บาท/คน
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                style={inputStyle}
                value={buffetCount}
                onChange={(e) => setBuffetCount(e.target.value)}
                placeholder="0"
                required
              />
            </div>

            <div>
              <label style={labelStyle}>
                จำนวนน้ำรีฟิล (คน) — {DRINK_PRICE} บาท/คน
              </label>
              <input
                type="number"
                inputMode="numeric"
                min="0"
                style={inputStyle}
                value={drinkCount}
                onChange={(e) => setDrinkCount(e.target.value)}
                placeholder="0"
                required
              />
            </div>

            {errorMsg && (
              <p style={{ color: "#c0392b", fontWeight: 600 }}>{errorMsg}</p>
            )}

            <button type="submit" style={buttonPrimary} disabled={loading}>
              {loading ? "กำลังเปิดโต๊ะ..." : "เปิดโต๊ะ"}
            </button>
          </form>
        )}
      </div>

      {/* Confirm Dialog ปิดออเดอร์เดิม */}
      {showCloseConfirm && existingSession && (
        <div style={overlay}>
          <div style={modalBox}>
            <h2 style={{ fontSize: "1.4rem", marginTop: 0 }}>
              ยืนยันปิดออเดอร์เดิม?
            </h2>
            <p style={{ fontSize: "1.1rem", lineHeight: 1.8 }}>
              โต๊ะ {existingSession.table_number}
              <br />
              ผู้ใหญ่ {existingSession.buffet_count} คน
              <br />
              เปิดมาแล้ว {minutesSince(existingSession.created_at)} นาที
            </p>
            <div style={{ display: "flex", gap: "0.75rem", marginTop: "1rem" }}>
              <button
                style={buttonSecondary}
                onClick={() => setShowCloseConfirm(false)}
                disabled={closing}
              >
                ยกเลิก
              </button>
              <button
                style={buttonDanger}
                onClick={handleConfirmCloseOldSession}
                disabled={closing}
              >
                {closing ? "กำลังปิด..." : "ยืนยันปิดออเดอร์"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

const pageWrap = {
  minHeight: "100vh",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1.5rem",
  fontFamily: "system-ui, sans-serif",
  background: "#fafafa",
};

const cardCenter = {
  width: "100%",
  maxWidth: "440px",
  display: "flex",
  flexDirection: "column",
  alignItems: "center",
  textAlign: "center",
  background: "#fff",
  borderRadius: "16px",
  padding: "2rem 1.5rem",
  boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
};

const warningBox = {
  width: "100%",
  background: "#fff8e1",
  border: "2px solid #f1c40f",
  borderRadius: "12px",
  padding: "1.5rem 1rem",
};

const overlay = {
  position: "fixed",
  inset: 0,
  background: "rgba(0,0,0,0.5)",
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  padding: "1rem",
  zIndex: 50,
};

const modalBox = {
  background: "#fff",
  borderRadius: "16px",
  padding: "1.75rem",
  width: "100%",
  maxWidth: "360px",
  boxSizing: "border-box",
};
