import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { Toaster } from "@/components/ui/sonner"
import { TourProvider } from "@/components/tour"
import { fullSteps, menuSteps, editorSteps, connectionSteps, librarySteps } from "@/lib/tour-constants"

const tours = [
  { id: "full", steps: fullSteps },
  { id: "menu", steps: menuSteps },
  { id: "editor", steps: editorSteps },
  { id: "connection", steps: connectionSteps },
  { id: "library", steps: librarySteps },
];

const initialTourCompleted = typeof window !== "undefined" && localStorage.getItem("bluestep-tour-completed") === "true";

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <TourProvider
      tours={tours}
      isTourCompleted={initialTourCompleted}
      onComplete={() => localStorage.setItem("bluestep-tour-completed", "true")}
      onSkip={() => localStorage.setItem("bluestep-tour-completed", "true")}
      closeable
    >
      <App />
      <Toaster />
    </TourProvider>
  </StrictMode>,
)
