import { createRoot } from "react-dom/client";
import { App } from "./app/App.tsx";
import "./styles/app.css";

const root = document.getElementById("root");
if (!root) throw new Error("the renderer document has no #root element");

createRoot(root).render(<App />);
