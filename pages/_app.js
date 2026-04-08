/**
 * pages/_app.js
 * Global app wrapper with Toast provider + Auth provider
 */
import "../styles/globals.css";
import { ToastProvider } from "../components/ui/Toast";
import { AuthProvider } from "../hooks/useAuth";

export default function App({ Component, pageProps }) {
  return (
    <AuthProvider>
      <ToastProvider>
        <Component {...pageProps} />
      </ToastProvider>
    </AuthProvider>
  );
}
