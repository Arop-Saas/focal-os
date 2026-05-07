import Link from "next/link";
import { Camera } from "lucide-react";

export const metadata = { title: "Privacy Policy | Scalist" };

export default function PrivacyPage() {
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
        <h1 className="text-4xl font-extrabold tracking-tight mb-2">Privacy Policy</h1>
        <p className="text-gray-500 text-sm mb-12">Last updated: {updated}</p>

        <div className="space-y-10 text-gray-400 leading-relaxed">

          <section>
            <h2 className="text-lg font-bold text-white mb-3">1. Introduction</h2>
            <p>Scalist ("we", "us", "our") is committed to protecting your privacy. This Privacy Policy explains how we collect, use, disclose, and safeguard your information when you use our platform. By using Scalist, you consent to the practices described in this policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">2. Information We Collect</h2>
            <p className="mb-3">We collect information you provide directly, including:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2">
              <li>Account information: name, email address, password</li>
              <li>Studio information: company name, phone number, address, timezone</li>
              <li>Client and job data you enter into the platform</li>
              <li>Photos and files you upload</li>
              <li>Payment information (processed securely by Stripe — we do not store card numbers)</li>
            </ul>
            <p className="mt-3">We also automatically collect usage data such as IP address, browser type, pages visited, and timestamps.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">3. How We Use Your Information</h2>
            <p>We use your information to:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 mt-2">
              <li>Provide, operate, and improve the Service</li>
              <li>Process payments and manage subscriptions</li>
              <li>Send transactional emails (invoices, gallery notifications, booking confirmations)</li>
              <li>Respond to support requests</li>
              <li>Monitor and analyze usage to improve performance</li>
              <li>Comply with legal obligations</li>
            </ul>
            <p className="mt-3">We do not sell your personal data to third parties.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">4. Data Sharing</h2>
            <p>We may share your information with trusted third-party service providers who assist in operating our platform, including:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 mt-2">
              <li><strong className="text-gray-300">Supabase</strong> — database and authentication</li>
              <li><strong className="text-gray-300">Stripe</strong> — payment processing</li>
              <li><strong className="text-gray-300">Vercel</strong> — hosting and infrastructure</li>
              <li><strong className="text-gray-300">Resend / email provider</strong> — transactional email delivery</li>
            </ul>
            <p className="mt-3">These providers are contractually obligated to protect your data and may not use it for their own purposes.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">5. Data Retention</h2>
            <p>We retain your data for as long as your account is active. If you cancel your account, we will delete your data within 30 days, except where we are required to retain it by law. You may request earlier deletion by contacting us.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">6. Security</h2>
            <p>We use industry-standard security measures including encryption in transit (TLS) and at rest, access controls, and regular security reviews. However, no method of transmission over the internet is 100% secure, and we cannot guarantee absolute security.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">7. Cookies</h2>
            <p>We use cookies and similar tracking technologies to maintain your session and analyze usage. Essential cookies are required for the Service to function. You can control non-essential cookies through your browser settings, though this may affect functionality.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">8. Your Rights</h2>
            <p>Depending on your location, you may have the right to:</p>
            <ul className="list-disc list-inside space-y-1.5 ml-2 mt-2">
              <li>Access the personal data we hold about you</li>
              <li>Request correction of inaccurate data</li>
              <li>Request deletion of your data</li>
              <li>Object to or restrict processing of your data</li>
              <li>Data portability (receive your data in a machine-readable format)</li>
            </ul>
            <p className="mt-3">To exercise these rights, contact us at <a href="mailto:hello@scalist.io" className="text-blue-400 hover:text-blue-300">hello@scalist.io</a>.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">9. Children's Privacy</h2>
            <p>Scalist is not directed at children under 13. We do not knowingly collect personal information from children under 13. If we become aware that a child under 13 has provided us with personal information, we will delete it promptly.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">10. Changes to This Policy</h2>
            <p>We may update this Privacy Policy from time to time. We will notify you of significant changes via email or in-app notice. Your continued use of the Service after changes constitutes acceptance of the updated policy.</p>
          </section>

          <section>
            <h2 className="text-lg font-bold text-white mb-3">11. Contact Us</h2>
            <p>If you have questions or concerns about this Privacy Policy, please contact us at <a href="mailto:hello@scalist.io" className="text-blue-400 hover:text-blue-300">hello@scalist.io</a>.</p>
          </section>

        </div>
      </main>

      <footer className="border-t border-white/[0.06] py-8 px-6 text-center text-xs text-gray-700">
        <p>© {new Date().getFullYear()} Scalist. All rights reserved. · <Link href="/terms" className="hover:text-gray-500 transition-colors">Terms of Service</Link></p>
      </footer>
    </div>
  );
}
