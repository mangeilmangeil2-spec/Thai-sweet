# บุฟเฟต์ขนมไทย — ระบบสั่งอาหาร

โปรเจกต์ Next.js (App Router, JavaScript) สำหรับสั่งอาหารหน้าร้าน buffet ขนมไทย
เชื่อมต่อกับ Supabase และ deploy บน Vercel

## เริ่มต้นใช้งาน

```bash
npm install
cp .env.local.example .env.local   # แล้วใส่ค่าจริงจาก Supabase
npm run dev
```

บน Vercel: ตั้งค่า Environment Variables สองตัวนี้ใน Project Settings > Environment Variables
(ชื่อต้องขึ้นต้นด้วย `NEXT_PUBLIC_` เพราะต้องใช้งานฝั่ง client ด้วย):

- `NEXT_PUBLIC_SUPABASE_URL`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY`

## โครงสร้างฐานข้อมูล Supabase (อ้างอิง — มีอยู่แล้ว ไม่ต้องสร้างใหม่)

**sessions**
| column | type |
|---|---|
| id | uuid / bigint (PK) |
| table_number | int |
| buffet_count | int |
| drink_count | int |
| status | text |
| created_at | timestamp |

**menu_categories**
| column | type |
|---|---|
| id | uuid / bigint (PK) |
| name | text |
| sort_order | int |

**menu_items**
| column | type |
|---|---|
| id | uuid / bigint (PK) |
| category_id | FK → menu_categories.id |
| name | text |

**orders**
| column | type |
|---|---|
| id | uuid / bigint (PK) |
| session_id | FK → sessions.id |
| table_number | int |
| items | jsonb |
| status | text |
| created_at | timestamp |

## ⚠️ สำคัญ: Dynamic Route params เป็น Promise

โปรเจกต์นี้ใช้ Next.js เวอร์ชันล่าสุด ซึ่ง `params` (และ `searchParams`) ใน Dynamic Route
**ไม่ใช่ object ธรรมดาอีกต่อไป แต่เป็น Promise** ต้อง unwrap ด้วย `use()` จาก React เสมอ

ตัวอย่างที่ถูกต้อง สำหรับหน้า เช่น `app/table/[tableNumber]/page.js`:

```jsx
"use client";
import { use } from "react";

export default function TablePage({ params }) {
  const { tableNumber } = use(params);
  // ใช้ tableNumber ต่อได้เลย
  return <div>โต๊ะ {tableNumber}</div>;
}
```

ถ้าเป็น Server Component (async function) สามารถ `await params` ได้โดยตรงแทน `use()`:

```jsx
export default async function TablePage({ params }) {
  const { tableNumber } = await params;
  return <div>โต๊ะ {tableNumber}</div>;
}
```

**อย่า** เขียน `params.tableNumber` ตรง ๆ โดยไม่ unwrap เพราะจะ error หรือได้ค่า undefined

## หน้าที่ยังต้องสร้างเพิ่ม (ยังไม่ได้อยู่ใน scaffold นี้)

- `/generate-qr` — หน้าสร้าง QR code ต่อโต๊ะ
- `/kitchen` — หน้าจอครัวดูออเดอร์แบบ realtime
- `/table/[tableNumber]` — หน้าสั่งอาหารของลูกค้าแต่ละโต๊ะ
