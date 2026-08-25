import { createRoot } from "react-dom/client";
import App from "./App";
import { ThemeProvider } from "./components/ThemeProvider";
import "./index.css";
import { registerNativeNotificationRouting } from "./utils/notifications";

registerNativeNotificationRouting();

createRoot(document.getElementById("root")!).render(
  <ThemeProvider>
    <App />
  </ThemeProvider>
);
