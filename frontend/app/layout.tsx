import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "H5P Interactive Video Generator",
  description: "Build H5P interactive videos from YouTube URLs"
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
