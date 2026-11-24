"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import { useAccountingState } from "@/components/accounting-state";
import type {
  Account,
  AccountGroup,
  JournalEntry,
  JournalEntryDraft,
} from "@/components/accounting-data";

const sections: { label: string; href: string; icon: string }[] = [
  { label: "Dashboard", href: "/", icon: "grid" },
  { label: "Chart of Accounts", href: "/chart-of-accounts", icon: "layers" },
  { label: "Journal Entries", href: "/journal-entries", icon: "book" },
  { label: "Trial Balance", href: "/trial-balance", icon: "scale" },
  { label: "Reports", href: "/reports", icon: "chart" },
];

const groups: AccountGroup[] = ["Assets", "Liabilities", "Equity", "Revenue", "Expenses"];

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-AE", {
    style: "currency",
    currency: "AED",
    maximumFractionDigits: 2,
  }).format(value);
}

function formatDate(value: string) {
  return new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  }).format(new Date(`${value}T00:00:00`));
}

function getAccountBalances(entries: JournalEntry[], accounts: Account[]) {
  const activity = new Map(
    accounts.map((account) => [account.id, { debit: 0, credit: 0 }]),
  );

  for (const entry of entries) {
    for (const line of entry.lines) {
      const totals = activity.get(line.accountId);
      if (totals) {
        totals.debit += line.debit;
        totals.credit += line.credit;
      }
    }
  }

  return accounts.map((account) => {
    const totals = activity.get(account.id) ?? { debit: 0, credit: 0 };
    const net = totals.debit - totals.credit;
    const naturalBalance =
      account.normalBalance === "debit" ? net : -net;
    return {
      ...account,
      debit: Math.max(account.normalBalance === "debit" ? naturalBalance : -naturalBalance, 0),
      credit: Math.max(account.normalBalance === "credit" ? naturalBalance : -naturalBalance, 0),
    };
  });
}

type AccountBalance = ReturnType<typeof getAccountBalances>[number];

function getAccountAmount(account: AccountBalance) {
  return account.group === "Assets" || account.group === "Expenses"
    ? account.debit - account.credit
    : account.credit - account.debit;
}

function getGroupTotal(balances: AccountBalance[], group: AccountGroup) {
  return balances
    .filter((account) => account.group === group)
    .reduce((total, account) => total + getAccountAmount(account), 0);
}

function isCostOfGoodsSold(account: Account) {
  return /\b(cogs|cost of goods sold|cost of sales|direct costs?|cost of services)\b/i.test(
    account.name,
  );
}

function isNonCurrentAsset(account: Account) {
  return /\b(equipment|property|plant|building|vehicle|land|accumulated depreciation|intangible|fixed asset|long.?term)\b/i.test(
    account.name,
  );
}

function isLongTermLiability(account: Account) {
  return /\b(long.?term|loan|mortgage|bond|lease)\b/i.test(account.name);
}

function isCashAccount(account: Account) {
  return /\b(cash|bank)\b/i.test(account.name);
}

function formatPercent(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return `${new Intl.NumberFormat("en-AE", { maximumFractionDigits: 2 }).format(value)}%`;
}

function formatRatio(value: number | null) {
  if (value === null || !Number.isFinite(value)) return "N/A";
  return `${new Intl.NumberFormat("en-AE", { maximumFractionDigits: 2 }).format(value)}x`;
}

function Icon({ name, size = 18 }: { name: string; size?: number }) {
  const paths: Record<string, React.ReactNode> = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /></>,
    layers: <><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 12 9 5 9-5M3 16l9 5 9-5" /></>,
    book: <><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5v-12Z" /><path d="M4 17.5A2.5 2.5 0 0 1 6.5 15H20M8 7h8M8 10h6" /></>,
    scale: <><path d="M12 3v18M5 6h14M7 6l-4 8h8L7 6Zm10 0-4 8h8l-4-8ZM8 21h8" /></>,
    chart: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 6-7" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 4.5 4.5" /></>,
    bell: <><path d="M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9ZM10 21h4" /></>,
    arrow: <><path d="M7 17 17 7M7 7h10v10" /></>,
    download: <><path d="M12 3v12m0 0 4-4m-4 4-4-4M4 17v4h16v-4" /></>,
    plus: <><path d="M12 5v14M5 12h14" /></>,
    chevron: <path d="m9 18 6-6-6-6" />,
    wallet: <><rect x="3" y="6" width="18" height="15" rx="2" /><path d="M3 9V5a2 2 0 0 1 2-2h13M16 14h5" /><circle cx="16" cy="14" r=".7" /></>,
    dots: <><circle cx="5" cy="12" r="1" /><circle cx="12" cy="12" r="1" /><circle cx="19" cy="12" r="1" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
  };

  return (
    <svg
      aria-hidden="true"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name] ?? paths.grid}
    </svg>
  );
}

function PageHeading({
  eyebrow,
  title,
  subtitle,
  action,
}: {
  eyebrow: string;
  title: string;
  subtitle: string;
  action?: ReactNode;
}) {
  return (
    <div className="page-heading">
      <div>
        <p className="eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="page-subtitle">{subtitle}</p>
      </div>
      {action}
    </div>
  );
}

function DashboardPage({
  entries,
  balances,
}: {
  entries: JournalEntry[];
  balances: ReturnType<typeof getAccountBalances>;
}) {
  const cash = balances.find((account) => account.code === "1000")?.debit ?? 0;
  const revenue = balances
    .filter((account) => account.group === "Revenue")
    .reduce((sum, account) => sum + account.credit, 0);
  const expenses = balances
    .filter((account) => account.group === "Expenses")
    .reduce((sum, account) => sum + account.debit, 0);
  const profit = revenue - expenses;

  return (
    <>
      <PageHeading
        eyebrow="MONDAY, 10 NOVEMBER 2025"
        title="Good morning, Johny"
        subtitle="Here’s what’s happening with your business today."
        action={
          <Link className="button button-primary" href="/journal-entries">
            <Icon name="plus" size={17} />
            New journal entry
          </Link>
        }
      />
      <div className="summary-grid">
        <article className="summary-card">
          <div className="summary-top"><span>Cash &amp; bank</span><span className="summary-icon green"><Icon name="wallet" /></span></div>
          <strong>{formatCurrency(cash)}</strong>
          <div className="summary-foot"><span className="trend up"><Icon name="arrow" size={13} /> 8.2%</span><span>vs. last month</span></div>
          <span className="card-sparkline spark-green" aria-hidden="true">⌁</span>
        </article>
        <article className="summary-card">
          <div className="summary-top"><span>Total revenue</span><span className="summary-icon blue"><Icon name="chart" /></span></div>
          <strong>{formatCurrency(revenue)}</strong>
          <div className="summary-foot"><span className="trend up"><Icon name="arrow" size={13} /> 12.6%</span><span>vs. last month</span></div>
          <span className="card-sparkline spark-blue" aria-hidden="true">⌁</span>
        </article>
        <article className="summary-card">
          <div className="summary-top"><span>Total expenses</span><span className="summary-icon amber"><Icon name="layers" /></span></div>
          <strong>{formatCurrency(expenses)}</strong>
          <div className="summary-foot"><span className="trend neutral">On track</span><span>this month</span></div>
          <span className="card-sparkline spark-amber" aria-hidden="true">⌁</span>
        </article>
        <article className="summary-card">
          <div className="summary-top"><span>Net profit</span><span className="summary-icon violet"><Icon name="scale" /></span></div>
          <strong className={profit < 0 ? "negative-number" : ""}>{formatCurrency(profit)}</strong>
          <div className="summary-foot"><span className="trend down">This month</span><span>after expenses</span></div>
          <span className="card-sparkline spark-violet" aria-hidden="true">⌁</span>
        </article>
      </div>

      <div className="dashboard-grid">
        <section className="panel cashflow-panel">
          <div className="panel-heading">
            <div><h2>Cash flow</h2><p>Income and expenses over time</p></div>
            <button type="button" className="select-button">Last 12 months <span>⌄</span></button>
          </div>
          <div className="chart-legend"><span><i className="legend-dot income-dot" /> Income</span><span><i className="legend-dot expense-dot" /> Expenses</span></div>
          <div className="cashflow-chart">
            <div className="chart-y-labels"><span>60k</span><span>45k</span><span>30k</span><span>15k</span><span>0</span></div>
            <div className="chart-area">
              <div className="chart-gridlines"><i /><i /><i /><i /><i /></div>
              <svg viewBox="0 0 720 190" preserveAspectRatio="none" role="img" aria-label="Monthly cash flow trend from January to December">
                <defs>
                  <linearGradient id="incomeFill" x1="0" x2="0" y1="0" y2="1">
                    <stop offset="0%" stopColor="#2b9c77" stopOpacity=".17" />
                    <stop offset="100%" stopColor="#2b9c77" stopOpacity="0" />
                  </linearGradient>
                </defs>
                <path d="M0 148 C36 140 43 118 65 124 S101 148 131 122 S166 111 196 118 S230 85 262 96 S294 116 327 88 S362 71 393 83 S427 104 458 72 S492 64 524 76 S556 49 589 60 S625 74 655 39 S691 50 720 22 L720 190 L0 190 Z" fill="url(#incomeFill)" />
                <path d="M0 148 C36 140 43 118 65 124 S101 148 131 122 S166 111 196 118 S230 85 262 96 S294 116 327 88 S362 71 393 83 S427 104 458 72 S492 64 524 76 S556 49 589 60 S625 74 655 39 S691 50 720 22" fill="none" stroke="#258c6d" strokeWidth="3" vectorEffect="non-scaling-stroke" />
                <path d="M0 169 C39 164 49 158 65 163 S103 169 131 153 S168 152 196 158 S231 142 262 148 S296 156 327 139 S363 137 393 145 S428 152 458 132 S493 128 524 138 S556 126 589 130 S625 138 655 113 S692 124 720 107" fill="none" stroke="#b8c5d3" strokeWidth="2" strokeDasharray="5 6" vectorEffect="non-scaling-stroke" />
              </svg>
              <div className="chart-months"><span>Jan</span><span>Feb</span><span>Mar</span><span>Apr</span><span>May</span><span>Jun</span><span>Jul</span><span>Aug</span><span>Sep</span><span>Oct</span><span>Nov</span><span>Dec</span></div>
            </div>
          </div>
          <div className="chart-totals"><div><span>Total income</span><strong>{formatCurrency(revenue)}</strong></div><div><span>Total expenses</span><strong>{formatCurrency(expenses)}</strong></div></div>
        </section>

        <section className="panel quick-panel">
          <div className="panel-heading"><div><h2>At a glance</h2><p>Your books, at a glance</p></div><span className="status-pill"><i /> Balanced</span></div>
          <div className="health-score"><div className="ring-chart"><div><strong>98</strong><span>Excellent</span></div></div></div>
          <p className="health-caption">Your books are looking healthy. Keep it up!</p>
          <div className="health-row"><span><i className="health-dot dot-green" /> Reconciled accounts</span><strong>4 / 4</strong></div>
          <div className="health-row"><span><i className="health-dot dot-blue" /> Entries this month</span><strong>{entries.length}</strong></div>
          <div className="health-row"><span><i className="health-dot dot-amber" /> Awaiting review</span><strong>0</strong></div>
          <Link href="/trial-balance" className="text-link">View trial balance <Icon name="chevron" size={15} /></Link>
        </section>
      </div>

      <section className="panel activity-panel">
        <div className="panel-heading">
          <div><h2>Recent journal entries</h2><p>Your latest recorded transactions</p></div>
          <Link href="/journal-entries" className="text-link">View all entries <Icon name="chevron" size={15} /></Link>
        </div>
        <EntriesTable entries={entries.slice(0, 5)} compact />
      </section>
    </>
  );
}

function EntriesTable({
  entries,
  compact = false,
}: {
  entries: JournalEntry[];
  compact?: boolean;
}) {
  return (
    <div className="table-scroll">
      <table className={compact ? "data-table compact-table" : "data-table"}>
        <thead><tr><th>ENTRY</th><th>DESCRIPTION</th><th>ACCOUNT</th><th>DATE</th><th className="align-right">AMOUNT</th><th>STATUS</th></tr></thead>
        <tbody>
          {entries.map((entry) => (
            <tr key={entry.id}>
              <td><span className="entry-id">{entry.entryNumber}</span></td>
              <td><span className="table-primary">{entry.description}</span></td>
              <td><span className="table-secondary">{entry.lines.filter((line) => line.debit > 0).map((line) => line.accountName).join(", ")} / {entry.lines.filter((line) => line.credit > 0).map((line) => line.accountName).join(", ")}</span></td>
              <td>{formatDate(entry.date)}</td>
              <td className="align-right amount-cell">{formatCurrency(entry.lines.reduce((sum, line) => sum + line.debit, 0))}</td>
              <td><span className="posted-pill"><i /> Posted</span></td>
            </tr>
          ))}
          {entries.length === 0 && <tr><td className="empty-row" colSpan={6}>No journal entries match your search.</td></tr>}
        </tbody>
      </table>
    </div>
  );
}

function ChartOfAccountsPage({
  balances,
}: {
  balances: ReturnType<typeof getAccountBalances>;
}) {
  return (
    <>
      <PageHeading eyebrow="YOUR LEDGER" title="Chart of Accounts" subtitle="A clear structure for every dollar in and out." />
      <div className="summary-grid compact-summary">
        {groups.map((group) => {
          const groupAccounts = balances.filter((account) => account.group === group);
          const value = groupAccounts.reduce((sum, account) => sum + account.debit + account.credit, 0);
          return <div className="summary-card mini-summary" key={group}><span>{group}</span><strong>{formatCurrency(value)}</strong><small>{groupAccounts.length} accounts</small></div>;
        })}
      </div>
      <section className="panel accounts-panel">
        <div className="panel-heading"><div><h2>All accounts</h2><p>Grouped by account type</p></div><span className="count-pill">{balances.length} accounts</span></div>
        <div className="account-groups">
          {groups.map((group) => {
            const groupAccounts = balances.filter((account) => account.group === group);
            return (
              <div className="account-group" key={group}>
                <div className="group-heading"><span className={`group-marker marker-${group.toLowerCase()}`} /><h3>{group}</h3><span>{groupAccounts.length} accounts</span></div>
                <div className="account-table-head"><span>CODE</span><span>ACCOUNT NAME</span><span>TYPE</span><span className="align-right">BALANCE (AED)</span></div>
                {groupAccounts.map((account) => (
                  <div className="account-row" key={account.code}>
                    <span className="account-code">{account.code}</span>
                    <span className="account-name">{account.name}</span>
                    <span className="account-type">{account.group}</span>
                    <span className="account-balance">{formatCurrency(account.debit + account.credit)}</span>
                  </div>
                ))}
              </div>
            );
          })}
        </div>
      </section>
    </>
  );
}

type JournalLineForm = {
  key: string;
  accountId: string;
  debit: string;
  credit: string;
};

function JournalEntriesPage({
  entries,
  accounts,
  onPost,
}: {
  entries: JournalEntry[];
  accounts: Account[];
  onPost: (draft: JournalEntryDraft) => Promise<void>;
}) {
  const [query, setQuery] = useState("");
  const [showForm, setShowForm] = useState(false);
  const [lines, setLines] = useState<JournalLineForm[]>([
    { key: "line-1", accountId: "", debit: "", credit: "" },
    { key: "line-2", accountId: "", debit: "", credit: "" },
  ]);
  const [formError, setFormError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const filteredEntries = entries.filter((entry) =>
    `${entry.entryNumber} ${entry.description} ${entry.lines.map((line) => `${line.accountCode} ${line.accountName}`).join(" ")}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  const totalDebits = entries.reduce(
    (sum, entry) => sum + entry.lines.reduce((lineSum, line) => lineSum + line.debit, 0),
    0,
  );
  const totalCredits = entries.reduce(
    (sum, entry) => sum + entry.lines.reduce((lineSum, line) => lineSum + line.credit, 0),
    0,
  );
  const draftDebits = lines.reduce((sum, line) => sum + Number(line.debit || 0), 0);
  const draftCredits = lines.reduce((sum, line) => sum + Number(line.credit || 0), 0);
  const isDraftBalanced = Math.round((draftDebits - draftCredits) * 100) === 0;
  const isDraftValid =
    lines.length >= 2 &&
    draftDebits > 0 &&
    isDraftBalanced &&
    lines.every((line) => {
      const debit = Number(line.debit || 0);
      const credit = Number(line.credit || 0);
      return line.accountId && Number.isFinite(debit) && Number.isFinite(credit) &&
        debit >= 0 && credit >= 0 && ((debit > 0) !== (credit > 0));
    });

  function updateLine(key: string, changes: Partial<JournalLineForm>) {
    setLines((current) =>
      current.map((line) => line.key === key ? { ...line, ...changes } : line),
    );
    setFormError("");
  }

  async function submitEntry(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (!isDraftValid) {
      setFormError("Entry not posted: choose an account for every line and make total debits equal total credits.");
      return;
    }
    const formData = new FormData(event.currentTarget);
    const description = String(formData.get("description")).trim();
    const date = String(formData.get("date"));
    if (!description || !date) return;
    setIsSaving(true);
    try {
      await onPost({
        date,
        description,
        lines: lines.map((line) => ({
          accountId: line.accountId,
          debit: Number(line.debit || 0),
          credit: Number(line.credit || 0),
        })),
      });
      setShowForm(false);
      setLines([
        { key: `line-${Date.now()}-1`, accountId: "", debit: "", credit: "" },
        { key: `line-${Date.now()}-2`, accountId: "", debit: "", credit: "" },
      ]);
    } catch (error) {
      setFormError(error instanceof Error ? error.message : String(error));
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <>
      <PageHeading
        eyebrow="TRANSACTIONS"
        title="Journal Entries"
        subtitle="Every transaction, recorded and accounted for."
        action={<button type="button" className="button button-primary" onClick={() => setShowForm(true)}><Icon name="plus" size={17} /> New entry</button>}
      />
      <div className="summary-grid compact-summary">
        <div className="summary-card mini-summary"><span>Total entries</span><strong>{entries.length}</strong><small>All recorded transactions</small></div>
        <div className="summary-card mini-summary"><span>Total debits</span><strong>{formatCurrency(totalDebits)}</strong><small>All posted journal lines</small></div>
        <div className="summary-card mini-summary"><span>Total credits</span><strong>{formatCurrency(totalCredits)}</strong><small>All posted journal lines</small></div>
      </div>
      <section className="panel entries-panel">
        <div className="panel-heading entries-toolbar">
          <div><h2>All journal entries</h2><p>Showing {filteredEntries.length} of {entries.length} entries</p></div>
          <label className="search-field"><Icon name="search" size={17} /><input value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Search entries..." aria-label="Search journal entries" /></label>
        </div>
        <EntriesTable entries={filteredEntries} />
        <div className="table-footer"><span>Unbalanced entries cannot be posted.</span><span>{formatCurrency(totalDebits)} total posted</span></div>
      </section>
      {showForm && (
        <div className="modal-backdrop" onMouseDown={(event) => { if (event.target === event.currentTarget) setShowForm(false); }}>
          <section className="entry-modal" role="dialog" aria-modal="true" aria-labelledby="entry-modal-title">
            <div className="modal-heading"><div><p className="eyebrow">NEW TRANSACTION</p><h2 id="entry-modal-title">Create journal entry</h2></div><button type="button" className="icon-button close-button" aria-label="Close dialog" onClick={() => setShowForm(false)}>×</button></div>
            <p className="modal-note">Add account lines. Total debits must equal total credits before posting.</p>
            <form onSubmit={submitEntry}>
              <label>Description<input name="description" placeholder="e.g. Client project payment" required autoFocus /></label>
              <label>Date<input name="date" type="date" defaultValue="2025-11-11" required /></label>
              <div className="journal-lines-editor">
                <div className="journal-line-heading"><span>ACCOUNT</span><span>DEBIT (AED)</span><span>CREDIT (AED)</span><span /></div>
                {lines.map((line, index) => (
                  <div className="journal-line-fields" key={line.key}>
                    <label><span className="sr-only">Account for line {index + 1}</span><select value={line.accountId} onChange={(event) => updateLine(line.key, { accountId: event.target.value })} required><option value="">Select account</option>{accounts.filter((account) => account.isActive).map((account) => <option value={account.id} key={account.id}>{account.code} · {account.name}</option>)}</select></label>
                    <label><span className="sr-only">Debit for line {index + 1}</span><input aria-label={`Debit for line ${index + 1}`} type="number" min="0" step="0.01" value={line.debit} onChange={(event) => updateLine(line.key, { debit: event.target.value, credit: "" })} placeholder="0.00" /></label>
                    <label><span className="sr-only">Credit for line {index + 1}</span><input aria-label={`Credit for line ${index + 1}`} type="number" min="0" step="0.01" value={line.credit} onChange={(event) => updateLine(line.key, { credit: event.target.value, debit: "" })} placeholder="0.00" /></label>
                    <button type="button" className="remove-line" aria-label={`Remove line ${index + 1}`} onClick={() => setLines((current) => current.filter((item) => item.key !== line.key))} disabled={lines.length <= 2}>×</button>
                  </div>
                ))}
                <button type="button" className="add-line-button" onClick={() => setLines((current) => [...current, { key: `line-${Date.now()}-${current.length}`, accountId: "", debit: "", credit: "" }])}>+ Add line</button>
              </div>
              <div className={`balance-check${isDraftBalanced && draftDebits > 0 ? " is-balanced" : " is-unbalanced"}`} role="status">
                <span>Debits <strong>{formatCurrency(draftDebits)}</strong></span>
                <span>Credits <strong>{formatCurrency(draftCredits)}</strong></span>
                <b>{isDraftBalanced && draftDebits > 0 ? "Balanced" : "Out of balance"}</b>
              </div>
              {formError && <p className="form-error" role="alert">{formError}</p>}
              <div className="modal-actions"><button type="button" className="button button-quiet" onClick={() => setShowForm(false)}>Cancel</button><button type="submit" className="button button-primary" disabled={!isDraftValid || isSaving}>{isSaving ? "Posting..." : "Post Entry"}</button></div>
            </form>
          </section>
        </div>
      )}
    </>
  );
}

function TrialBalancePage({
  balances,
}: {
  balances: ReturnType<typeof getAccountBalances>;
}) {
  const activeBalances = balances.filter((account) => account.debit || account.credit);
  const totalDebits = activeBalances.reduce((sum, account) => sum + account.debit, 0);
  const totalCredits = activeBalances.reduce((sum, account) => sum + account.credit, 0);
  const balanced = Math.abs(totalDebits - totalCredits) < 0.005;

  return (
    <>
      <PageHeading eyebrow="FINANCIAL STATEMENTS" title="Trial Balance" subtitle="A check that every debit has its matching credit." action={<button type="button" className="button button-secondary" onClick={() => window.print()}><Icon name="download" size={17} /> Export / print</button>} />
      <section className="report-banner"><div className="report-icon"><Icon name="scale" size={20} /></div><div><strong>Trial balance is {balanced ? "in balance" : "out of balance"}</strong><p>As of 10 November 2025 · Currency: AED</p></div><span className={balanced ? "status-pill" : "status-pill status-danger"}><i />{balanced ? "Balanced" : "Review needed"}</span></section>
      <section className="panel trial-panel">
        <div className="panel-heading"><div><h2>Account balances</h2><p>Closing balances by account</p></div><span className="count-pill">AED · 10 Nov 2025</span></div>
        <div className="table-scroll">
          <table className="data-table trial-table">
            <thead><tr><th>ACCOUNT CODE</th><th>ACCOUNT NAME</th><th>TYPE</th><th className="align-right">DEBIT (AED)</th><th className="align-right">CREDIT (AED)</th></tr></thead>
            <tbody>
              {activeBalances.map((account) => (
                <tr key={account.code}><td><span className="entry-id">{account.code}</span></td><td><span className="table-primary">{account.name}</span></td><td><span className={`type-tag type-${account.group.toLowerCase()}`}>{account.group}</span></td><td className="align-right">{account.debit ? formatCurrency(account.debit) : "—"}</td><td className="align-right">{account.credit ? formatCurrency(account.credit) : "—"}</td></tr>
              ))}
            </tbody>
            <tfoot><tr><td colSpan={3}><strong>Total</strong></td><td className="align-right"><strong>{formatCurrency(totalDebits)}</strong></td><td className="align-right"><strong>{formatCurrency(totalCredits)}</strong></td></tr></tfoot>
          </table>
        </div>
        <div className="table-footer"><span>All balances are derived from posted journal entries.</span><span className="balanced-foot"><i /> Difference: {formatCurrency(Math.abs(totalDebits - totalCredits))}</span></div>
      </section>
      <div className="note-card"><span className="note-mark">i</span><p><strong>Why does it balance?</strong> Each journal entry records an equal debit and credit, keeping the ledger in balance.</p></div>
    </>
  );
}

function ReportsPage({
  accounts,
  entries,
}: {
  accounts: Account[];
  entries: JournalEntry[];
}) {
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const availableDates = entries.map((entry) => entry.date).sort();
  const defaultFromDate = availableDates[0] ?? "";
  const defaultToDate = availableDates[availableDates.length - 1] ?? "";
  const reportFromDate = fromDate || defaultFromDate;
  const reportToDate = toDate || defaultToDate;
  const hasValidRange =
    !reportFromDate || !reportToDate || reportFromDate <= reportToDate;
  const periodEntries = useMemo(
    () =>
      hasValidRange
        ? entries.filter(
            (entry) =>
              (!reportFromDate || entry.date >= reportFromDate) &&
              (!reportToDate || entry.date <= reportToDate),
          )
        : [],
    [entries, hasValidRange, reportFromDate, reportToDate],
  );
  const closingEntries = useMemo(
    () =>
      entries.filter(
        (entry) => !reportToDate || entry.date <= reportToDate,
      ),
    [entries, reportToDate],
  );
  const periodBalances = useMemo(
    () => getAccountBalances(periodEntries, accounts),
    [periodEntries, accounts],
  );
  const closingBalances = useMemo(
    () => getAccountBalances(closingEntries, accounts),
    [closingEntries, accounts],
  );

  const revenueAccounts = periodBalances.filter(
    (account) => account.group === "Revenue",
  );
  const expenseAccounts = periodBalances.filter(
    (account) => account.group === "Expenses",
  );
  const cogsAccounts = expenseAccounts.filter(isCostOfGoodsSold);
  const operatingExpenseAccounts = expenseAccounts.filter(
    (account) => !isCostOfGoodsSold(account),
  );
  const revenue = revenueAccounts.reduce(
    (total, account) => total + getAccountAmount(account),
    0,
  );
  const cogs = cogsAccounts.reduce(
    (total, account) => total + getAccountAmount(account),
    0,
  );
  const grossProfit = revenue - cogs;
  const operatingExpenses = operatingExpenseAccounts.reduce(
    (total, account) => total + getAccountAmount(account),
    0,
  );
  const netIncome = grossProfit - operatingExpenses;
  const grossMargin = revenue === 0 ? null : (grossProfit / revenue) * 100;
  const netProfitMargin = revenue === 0 ? null : (netIncome / revenue) * 100;

  const cashAccountIds = new Set(
    accounts.filter(isCashAccount).map((account) => account.id),
  );
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const cashFlow = { operating: 0, investing: 0, financing: 0 };
  for (const entry of periodEntries) {
    const cashMovement = entry.lines.reduce(
      (total, line) =>
        cashAccountIds.has(line.accountId)
          ? total + line.debit - line.credit
          : total,
      0,
    );
    if (Math.abs(cashMovement) < 0.005) continue;

    const counterpartAccounts = entry.lines
      .filter((line) => !cashAccountIds.has(line.accountId))
      .map((line) => accountsById.get(line.accountId))
      .filter((account): account is Account => account !== undefined);
    if (
      counterpartAccounts.some(
        (account) => account.group === "Assets" && isNonCurrentAsset(account),
      )
    ) {
      cashFlow.investing += cashMovement;
    } else if (
      counterpartAccounts.some(
        (account) =>
          account.group === "Equity" ||
          (account.group === "Liabilities" && isLongTermLiability(account)),
      )
    ) {
      cashFlow.financing += cashMovement;
    } else {
      cashFlow.operating += cashMovement;
    }
  }
  const netCashChange =
    cashFlow.operating + cashFlow.investing + cashFlow.financing;
  const cashOpeningEntries = entries.filter(
    (entry) => reportFromDate && entry.date < reportFromDate,
  );
  const cashOpening = cashOpeningEntries.reduce(
    (total, entry) =>
      total +
      entry.lines.reduce(
        (movement, line) =>
          cashAccountIds.has(line.accountId)
            ? movement + line.debit - line.credit
            : movement,
        0,
      ),
    0,
  );
  const cashClosing = closingBalances
    .filter((account) => cashAccountIds.has(account.id))
    .reduce((total, account) => total + getAccountAmount(account), 0);

  const assetAccounts = closingBalances.filter(
    (account) => account.group === "Assets",
  );
  const liabilityAccounts = closingBalances.filter(
    (account) => account.group === "Liabilities",
  );
  const equityAccounts = closingBalances.filter(
    (account) => account.group === "Equity",
  );
  const totalAssets = assetAccounts.reduce(
    (total, account) => total + getAccountAmount(account),
    0,
  );
  const totalLiabilities = liabilityAccounts.reduce(
    (total, account) => total + getAccountAmount(account),
    0,
  );
  const retainedNetIncome =
    getGroupTotal(closingBalances, "Revenue") -
    getGroupTotal(closingBalances, "Expenses");
  const postedEquity = equityAccounts.reduce(
    (total, account) => total + getAccountAmount(account),
    0,
  );
  const totalEquity = postedEquity + retainedNetIncome;
  const liabilitiesAndEquity = totalLiabilities + totalEquity;
  const balanceDifference = totalAssets - liabilitiesAndEquity;

  const currentAssets = assetAccounts
    .filter((account) => !isNonCurrentAsset(account))
    .reduce((total, account) => total + getAccountAmount(account), 0);
  const currentLiabilities = liabilityAccounts
    .filter((account) => !isLongTermLiability(account))
    .reduce((total, account) => total + getAccountAmount(account), 0);
  const currentRatio =
    currentLiabilities > 0 ? currentAssets / currentLiabilities : null;
  const debtToEquity =
    totalEquity > 0 ? totalLiabilities / totalEquity : null;

  const trialBalance = closingBalances.filter(
    (account) => account.debit > 0 || account.credit > 0,
  );
  const trialDebits = trialBalance.reduce(
    (total, account) => total + account.debit,
    0,
  );
  const trialCredits = trialBalance.reduce(
    (total, account) => total + account.credit,
    0,
  );
  const periodLabel =
    reportFromDate && reportToDate
      ? `${formatDate(reportFromDate)} – ${formatDate(reportToDate)}`
      : "All posted entries";
  const asOfLabel = reportToDate
    ? formatDate(reportToDate)
    : "latest posted date";

  return (
    <div className="reports-page">
      <PageHeading
        eyebrow="INSIGHTS & REPORTS"
        title="Reports"
        subtitle="Financial statements and ratios from posted journal entries."
        action={
          <button
            type="button"
            className="button button-primary"
            onClick={() => window.print()}
          >
            <Icon name="download" size={17} /> Export to PDF
          </button>
        }
      />
      <section className="report-filters" aria-label="Report filters">
        <span className="report-filter-title">
          <Icon name="calendar" size={17} /> Reporting period
        </span>
        <div className="report-date-controls">
          <label>
            From
            <input
              aria-label="Report start date"
              type="date"
              value={reportFromDate}
              max={reportToDate || undefined}
              onChange={(event) => setFromDate(event.target.value)}
            />
          </label>
          <label>
            To
            <input
              aria-label="Report end date"
              type="date"
              value={reportToDate}
              min={reportFromDate || undefined}
              onChange={(event) => setToDate(event.target.value)}
            />
          </label>
        </div>
        <strong className="report-print-range">{periodLabel}</strong>
        <span className="currency-label">All amounts in AED</span>
      </section>
      {!hasValidRange && (
        <p className="form-error report-range-error" role="alert">
          The start date must be on or before the end date.
        </p>
      )}
      <div className="summary-grid report-summary">
        <article className="summary-card mini-summary report-metric">
          <span>Gross Margin</span>
          <strong>{formatPercent(grossMargin)}</strong>
          <small>{formatCurrency(grossProfit)} gross profit</small>
        </article>
        <article className="summary-card mini-summary report-metric">
          <span>Net Profit Margin</span>
          <strong className={netIncome < 0 ? "negative-number" : ""}>
            {formatPercent(netProfitMargin)}
          </strong>
          <small>{formatCurrency(netIncome)} net income</small>
        </article>
        <article className="summary-card mini-summary report-metric">
          <span>Current Ratio</span>
          <strong>{formatRatio(currentRatio)}</strong>
          <small>As of {asOfLabel}</small>
        </article>
        <article className="summary-card mini-summary report-metric">
          <span>Debt-to-Equity</span>
          <strong>{formatRatio(debtToEquity)}</strong>
          <small>As of {asOfLabel}</small>
        </article>
      </div>
      <div className="reports-grid">
        <section className="panel report-panel">
          <div className="panel-heading">
            <div>
              <h2>Income Statement</h2>
              <p>{periodLabel}</p>
            </div>
            <span className="report-icon small-report-icon">
              <Icon name="chart" size={17} />
            </span>
          </div>
          <div className="statement-section-label">Revenue</div>
          {revenueAccounts
            .filter((account) => getAccountAmount(account) !== 0)
            .map((account) => (
              <div className="statement-subrow" key={account.id}>
                <span>{account.name}</span>
                <span>{formatCurrency(getAccountAmount(account))}</span>
              </div>
            ))}
          <div className="statement-row">
            <strong>Total Revenue</strong>
            <strong>{formatCurrency(revenue)}</strong>
          </div>
          <div className="statement-divider" />
          <div className="statement-section-label">Cost of Goods Sold</div>
          {cogsAccounts.filter((account) => getAccountAmount(account) !== 0)
            .length === 0 ? (
            <div className="statement-subrow">
              <span>No COGS accounts for this period</span>
              <span>{formatCurrency(0)}</span>
            </div>
          ) : (
            cogsAccounts
              .filter((account) => getAccountAmount(account) !== 0)
              .map((account) => (
                <div className="statement-subrow" key={account.id}>
                  <span>{account.name}</span>
                  <span>{formatCurrency(getAccountAmount(account))}</span>
                </div>
              ))
          )}
          <div className="statement-row">
            <strong>Gross Profit</strong>
            <strong>{formatCurrency(grossProfit)}</strong>
          </div>
          <div className="statement-divider" />
          <div className="statement-section-label">Operating Expenses</div>
          {operatingExpenseAccounts
            .filter((account) => getAccountAmount(account) !== 0)
            .map((account) => (
              <div className="statement-subrow" key={account.id}>
                <span>{account.name}</span>
                <span>{formatCurrency(getAccountAmount(account))}</span>
              </div>
            ))}
          <div className="statement-row">
            <strong>Total Operating Expenses</strong>
            <strong>{formatCurrency(operatingExpenses)}</strong>
          </div>
          <div className="statement-total">
            <strong>Net Income</strong>
            <strong className={netIncome < 0 ? "negative-number" : ""}>
              {formatCurrency(netIncome)}
            </strong>
          </div>
        </section>

        <section className="panel report-panel">
          <div className="panel-heading">
            <div>
              <h2>Balance Sheet</h2>
              <p>As of {asOfLabel}</p>
            </div>
            <span className="report-icon small-report-icon">
              <Icon name="scale" size={17} />
            </span>
          </div>
          <div className="statement-section-label">Assets</div>
          {assetAccounts
            .filter((account) => getAccountAmount(account) !== 0)
            .map((account) => (
              <div className="statement-subrow" key={account.id}>
                <span>{account.name}</span>
                <span>{formatCurrency(getAccountAmount(account))}</span>
              </div>
            ))}
          <div className="statement-row">
            <strong>Total Assets</strong>
            <strong>{formatCurrency(totalAssets)}</strong>
          </div>
          <div className="statement-divider" />
          <div className="statement-section-label">Liabilities</div>
          {liabilityAccounts
            .filter((account) => getAccountAmount(account) !== 0)
            .map((account) => (
              <div className="statement-subrow" key={account.id}>
                <span>{account.name}</span>
                <span>{formatCurrency(getAccountAmount(account))}</span>
              </div>
            ))}
          <div className="statement-row">
            <strong>Total Liabilities</strong>
            <strong>{formatCurrency(totalLiabilities)}</strong>
          </div>
          <div className="statement-divider" />
          <div className="statement-section-label">Equity</div>
          {equityAccounts
            .filter((account) => getAccountAmount(account) !== 0)
            .map((account) => (
              <div className="statement-subrow" key={account.id}>
                <span>{account.name}</span>
                <span>{formatCurrency(getAccountAmount(account))}</span>
              </div>
            ))}
          <div className="statement-subrow">
            <span>Current and prior period earnings</span>
            <span>{formatCurrency(retainedNetIncome)}</span>
          </div>
          <div className="statement-row">
            <strong>Total Equity</strong>
            <strong>{formatCurrency(totalEquity)}</strong>
          </div>
          <div className="statement-total">
            <strong>Liabilities + Equity</strong>
            <strong>{formatCurrency(liabilitiesAndEquity)}</strong>
          </div>
          <div
            className={`balance-status${Math.abs(balanceDifference) < 0.005 ? " is-balanced" : " is-unbalanced"}`}
            role="status"
          >
            <span>
              {Math.abs(balanceDifference) < 0.005
                ? "Assets = Liabilities + Equity"
                : "Balance sheet is out of balance"}
            </span>
            <strong>{formatCurrency(Math.abs(balanceDifference))} difference</strong>
          </div>
        </section>

        <section className="panel report-panel">
          <div className="panel-heading">
            <div>
              <h2>Cash Flow</h2>
              <p>{periodLabel}</p>
            </div>
            <span className="report-icon small-report-icon">
              <Icon name="wallet" size={17} />
            </span>
          </div>
          <div className="statement-section-label">Operating Activities</div>
          <div className="statement-row">
            <span>Net cash from operating activities</span>
            <strong>{formatCurrency(cashFlow.operating)}</strong>
          </div>
          <div className="statement-divider" />
          <div className="statement-section-label">Investing Activities</div>
          <div className="statement-row">
            <span>Net cash from investing activities</span>
            <strong>{formatCurrency(cashFlow.investing)}</strong>
          </div>
          <div className="statement-divider" />
          <div className="statement-section-label">Financing Activities</div>
          <div className="statement-row">
            <span>Net cash from financing activities</span>
            <strong>{formatCurrency(cashFlow.financing)}</strong>
          </div>
          <div className="statement-total">
            <strong>Net Change in Cash</strong>
            <strong>{formatCurrency(netCashChange)}</strong>
          </div>
          <div className="cash-reconciliation">
            <span>Opening cash</span>
            <strong>{formatCurrency(cashOpening)}</strong>
            <span>Closing cash</span>
            <strong>{formatCurrency(cashClosing)}</strong>
          </div>
        </section>

        <section className="panel report-panel">
          <div className="panel-heading">
            <div>
              <h2>Trial Balance</h2>
              <p>Closing account balances as of {asOfLabel}</p>
            </div>
            <span
              className={`status-pill${Math.abs(trialDebits - trialCredits) < 0.005 ? "" : " status-danger"}`}
            >
              <i />
              {Math.abs(trialDebits - trialCredits) < 0.005
                ? "Balanced"
                : "Review needed"}
            </span>
          </div>
          <div className="table-scroll">
            <table className="data-table report-trial-table">
              <thead>
                <tr>
                  <th>CODE</th>
                  <th>ACCOUNT</th>
                  <th className="align-right">DEBIT (AED)</th>
                  <th className="align-right">CREDIT (AED)</th>
                </tr>
              </thead>
              <tbody>
                {trialBalance.map((account) => (
                  <tr key={account.id}>
                    <td><span className="entry-id">{account.code}</span></td>
                    <td><span className="table-primary">{account.name}</span></td>
                    <td className="align-right">
                      {account.debit ? formatCurrency(account.debit) : "—"}
                    </td>
                    <td className="align-right">
                      {account.credit ? formatCurrency(account.credit) : "—"}
                    </td>
                  </tr>
                ))}
                {trialBalance.length === 0 && (
                  <tr>
                    <td colSpan={4} className="empty-row">
                      No posted balances as of this date.
                    </td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr>
                  <td colSpan={2}><strong>Total</strong></td>
                  <td className="align-right"><strong>{formatCurrency(trialDebits)}</strong></td>
                  <td className="align-right"><strong>{formatCurrency(trialCredits)}</strong></td>
                </tr>
              </tfoot>
            </table>
          </div>
        </section>
      </div>
      <div className="note-card report-classification-note">
        <span className="note-mark">i</span>
        <p>
          <strong>Report basis:</strong> Income Statement and Cash Flow use the
          selected period; Balance Sheet and Trial Balance are as of the end
          date. COGS, cash, and non-current accounts are identified by account
          names because the chart currently uses broad account groups.
        </p>
      </div>
    </div>
  );
}

export default function AccountingApp() {
  const pathname = usePathname();
  const { accounts, entries, isLoading, loadError, postEntry } = useAccountingState();
  const balances = useMemo(() => getAccountBalances(entries, accounts), [entries, accounts]);
  const page = sections.find((section) => section.href === pathname)?.label ?? "Dashboard";
  const pageContent = (() => {
    if (pathname === "/chart-of-accounts") return <ChartOfAccountsPage balances={balances} />;
    if (pathname === "/journal-entries") return <JournalEntriesPage entries={entries} accounts={accounts} onPost={postEntry} />;
    if (pathname === "/trial-balance") return <TrialBalancePage balances={balances} />;
    if (pathname === "/reports") return <ReportsPage accounts={accounts} entries={entries} />;
    return <DashboardPage entries={entries} balances={balances} />;
  })();

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <Link href="/" className="brand">
          <span className="brand-mark"><span /></span>
          <span className="brand-name">ledger<span>leaf</span></span>
        </Link>
        <div className="workspace-switcher"><div className="workspace-avatar">N</div><div><strong>Northstar Studio</strong><span>Business workspace</span></div><span className="workspace-chevron">⌄</span></div>
        <div className="nav-label">WORKSPACE</div>
        <nav className="main-nav" aria-label="Main navigation">
          {sections.map((section) => (
            <Link key={section.href} href={section.href} className={`nav-link${page === section.label ? " active" : ""}`} aria-current={page === section.label ? "page" : undefined}>
              <Icon name={section.icon} size={18} /><span>{section.label}</span>{section.label === "Journal Entries" && <span className="nav-count">{entries.length}</span>}
            </Link>
          ))}
        </nav>
        <div className="sidebar-spacer" />
        <div className="sidebar-help"><span className="help-mark">?</span><div><strong>Need a hand?</strong><span>Visit our help center</span></div><Icon name="chevron" size={15} /></div>
        <div className="profile-block"><div className="profile-avatar">JK</div><div><strong>Johny Kondra</strong><span>Administrator</span></div><button type="button" className="icon-button profile-menu" aria-label="Profile menu"><Icon name="dots" /></button></div>
      </aside>
      <div className="main-shell">
        <header className="topbar"><div className="breadcrumbs"><span>Workspace</span><Icon name="chevron" size={14} /><strong>{page}</strong></div><div className="topbar-actions"><div className="topbar-period"><span className="period-dot" /> November 2025</div><button type="button" className="icon-button notification-button" aria-label="Notifications"><Icon name="bell" size={19} /><i /></button><div className="topbar-divider" /><div className="topbar-user"><div className="profile-avatar small-avatar">JK</div><span>Johny Kondra</span><span className="tiny-chevron">⌄</span></div></div></header>
        <main className="main-content">
          {isLoading ? <div className="connection-message" role="status">Loading accounts and journal data from Supabase…</div> : loadError ? <div className="connection-message connection-error" role="alert"><strong>Supabase connection needs attention</strong><p>{loadError}</p></div> : pageContent}
          <footer className="app-footer"><span>© 2025 Ledgerleaf Accounting</span><span>All amounts shown in AED</span></footer>
        </main>
      </div>
    </div>
  );
}
