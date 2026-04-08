/**
 * pages/_document.js
 * Custom document for font loading and meta tags
 */
import { Html, Head, Main, NextScript } from "next/document";

export default function Document() {
  return (
    <Html lang="en">
      <Head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,400;12..96,600;12..96,700&family=Plus+Jakarta+Sans:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
        <meta name="description" content="ARD CRM — Sales Intelligence for ARD Builders & Developers" />
        <meta name="theme-color" content="#1a3a5c" />
        <link rel="icon" href="data:image/svg+xml,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 32 32'><rect width='32' height='32' rx='6' fill='%231a3a5c'/><text x='50%25' y='55%25' dominant-baseline='middle' text-anchor='middle' fill='%23e8633a' font-size='18' font-weight='700' font-family='sans-serif'>A</text></svg>" />
      </Head>
      <body>
        <Main />
        <NextScript />
      </body>
    </Html>
  );
}
