export const metadata = {
  title: "บุฟเฟต์ขนมไทย",
  description: "ระบบสั่งอาหารสำหรับร้านบุฟเฟต์ขนมไทย",
};

export default function RootLayout({ children }) {
  return (
    <html lang="th">
      <body>{children}</body>
    </html>
  );
}
