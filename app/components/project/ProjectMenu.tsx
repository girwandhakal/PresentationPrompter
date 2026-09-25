"use client";

import { Copy, Download, FileText, MoreHorizontal, PenLine, Printer, Replace, SlidersHorizontal, Trash2, Archive } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, type ReactNode } from "react";
import type { Project } from "@/lib/domain/types";
import { exportBackup, exportMarkdown, exportText } from "@/lib/export";
import { hasScript } from "@/lib/domain/planner";
import { useProjects } from "@/lib/store/projects";
import { Button, IconButton } from "../ui/button";
import { Dialog } from "../ui/dialog";
import { Field, Input } from "../ui/field";
import { Menu, type MenuEntry, type MenuTriggerProps } from "../ui/menu";
import { useToast } from "../ui/toast";

export function ProjectMenu({ project, trigger, align = "end" }: {
  project: Project;
  trigger?: (props: MenuTriggerProps) => ReactNode;
  align?: "start" | "end";
}) {
  const router = useRouter();
  const toast = useToast();
  const { update, remove, duplicate } = useProjects();
  const [renaming, setRenaming] = useState(false);
  const [title, setTitle] = useState(project.title);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const scripted = hasScript(project);

  const items: MenuEntry[] = [
    { label: "Rename", icon: <PenLine />, onSelect: () => { setTitle(project.title); setRenaming(true); } },
    { label: "Edit setup", icon: <SlidersHorizontal />, onSelect: () => router.push(`/p/${project.id}/setup`) },
    { label: "Duplicate", icon: <Copy />, onSelect: async () => {
      const copy = await duplicate(project.id);
      if (copy) {
        toast(`Duplicated as “${copy.title}”`);
        router.push(`/p/${copy.id}`);
      }
    } },
    { label: "Replace slides…", icon: <Replace />, onSelect: () => router.push(`/p/${project.id}/replace`) },
    { type: "separator" },
    { type: "label", label: "Export" },
    { label: "Script as Markdown", icon: <FileText />, disabled: !scripted, onSelect: () => exportMarkdown(project) },
    { label: "Script as plain text", icon: <FileText />, disabled: !scripted, onSelect: () => exportText(project) },
    { label: "Print script", icon: <Printer />, disabled: !scripted, onSelect: () => window.open(`/p/${project.id}/print`, "_blank", "noopener") },
    { label: "Backup file", icon: <Archive />, hint: ".cueframe", onSelect: async () => {
      try {
        await exportBackup([project]);
      } catch {
        toast({ message: "The backup couldn't be created.", tone: "error" });
      }
    } },
    { type: "separator" },
    { label: "Delete…", icon: <Trash2 />, tone: "danger", onSelect: () => setConfirmDelete(true) },
  ];

  async function rename(event: React.FormEvent) {
    event.preventDefault();
    const next = title.trim();
    if (!next) return;
    await update(project.id, (current) => ({ ...current, title: next }));
    setRenaming(false);
  }

  async function confirmRemove() {
    setDeleting(true);
    try {
      await remove(project.id);
      setConfirmDelete(false);
      toast(`Deleted “${project.title}”`);
      if (window.location.pathname.startsWith(`/p/${project.id}`)) router.replace("/");
    } catch {
      toast({ message: "The presentation couldn't be deleted. Try again.", tone: "error" });
    } finally {
      setDeleting(false);
    }
  }

  return (
    <>
      <Menu
        label={`Actions for ${project.title}`}
        align={align}
        items={items}
        trigger={trigger ?? ((props) => (
          <IconButton {...props} label="Presentation actions" size="sm" tooltip={false}>
            <MoreHorizontal />
          </IconButton>
        ))}
      />

      <Dialog
        open={renaming}
        onClose={() => setRenaming(false)}
        title="Rename presentation"
        size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setRenaming(false)}>Cancel</Button>
          <Button variant="primary" type="submit" form={`rename-${project.id}`} disabled={!title.trim()}>Rename</Button>
        </>}
      >
        <form id={`rename-${project.id}`} onSubmit={rename}>
          <Field label="Title">
            <Input value={title} onChange={(event) => setTitle(event.target.value)} autoFocus maxLength={160} onFocus={(event) => event.currentTarget.select()} />
          </Field>
        </form>
      </Dialog>

      <Dialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Delete “${project.title}”?`}
        description="This permanently removes the slides, script, versions, and session history from this browser. Download a backup first if you might need it."
        size="sm"
        footer={<>
          <Button variant="ghost" onClick={() => setConfirmDelete(false)}>Keep it</Button>
          <Button variant="secondary" icon={<Download />} onClick={() => exportBackup([project])}>Backup</Button>
          <Button variant="primary" icon={<Trash2 />} loading={deleting} onClick={confirmRemove}>Delete</Button>
        </>}
      />
    </>
  );
}
