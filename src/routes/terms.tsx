import { createFileRoute, Link } from "@tanstack/react-router";
import { Navbar } from "@/components/Navbar";

export const Route = createFileRoute("/terms")({
  head: () => ({
    meta: [
      { title: "Terms of Service — PromptStar" },
      { name: "description", content: "PromptStar Terms of Service and usage policy." },
    ],
  }),
  component: TermsPage,
});

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="font-display text-2xl uppercase border-b-4 border-ink mb-3 pb-1">{title}</h2>
      <div className="space-y-3 text-sm leading-relaxed text-ink/80">{children}</div>
    </section>
  );
}

function TermsPage() {
  return (
    <div className="min-h-screen">
      <Navbar />
      <main className="relative z-10 px-6 md:px-12 py-10 max-w-3xl mx-auto">
        <Link to="/" className="text-xs font-bold uppercase tracking-widest text-ink/60 hover:text-magenta">
          ← Back to Market
        </Link>
        <h1 className="font-display text-5xl md:text-6xl uppercase mt-4 mb-2 leading-none">
          Terms of <span className="text-magenta">Service</span>
        </h1>
        <p className="text-xs font-mono text-ink/40 mb-10">Last updated: June 2026</p>

        <Section title="1. Acceptance">
          <p>
            By accessing or using PromptStar ("the Platform"), you agree to be bound by these Terms of Service. If you do not agree, do not use the Platform.
          </p>
        </Section>

        <Section title="2. User-Generated Content">
          <p>
            Users may submit AI prompts and related content ("Listings") to the marketplace. By submitting a Listing, you confirm that:
          </p>
          <ul className="list-disc ml-5 space-y-1">
            <li>You own or have the right to distribute the content.</li>
            <li>The content does not infringe any third-party intellectual property rights.</li>
            <li>The content does not contain NSFW, adult, or illegal material.</li>
            <li>The content is accurate and not misleading.</li>
          </ul>
          <p>
            PromptStar is not liable for user-submitted content. We reserve the right to remove any content at our discretion.
          </p>
        </Section>

        <Section title="3. NSFW & Content Policy">
          <p>
            PromptStar does not permit adult or NSFW content. Any upload detected as NSFW will be automatically blocked. Users who repeatedly attempt to upload prohibited content may be permanently banned.
          </p>
          <p>
            Community members may report listings that violate this policy. Listings with 5 or more reports are automatically removed from the marketplace and queued for admin review.
          </p>
        </Section>

        <Section title="4. Credit System">
          <p>
            PromptStar operates a virtual credit system (✦ Credits). Credits have no real-world monetary value and cannot be withdrawn or exchanged for currency. Credits are earned by:
          </p>
          <ul className="list-disc ml-5 space-y-1">
            <li>Signing up (welcome bonus).</li>
            <li>Publishing a prompt to the marketplace (+2.00 credits).</li>
            <li>Having your prompt copied by another user (+0.07 per copy, one reward per user).</li>
            <li>Having your prompt purchased (70% of the sale price).</li>
          </ul>
          <p>
            The platform retains 30% of all sales and copy rewards as a service fee. Demo top-ups are for testing purposes only.
          </p>
        </Section>

        <Section title="5. Purchases">
          <p>
            All purchases are final. PromptStar does not offer refunds for purchased prompts except in cases of fraudulent listings, as determined solely by PromptStar.
          </p>
          <p>
            Users may not purchase their own listings. Double-purchases are prevented at the database level.
          </p>
        </Section>

        <Section title="6. Listing Limits">
          <p>
            Free-tier accounts may publish up to 10 active listings at any time. Removed or deleted listings do not count toward this limit.
          </p>
        </Section>

        <Section title="7. Account Termination">
          <p>
            PromptStar reserves the right to suspend or terminate accounts that violate these terms, engage in spam, or attempt to manipulate the credit system.
          </p>
        </Section>

        <Section title="8. Disclaimer">
          <p>
            PromptStar is provided "as is" without warranties of any kind. We are not responsible for the accuracy, quality, or suitability of any AI-generated outputs produced using prompts purchased on this platform.
          </p>
        </Section>

        <Section title="9. Changes to Terms">
          <p>
            We may update these Terms at any time. Continued use of the Platform after changes constitutes acceptance of the updated Terms.
          </p>
        </Section>

        <Section title="10. Contact">
          <p>
            Questions? Reach us on{" "}
            <a
              href="https://discord.gg/promptstar"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline hover:text-magenta"
            >
              Discord
            </a>{" "}
            or{" "}
            <a
              href="https://twitter.com/promptstar"
              target="_blank"
              rel="noopener noreferrer"
              className="font-bold underline hover:text-magenta"
            >
              Twitter/X
            </a>.
          </p>
        </Section>
      </main>
    </div>
  );
}
