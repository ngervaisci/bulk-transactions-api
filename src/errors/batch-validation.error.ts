export class BatchValidationError extends Error {
  constructor(public errors: any[]) {
    super(`Validation failed for ${errors.length} transactions`);
    this.name = 'BatchValidationError';
  }
}
