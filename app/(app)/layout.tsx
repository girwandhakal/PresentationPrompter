import { OrchestratorProvider } from "@/lib/ai/orchestrator";
import { ProjectsProvider } from "@/lib/store/projects";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <ProjectsProvider>
      <OrchestratorProvider>{children}</OrchestratorProvider>
    </ProjectsProvider>
  );
}
