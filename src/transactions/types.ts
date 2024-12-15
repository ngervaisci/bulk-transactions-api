export interface TransactionResult {
  success: boolean;
  transactionId: string;
  error?: string;
}

export interface BatchProcessResult {
  successful: number;
  failed: TransactionResult[];
}

export interface ValidationError {
  transactionId: string;
  error: string;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
}
