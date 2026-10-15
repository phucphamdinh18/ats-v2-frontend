import type { Metadata } from "next";
import "./globals.css";
export const metadata: Metadata = {
  title: "ATS · Tuyển dụng",
  description: "Không gian tuyển dụng ATS V2",
};
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body>{children}</body>
    </html>
  );
}
