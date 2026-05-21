import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Bethany Display Manager",
  description: "Digital signage management for Bethany Baptist Church",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link
          href="https://fonts.googleapis.com/css2?family=Source+Sans+3:wght@300;400;600;900&family=Roboto:wght@300;400&family=Lora:wght@400;500;600&family=DM+Sans:wght@300;400;500&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
