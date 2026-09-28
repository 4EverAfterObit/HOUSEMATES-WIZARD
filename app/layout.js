import "./globals.css";

export const metadata = {
  title: "Housemates Wizard",
  description: "Split bills, settle up, and share the chores with everyone you live with.",
  manifest: "/manifest.json",
  icons: {
    icon: "/favicon-64.png",
    apple: "/apple-touch-icon.png",
  },
};

export const viewport = {
  themeColor: "#5B3F2C",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,600;12..96,800&family=Figtree:wght@400;500;600&display=swap"
          rel="stylesheet"
        />
      </head>
      <body>{children}</body>
    </html>
  );
}
