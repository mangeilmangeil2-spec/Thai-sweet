import Link from "next/link";

export default function HomePage() {
  return (
    <main
      style={{
        minHeight: "100vh",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "1.5rem",
        fontFamily: "system-ui, sans-serif",
        padding: "2rem",
        textAlign: "center",
      }}
    >
      <h1 style={{ fontSize: "2rem" }}>บุฟเฟต์ขนมไทย</h1>
      <p style={{ color: "#555" }}>ระบบสั่งอาหารและจัดการออเดอร์หน้าร้าน</p>

      <div style={{ display: "flex", gap: "1rem" }}>
        <Link
          href="/generate-qr"
          style={{
            padding: "0.75rem 1.5rem",
            borderRadius: "8px",
            background: "#111",
            color: "#fff",
            textDecoration: "none",
          }}
        >
          สร้าง QR โต๊ะ
        </Link>

        <Link
          href="/kitchen"
          style={{
            padding: "0.75rem 1.5rem",
            borderRadius: "8px",
            border: "1px solid #111",
            color: "#111",
            textDecoration: "none",
          }}
        >
          หน้าครัว
        </Link>
      </div>
    </main>
  );
}
