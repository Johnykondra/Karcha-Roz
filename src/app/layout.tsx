import type { Metadata } from "next";
import { AccountingStateProvider } from "@/components/accounting-state";
import "./globals.css";

export const metadata: Metadata = {
  title: "Accounting App | Clear books, confident decisions",
  description:
    "A clear view of your accounts, journal entries, and financial reports.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en">
      <body>
        <AccountingStateProvider>{children}</AccountingStateProvider>
      </body>
    </html>
  );
}
