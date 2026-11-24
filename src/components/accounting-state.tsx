"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import type { ReactNode } from "react";
import type {
  Account,
  JournalEntry,
  JournalEntryDraft,
  JournalLine,
} from "@/components/accounting-data";
import { getSupabaseClient } from "@/lib/supabase-browser";

type AccountingStateValue = {
  accounts: Account[];
  entries: JournalEntry[];
  isLoading: boolean;
  loadError: string | null;
  postEntry: (draft: JournalEntryDraft) => Promise<void>;
};

const AccountingStateContext = createContext<AccountingStateValue | null>(null);

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof error.message === "string"
  ) {
    return error.message;
  }
  return String(error);
}

async function fetchAccountingData() {
  const supabase = getSupabaseClient();
  const [accountsResult, entriesResult, linesResult] = await Promise.all([
    supabase
      .from("accounts")
      .select("id, code, name, account_type, normal_balance, is_active")
      .order("code"),
    supabase
      .from("journal_entries")
      .select("id, entry_number, entry_date, description")
      .order("entry_date", { ascending: false }),
    supabase
      .from("journal_lines")
      .select("id, journal_entry_id, line_number, account_id, debit, credit")
      .order("line_number"),
  ]);

  if (accountsResult.error) throw accountsResult.error;
  if (entriesResult.error) throw entriesResult.error;
  if (linesResult.error) throw linesResult.error;

  const accounts: Account[] = accountsResult.data.map((account) => ({
    id: account.id,
    code: account.code,
    name: account.name,
    group: account.account_type,
    normalBalance: account.normal_balance,
    isActive: account.is_active,
  }));
  const accountsById = new Map(accounts.map((account) => [account.id, account]));
  const linesByEntry = new Map<string, JournalLine[]>();

  for (const line of linesResult.data) {
    const account = accountsById.get(line.account_id);
    if (!account) {
      throw new Error(
        `Journal line ${line.id} references an account missing from the accounts table.`,
      );
    }
    const lines = linesByEntry.get(line.journal_entry_id) ?? [];
    lines.push({
      id: line.id,
      accountId: account.id,
      accountCode: account.code,
      accountName: account.name,
      lineNumber: line.line_number,
      debit: Number(line.debit),
      credit: Number(line.credit),
    });
    linesByEntry.set(line.journal_entry_id, lines);
  }

  const entries: JournalEntry[] = entriesResult.data.map((entry) => ({
    id: entry.id,
    entryNumber: entry.entry_number,
    date: entry.entry_date,
    description: entry.description,
    lines: (linesByEntry.get(entry.id) ?? []).sort(
      (left, right) => left.lineNumber - right.lineNumber,
    ),
  }));

  return { accounts, entries };
}

export function AccountingStateProvider({ children }: { children: ReactNode }) {
  const [accounts, setAccounts] = useState<Account[]>([]);
  const [entries, setEntries] = useState<JournalEntry[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    void fetchAccountingData()
      .then((data) => {
        if (!active) return;
        setAccounts(data.accounts);
        setEntries(data.entries);
      })
      .catch((error: unknown) => {
        if (!active) return;
        const message = getErrorMessage(error);
        setLoadError(
          `Could not load accounting data: ${message} Check .env.local and run supabase/schema.sql in the Supabase SQL Editor.`,
        );
      })
      .finally(() => {
        if (active) setIsLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  const postEntry = useCallback(
    async (draft: JournalEntryDraft) => {
      const accountIds = new Set(accounts.filter((account) => account.isActive).map((account) => account.id));
      if (
        draft.lines.length < 2 ||
        draft.lines.some(
          (line) =>
            !accountIds.has(line.accountId) ||
            !Number.isFinite(line.debit) ||
            !Number.isFinite(line.credit) ||
            line.debit < 0 ||
            line.credit < 0 ||
            (line.debit > 0) === (line.credit > 0),
        )
      ) {
        throw new Error("Every line needs an active account and exactly one positive debit or credit.");
      }

      const debitTotal = draft.lines.reduce((sum, line) => sum + line.debit, 0);
      const creditTotal = draft.lines.reduce((sum, line) => sum + line.credit, 0);
      if (Math.round((debitTotal - creditTotal) * 100) !== 0) {
        throw new Error("Entry not posted: total debits must equal total credits.");
      }

      const { data, error } = await getSupabaseClient().rpc("post_journal_entry", {
        p_entry_date: draft.date,
        p_description: draft.description,
        p_lines: draft.lines.map((line, index) => ({
          line_number: index + 1,
          account_id: line.accountId,
          debit: line.debit,
          credit: line.credit,
        })),
      });
      if (error) throw new Error(`Supabase could not post this entry: ${error.message}`);
      const postedEntry = data?.[0];
      if (!postedEntry) {
        throw new Error("Supabase returned no saved journal entry.");
      }

      const accountsById = new Map(accounts.map((account) => [account.id, account]));
      const lines: JournalLine[] = draft.lines.map((line, index) => {
        const account = accountsById.get(line.accountId);
        if (!account) {
          throw new Error(`Account ${line.accountId} is no longer available.`);
        }
        return {
          id: `${postedEntry.id}-${index + 1}`,
          accountId: account.id,
          accountCode: account.code,
          accountName: account.name,
          lineNumber: index + 1,
          debit: line.debit,
          credit: line.credit,
        };
      });
      setEntries((current) => [
        {
          id: postedEntry.id,
          entryNumber: postedEntry.entry_number,
          date: postedEntry.entry_date,
          description: postedEntry.description,
          lines,
        },
        ...current,
      ]);
    },
    [accounts],
  );

  return (
    <AccountingStateContext.Provider
      value={{ accounts, entries, isLoading, loadError, postEntry }}
    >
      {children}
    </AccountingStateContext.Provider>
  );
}

export function useAccountingState() {
  const state = useContext(AccountingStateContext);
  if (!state) {
    throw new Error("useAccountingState must be used within AccountingStateProvider");
  }
  return state;
}
