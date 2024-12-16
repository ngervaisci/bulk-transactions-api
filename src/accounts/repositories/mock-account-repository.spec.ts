import { MockAccountRepository } from './mock-account-repository';

describe('MockAccountRepository', () => {
  let repository: MockAccountRepository;

  beforeEach(() => {
    repository = new MockAccountRepository();
  });

  it('should initialize with three dummy accounts', async () => {
    const account1 = await repository.findById('1');
    const account2 = await repository.findById('2');
    const account3 = await repository.findById('3');

    expect(account1).toBeTruthy();
    expect(account2).toBeTruthy();
    expect(account3).toBeTruthy();
  });

  it('should return null for non-existing accounts', async () => {
    const account = await repository.findById('999');
    expect(account).toBeNull();
  });
});