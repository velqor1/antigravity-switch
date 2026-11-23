import React from "react";
import ReactDOM from "react-dom/client";
import "@fontsource-variable/manrope";
import "@fontsource-variable/jetbrains-mono";
import App from './App';
import './i18n'; // Import i18n config
import "./App.css";

// Window visibility is owned by the Rust desktop lifecycle.
// A frontend boot must not reopen a background-login or dismissed popover.

ReactDOM.createRoot(document.getElementById("root") as HTMLElement).render(
  <React.StrictMode>
    <App />

  </React.StrictMode>,
);
