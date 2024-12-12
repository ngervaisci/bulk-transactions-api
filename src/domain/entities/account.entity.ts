
export class Account {
  constructor(
    public readonly id: string,
    public balance: number,
  ) {}

  /**
   * Deposit money into the account.
   * @param amount The amount to be deposited.
   */
  deposit(amount: number): void {
    this.balance += amount;
  }

  /**
   * Withdraw money from the account.
   * @param amount The amount to be withdrawn.
   */
  withdraw(amount: number): void {
    this.balance -= amount;
  }

  /**
   * Get the current balance.
   * @returns The current balance.
   */
  getBalance(): number {
    return this.balance;
  }
}
