export type AccountGroup =
  | "Assets"
  | "Liabilities"
  | "Equity"
  | "Revenue"
  | "Expenses";

export type Account = {
  id: string;
  code: string;
  name: string;
  group: AccountGroup;
  normalBalance: "debit" | "credit";
  isActive: boolean;
};

export type JournalLine = {
  id: string;
  accountId: string;
  accountCode: string;
  accountName: string;
  lineNumber: number;
  debit: number;
  credit: number;
};

export type JournalEntry = {
  id: string;
  entryNumber: string;
  date: string;
  description: string;
  lines: JournalLine[];
};

export type JournalEntryDraft = {
  date: string;
  description: string;
  lines: {
    accountId: string;
    debit: number;
    credit: number;
  }[];
};
