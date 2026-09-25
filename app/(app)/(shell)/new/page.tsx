"use client";

import { NewPresentation } from "../../../components/import/NewPresentation";
import { useDocumentTitle } from "@/lib/use-document-title";

export default function NewPresentationPage() {
  useDocumentTitle("New presentation");
  return (
    <div className="page page--narrow">
      <h1 className="page-title">New presentation</h1>
      <NewPresentation />
      <p className="new-footnote">Animations and videos don&apos;t carry over.</p>
    </div>
  );
}
