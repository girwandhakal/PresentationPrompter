import { WorkspaceShell } from "../../components/shell/WorkspaceShell";

export default function ShellLayout({ children }: { children: React.ReactNode }) {
  return <WorkspaceShell>{children}</WorkspaceShell>;
}
