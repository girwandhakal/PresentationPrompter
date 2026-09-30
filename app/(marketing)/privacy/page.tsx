import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Privacy",
  description: "How Cueframe handles your presentations during the pilot.",
};

/** A plain summary of how the pilot handles data. The full policy is a launch requirement. */
export default function PrivacyPage() {
  return (
    <section className="band tone-light" aria-labelledby="privacy-title">
      <div className="mk-wrap legal">
        <h1 id="privacy-title">Privacy during the pilot</h1>
        <p>Cueframe is in a small pilot. This page describes how it handles your data today, in plain terms.</p>

        <h2>What we store</h2>
        <ul>
          <li>Your Google account name, email address, and profile picture, so you can sign in.</li>
          <li>Your presentations: slide images, the text read from your slides, your settings, scripts, earlier versions, and presenting times.</li>
          <li>A daily count of how much AI writing your account has used.</li>
        </ul>

        <h2>Who can see it</h2>
        <p>Your presentations belong to your account. Access rules on our database and file storage only let a signed-in owner read them. The audience window receives slide images and nothing else.</p>

        <h2>AI processing</h2>
        <p>To read your slides and write or revise your script, Cueframe sends slide content and your settings to an AI service. It&apos;s sent for that purpose only.</p>

        <h2>Keeping and deleting</h2>
        <p>You can export any script as Markdown or plain text. Deleting a presentation removes it permanently. The pilot keeps no backups, so deleted work, or work lost to a service failure, can&apos;t be recovered.</p>
      </div>
    </section>
  );
}
