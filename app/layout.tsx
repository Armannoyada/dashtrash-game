import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "DashTrash",
  description: "A chaotic gesture-style obstacle racing game.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
