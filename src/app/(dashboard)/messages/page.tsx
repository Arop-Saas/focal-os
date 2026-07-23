import { redirect } from "next/navigation";

// Client conversations moved into the Collaboration hub ("Order Notes").
export default function MessagesPage() {
  redirect("/collaboration");
}
