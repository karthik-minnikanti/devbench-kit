import React from "react";
import ReactDOM from "react-dom/client";
import { WellnessBreakCard } from "./components/WellnessBreakCard";
import "./styles/index.css";

ReactDOM.createRoot(document.getElementById("root")!).render(
  <React.StrictMode>
    <WellnessBreakCard />
  </React.StrictMode>,
);
