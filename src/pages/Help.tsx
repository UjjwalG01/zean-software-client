import { useMemo, useState } from "react";
import { HelpCircle, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";

interface HelpEntry {
  question: string;
  answer: string;
}

interface HelpSection {
  title: string;
  entries: HelpEntry[];
}

/** Static, in-app user guide. Content is documentation only — no data access. */
const HELP_SECTIONS: HelpSection[] = [
  {
    title: "Getting Started",
    entries: [
      {
        question: "What is this application?",
        answer:
          "It is an outlet management suite for gym, spa and wellness businesses. It covers members, bookings, attendance, point-of-sale billing, inventory, reporting and administration in a single workspace.",
      },
      {
        question: "How do I navigate the app?",
        answer:
          "The left sidebar is grouped into three sections. Main holds day-to-day operations (Dashboard, Members, Bookings, Attendance, Transactions, Inventory, Reports, Forecast, Audit Logs). Setup holds catalogue configuration. Admin holds organisation-level configuration and this Help page.",
      },
      {
        question: "Is there a global search?",
        answer:
          "Yes. Press Ctrl + K (or Cmd + K) anywhere, or click the search bar in the top bar, to jump to members, bookings and transactions.",
      },
      {
        question: "Which date and time does the system use?",
        answer:
          "All dates, times and timestamps use the business timezone (Asia/Kathmandu) from a single shared time source, so records stay consistent regardless of the device clock.",
      },
      {
        question: "What roles are available?",
        answer:
          "Roles are fully custom. An administrator creates roles in Admin → Users & Roles and grants view, add, change and delete rights per module. Menu items and pages hide automatically when a role has no view right.",
      },
    ],
  },
  {
    title: "Members & Bookings",
    entries: [
      {
        question: "How do I register a new member?",
        answer:
          "Go to Members → Add Member. Fill in the profile, choose a membership plan and duration; the expiry date is computed automatically from the plan.",
      },
      {
        question: "How do I create a booking?",
        answer:
          "Open Bookings and pick a slot in the day scheduler, or use the outlet POS view. Bookings can be made for an existing member or for a walk-in guest using the Member/Guest toggle.",
      },
      {
        question: "What do the booking statuses mean?",
        answer:
          "Pending means created but not yet settled. Confirmed and Completed track the service lifecycle. Cancelled, Voided and No-show are terminal states and become read-only.",
      },
      {
        question: "How does attendance check-in work?",
        answer:
          "Attendance supports manual check-in and QR scanning. A scanned code is signature-verified before the visit is recorded, and prepaid balances are deducted automatically where applicable.",
      },
    ],
  },
  {
    title: "Billing & Transactions",
    entries: [
      {
        question: "How does the money model work?",
        answer:
          "Every booking or order first posts a charge (Sales). Payment is recorded separately as a collection. Net Balance = Total Charged − Total Paid, computed by the database so every screen agrees.",
      },
      {
        question: "How do I settle a pending bill?",
        answer:
          "In Transactions, click Settle on a pending row. Choose the payment method, apply any discount, then confirm. Settlement is atomic and guarded so a repeated click cannot create a duplicate bill.",
      },
      {
        question: "Can I see the bill before it is settled?",
        answer:
          "Yes. Pending rows have a preview (eye) button that opens a provisional bill in the exact print format. It is preview only — it records no payment and changes no status.",
      },
      {
        question: "How are VAT and discounts handled?",
        answer:
          "VAT is calculated centrally at the configured rate. Discounts are applied after VAT against the billed amount, so Collection = Billed Amount − Discount.",
      },
      {
        question: "How do I correct a wrong settlement?",
        answer:
          "Void the payment from the transaction row. Voiding reopens the underlying charge and its linked booking; a new settlement can then be recorded. Every void is written to the audit log.",
      },
    ],
  },
  {
    title: "Inventory",
    entries: [
      {
        question: "How do I add a product?",
        answer:
          "Go to Inventory → Product Catalog → Add Item. Assign an item group, store and supplier, and set the reorder level.",
      },
      {
        question: "How do I record stock movement?",
        answer:
          "Use Inventory → Movements to add, issue, adjust or transfer stock. Each movement is ledgered and can be traced back to its user.",
      },
      {
        question: "What is a reorder level?",
        answer:
          "The threshold at which an item is flagged as low stock in the Inventory analytics and dashboard alerts.",
      },
    ],
  },
  {
    title: "Reports & Administration",
    entries: [
      {
        question: "What reports are available?",
        answer:
          "Reports are grouped into Sales, Members, Outlets and Inventory categories, all sharing global date-range and outlet filters. Every report can be printed or exported to CSV.",
      },
      {
        question: "How do I configure my company details and bill format?",
        answer:
          "Admin → Settings holds the company name, address, contacts, VAT/PAN number, logo and bill paper size (A4, A5 or 80mm thermal).",
      },
      {
        question: "What belongs in the Admin section?",
        answer:
          "General Setup, Outlets, Service Types, Stores, Users & Roles, Settings and this Help page — organisation-level configuration that is normally changed rarely and only by administrators.",
      },
      {
        question: "Where can I see who changed what?",
        answer:
          "Audit Logs records create, update, void and delete actions with the acting user, module and timestamp.",
      },
    ],
  },
];

export default function Help() {
  const [query, setQuery] = useState("");

  const sections = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return HELP_SECTIONS;
    return HELP_SECTIONS.map((s) => ({
      ...s,
      entries: s.entries.filter(
        (e) =>
          e.question.toLowerCase().includes(q) ||
          e.answer.toLowerCase().includes(q),
      ),
    })).filter((s) => s.entries.length > 0);
  }, [query]);

  return (
    <div className="mx-auto w-full max-w-3xl space-y-6">
      <header className="flex items-start gap-3">
        <HelpCircle className="h-7 w-7 text-primary mt-0.5" />
        <div>
          <h1 className="text-2xl font-extrabold font-display">Help Center</h1>
          <p className="text-sm text-muted-foreground">
            Find answers to common questions about the app.
          </p>
        </div>
      </header>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search questions..."
          className="pl-9 bg-muted/40"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
      </div>

      {sections.length === 0 && (
        <p className="text-sm text-muted-foreground">
          No help topics match “{query}”.
        </p>
      )}

      {sections.map((section) => (
        <section key={section.title} className="space-y-2">
          <h2 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
            {section.title}
          </h2>
          <Accordion
            type="single"
            collapsible
            className="rounded-xl border border-border bg-card px-4 shadow-sm"
          >
            {section.entries.map((entry) => (
              <AccordionItem key={entry.question} value={entry.question}>
                <AccordionTrigger className="text-sm text-left">
                  {entry.question}
                </AccordionTrigger>
                <AccordionContent className="text-sm text-muted-foreground">
                  {entry.answer}
                </AccordionContent>
              </AccordionItem>
            ))}
          </Accordion>
        </section>
      ))}
    </div>
  );
}
