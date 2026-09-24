"use client";

import { NewPresentation } from "../../../components/import/NewPresentation";
import { useDocumentTitle } from "@/lib/use-document-title";

export default function NewPresentationPage() {
  useDocumentTitle("New presentation");
  return (
    <div className="page page--narrow">
      <h1 className="page-title">New presentation</h1>
      <p className="page-lede">Upload your slides. Next, you&apos;ll tell Cueframe about your audience and timing, then it writes your script.</p>
      <NewPresentation />
      <p className="new-footnote">
        Using Keynote or Google Slides? Export to PDF first. Animations and videos don&apos;t carry over, so each slide shows its final state.
      </p>
    </div>
  );
}
