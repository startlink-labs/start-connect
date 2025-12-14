import { createRouter, RouterProvider } from "@tanstack/react-router";
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";
import { useUpdater } from "./hooks/useUpdater";
import { QueryProvider } from "./providers/QueryProvider";
import { routeTree } from "./routeTree.gen";
import "./index.css";

const router = createRouter({ routeTree });

declare module "@tanstack/react-router" {
  interface Register {
    router: typeof router;
  }
}

function App() {
  useUpdater();
  return (
    <QueryProvider>
      <RouterProvider router={router} />
    </QueryProvider>
  );
}

const rootElement = document.getElementById("root");
if (!rootElement) throw new Error("Root element not found");
createRoot(rootElement).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
