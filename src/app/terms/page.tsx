import Link from "next/link";
import { Camera } from "lucide-react";

export const metadata = { title: "Terms of Service | Scalist" };

export default function TermsPage() {
  const updated = "March 18, 2026";
  return (
    <div className="min-h-screen bg-[#080808] text-white">
      {/* Nav */}
      <nav className="border-b border-white/[0.06] px-6 h-14 flex items-center">
        <Link href="/" className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-blue-500 to-violet-500 flex items-center justify-center">
            <Camera className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-white tracking-tight">Scalist</span>
        </Link>
      </nav>

      <main className="max-w-3xl mx-auto px-6 py-16">
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Terms of Service</h1>
        <p className="text-gray-500 text-sm mb-12">Last updated: {updated}</p>

        <div className="space-y-10 text-gray-400 leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-white mb-3">1. Acceptance of Terms</h2>
            <p>By accessing or using Scalist ("Service"), you agree to be bound by these Terms of Service. If you do not agree to these terms, do not use the Service. These terms apply to all users, including studio owners, photographers, and clients.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">2. Description of Service</h2>
            <p>Scalist is a SaaS platform for real estate photography businesses. It provides tools for job scheduling, photo gallery delivery, client invoicing, team management, and related workflows. Features are subject to change at any time.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">3. Accounts</h2>
            <p>You must provide accurate information when creating an account. You are responsible for maintaining the security of your account credentials. You must notify us immediately at <a href="mailto:hello@scalist.io" className="text-blue-400 hover:text-blue-300">hello@scalist.io</a> of any unauthorized access. We reserve the right to terminate accounts that violate these terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">4. Subscriptions & Billing</h2>
            <p>Scalist offers paid subscription plans billed monthly. Your 14-day free trial begins on the date of account creation. No credit card is required to start your trial. After the trial, continued use requires a paid plan. All fees are non-refundable except as required by law. We may change pricing with 30 days' notice.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">5. Acceptable Use</h2>
            <p>You agree not to use Scalist to: upload illegal or infringing content; send unsolicited communications; attempt to reverse-engineer or disrupt the Service; impersonate any person or entity; or violate any applicable laws or regulations.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">6. Your Content</h2>
            <p>You retain ownership of all content you upload (photos, documents, data). By uploading content, you grant Scalist a limited license to store and display it solely to provide the Service. We do not sell your content or use it for advertising. You are responsible for ensuring you have the rights to any content you upload.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">7. Intellectual Property</h2>
            <p>Scalist and its original content, features, and functionality are owned by Scalist and protected by applicable intellectual property laws. You may not copy, modify, or distribute any part of the Service without our express written consent.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">8. Limitation of Liability</h2>
            <p>To the maximum extent permitted by law, Scalist shall not be liable for any indirect, incidental, special, consequential, or punitive damages, including loss of profits or data. Our total liability shall not exceed the amount paid by you in the 12 months preceding the claim.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">9. Disclaimer of Warranties</h2>
            <p>The Service is provided "as is" without warranties of any kind, express or implied. We do not warrant that the Service will be uninterrupted, error-free, or free of viruses or other harmful components.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">10. Termination</h2>
            <p>You may cancel your account at any time from the billing settings. We may suspend or terminate your access for violations of these terms. Upon termination, your right to use the Service ceases immediately. We may retain your data for up to 30 days after termination before deletion.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">11. Changes to Terms</h2>
            <p>We reserve the right to modify these terms at any time. We will notify you of significant changes by email or in-app notification. Continued use after changes constitutes acceptance of the new terms.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">12. Governing Law</h2>
            <p>These terms are governed by the laws of the Province of Ontario, Canada, without regard to conflict of law principles. Any disputes shall be resolved in the courts of Ontario.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">13. Contact</h2>
            <p>Questions about these Terms of Service should be sent to <a href="mailto:hello@scalist.io" className="text-blue-400 hover:text-blue-300">hello@scalist.io</a>.</p>
          </section>

        </div>
      </main>

      <footer className="border-t border-white/[0.06] py-8 px-6 text-center text-xs text-gray-700">
        <p>© {new Date().getFullYear()} Scalist. All rights reserved. · <Link href="/privacy" className="hover:text-gray-500 transition-colors">Privacy Policy</Link></p>
      </footer>
    </div>
  );
}
