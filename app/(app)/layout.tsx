import { OrchestratorProvider } from "@/lib/ai/orchestrator";
import { AuthProvider } from "@/lib/auth";
import { ProjectsProvider } from "@/lib/store/projects";
import { AuthGate } from "../components/auth/AuthGate";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <AuthGate>
        <ProjectsProvider>
          <OrchestratorProvider>{children}</OrchestratorProvider>
        </ProjectsProvider>
      </AuthGate>
    </AuthProvider>
  );
}
