import { Landing } from "@/components/landing/landing";

export const metadata = {
  title: "Scalist — Run your real estate photography business",
  description:
    "Booking, travel-aware scheduling, gallery delivery, and automatic invoicing — one platform built for real estate photography studios. Booked. Scheduled. Delivered. Paid.",
  openGraph: {
    title: "Scalist — Booked. Scheduled. Delivered. Paid.",
    description:
      "The operating system for real estate photography studios: bookings, scheduling, delivery, and payments on one rail.",
    url: "https://www.scalist.io",
    siteName: "Scalist",
    type: "website",
  },
};

export default function LandingPage() {
  return <Landing />;
}
