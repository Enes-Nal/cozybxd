import type { Metadata } from "next";
import "./globals.css";
import { Providers } from "@/components/providers";
import Script from "next/script";

export const metadata: Metadata = {
  title: "cozybxd - Discovery Hub",
  description: "A collaborative film discovery platform for groups to synchronize watchlists, vote on movie nights, and maintain shared cinematic histories.",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-96x96.png", sizes: "96x96", type: "image/png" },
      { url: "/favicon-128x128.png", sizes: "128x128", type: "image/png" },
      { url: "/favicon-196x196.png", sizes: "196x196", type: "image/png" },
    ],
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
    other: [
      { rel: "android-chrome-192x192", url: "/android-chrome-192x192.png", sizes: "192x192", type: "image/png" },
      { rel: "android-chrome-512x512", url: "/android-chrome-512x512.png", sizes: "512x512", type: "image/png" },
    ],
  },
  manifest: "/site.webmanifest",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css" />
        <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700&display=swap" rel="stylesheet" />
        <link href="https://fonts.googleapis.com/css2?family=Poppins:wght@300;400;500;600;700&display=swap" rel="stylesheet" />
      </head>
      <body>
        <Script
          id="theme-init"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `
              (function() {
                // Migration: Apply new defaults to all users (one-time)
                const settingsVersion = localStorage.getItem('settingsVersion');
                const currentVersion = '2.0'; // Version with new defaults
                
                if (settingsVersion !== currentVersion) {
                  // Apply new defaults to all users
                  const defaultAccent = '#f59e0b';
                  const defaultNavbar = 'true';
                  
                  // Migrate accent color: if not set or using old default (pink), use new default (yellow-orange)
                  const savedAccent = localStorage.getItem('accent');
                  if (!savedAccent || savedAccent === '#FF47C8') {
                    localStorage.setItem('accent', defaultAccent);
                  }
                  
                  // Migrate navbar: set to true for all users (new default)
                  localStorage.setItem('useNavbar', defaultNavbar);
                  
                  // Mark migration as complete
                  localStorage.setItem('settingsVersion', currentVersion);
                }
                
                // Apply theme
                const savedTheme = localStorage.getItem('theme');
                if (savedTheme === 'light') {
                  document.body.classList.add('light-mode');
                } else {
                  document.body.classList.remove('light-mode');
                  if (!savedTheme) {
                    localStorage.setItem('theme', 'dark');
                  }
                }
                
                // Apply accent color
                const savedAccent = localStorage.getItem('accent');
                if (savedAccent) {
                  document.documentElement.style.setProperty('--accent-color', savedAccent);
                } else {
                  const defaultAccent = '#f59e0b';
                  document.documentElement.style.setProperty('--accent-color', defaultAccent);
                  localStorage.setItem('accent', defaultAccent);
                }
                
                // Navbar is handled in components, but ensure default is set
                const savedNavbar = localStorage.getItem('useNavbar');
                if (savedNavbar === null) {
                  localStorage.setItem('useNavbar', 'true');
                }
                
                // Apply corner radius
                const savedCornerRadius = localStorage.getItem('cornerRadius');
                if (savedCornerRadius) {
                  document.documentElement.style.setProperty('--corner-radius', savedCornerRadius);
                } else {
                  document.documentElement.style.setProperty('--corner-radius', '25px');
                }
                
                // Apply font family
                const savedFontFamily = localStorage.getItem('fontFamily');
                if (savedFontFamily) {
                  let fontFamilyValue = '';
                  switch (savedFontFamily) {
                    case 'Inter':
                      fontFamilyValue = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
                      break;
                    case 'Roboto':
                      fontFamilyValue = "'Roboto', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
                      break;
                    case 'Poppins':
                      fontFamilyValue = "'Poppins', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
                      break;
                    default:
                      fontFamilyValue = "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif";
                  }
                  document.documentElement.style.setProperty('--font-family', fontFamilyValue);
                }
                
                // Apply glass blur
                const savedGlass = localStorage.getItem('glass');
                if (savedGlass === 'off') {
                  document.documentElement.style.setProperty('--glass-blur', '0px');
                } else {
                  document.documentElement.style.setProperty('--glass-blur', '10px');
                }
              })();
            `,
          }}
        />
        <Providers>
          {children}
        </Providers>
      </body>
    </html>
  );
}
