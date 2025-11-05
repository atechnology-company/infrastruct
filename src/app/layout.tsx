import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Infrastruct",
  description:
    "Infrastruct is a logic-based belief-agnostic jurisprudence framework that interprets various divine sources through the lens of clear logical systems in order to create a coherent legal code.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body
        className={`antialiased`}
      >
        {children}
      </body>
    </html>
  );
}
