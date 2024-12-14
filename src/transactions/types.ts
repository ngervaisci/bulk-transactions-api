export interface TransactionResult {
  success: boolean;
  transactionId?: string;
  error?: string;
}

export interface BatchProcessResult {
  successful: number;
  failed: TransactionResult[];
}
