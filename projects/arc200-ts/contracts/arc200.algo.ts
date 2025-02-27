import { Contract } from '@algorandfoundation/tealscript';

// Define the structure for an allowance, representing the amount a spender is allowed to spend on behalf of an owner.
export type Allowance = {
  spender: Address; // The address of the spender.
  amount: uint256; // The amount the spender is allowed to spend.
};

// Define the structure for a user, including their balance and allowances.
export type User = {
  balance: uint256; // The user's token balance.
  allowances: Allowance[]; // An array of allowances granted by the user.
};

// Define the main contract class, inheriting from the TealScript Contract class.
export class arc200 extends Contract {
  // Define global state keys for the token's name, symbol, decimals, and total supply.
  name = GlobalStateKey<bytes[32]>({ key: 'name' });
  symbol = GlobalStateKey<bytes[8]>({ key: 'symbol' });
  decimals = GlobalStateKey<uint8>({ key: 'decimals' });
  totalSupply = GlobalStateKey<uint256>({ key: 'totalSupply' });
  // Define a BoxMap to store user data, using the user's address as the key.
  users = BoxMap<Address, User>({ dynamicSize: true });

  // Define event loggers for transfer and approval events.
  arc200_Transfer = new EventLogger<{ from: Address; to: Address; value: uint256 }>();
  arc200_Approval = new EventLogger<{ owner: Address; spender: Address; value: uint256 }>();

  /**
   * Contructor which initializes name, symbol, decimals and totalSupply of the token
   *
   * @param name - Name of the token.
   * @param symbol - Symbol of the token.
   * @param decimals - Decimals of the token.
   * @returns void
   */
  createApplication(name: bytes[32], symbol: bytes[8], decimals: uint8): void {
    this.name.value = name;
    this.symbol.value = symbol;
    this.decimals.value = decimals;
    this.totalSupply.value = 0 as uint256;
  }

  /**
   * Returns the symbol of the token
   *
   * @returns symbol of the token
   */
  arc200_name(): bytes[32] {
    return this.name.value;
  }

  /**
   * Returns the decimals of the token
   *
   * @returns decimals of the token
   */
  arc200_symbol(): bytes[8] {
    return this.symbol.value;
  }

  /**
   * Returns the decimals of the token
   *
   * @returns decimals of the token
   */
  arc200_decimals(): uint8 {
    return this.decimals.value;
  }

  /**
   * Returns the total supply of the token
   *
   * @returns total supply of the token
   */
  arc200_totalSupply(): uint256 {
    return this.totalSupply.value;
  }

  /**
   * Returns the current balance of the owner of the token
   *
   * @param owner - Address of the token owner.
   * @returns current balance of the owner of the token
   */
  arc200_balanceOf(owner: Address): uint256 {
    if (this.users(owner).exists) {
      return this.users(owner).value.balance;
    } else {
      return 0 as uint256;
    }
  }

  /**
   * Transfers tokens
   *
   * @param to - The destination of the transfer
   * @param value - Amount of tokens to transfer
   * @returns Status whether transfer is success or not
   */
  arc200_transfer(to: Address, value: uint256): boolean {
    const sender = this.txn.sender;
    assert(this.userExists(sender), 'No Balance Available in Sender Account');
    assert(this.ensureBalance(sender, value), 'Insufficient Balance in Sender Account');
    assert(to != globals.zeroAddress, 'Sending to Zero Address is not Allowed');
    this._transfer(sender, to, value);
    return true;
  }

  /**
   * Transfers tokens from source to destination as approved spenderTransfers tokens from source to destination as approved spender
   *
   * @param from - The source  of the transfer
   * @param to - The destination of the transfer
   * @param value - Amount of tokens to transfer
   * @returns Status whether transfer is success or not
   */
  arc200_transferFrom(from: Address, to: Address, value: uint256): boolean {
    const spender = this.txn.sender;
    assert(this.userExists(from), 'No Balance Available in Sender Account');
    assert(this.ensureBalance(from, value), 'Insufficient Balance in Sender Account');
    assert(to != globals.zeroAddress, 'Sending to Zero Address is not Allowed');
    const check = this.checkAllowanceAvailable(from, spender);
    assert(check[0], 'Allowance Not Available');
    const allowance = this.getAllowance(from, check[1]);
    assert(allowance.amount >= value, 'Amount is less than balance in Allowance');
    this._transfer(from, to, value);
    this.updateAllowance(from, allowance.amount - value, check[1]);
    return true;
  }

  /**
   * Approves a spender to spend tokens on behalf of the owner.
   *
   * @param spender - The address of the spender to be approved.
   * @param value - The amount of tokens the spender is allowed to spend.
   * @returns True if the approval was successful.
   */
  arc200_approve(spender: Address, value: uint256): boolean {
    assert(spender != globals.zeroAddress, 'Cannot Give ALlowance to Zero Address');
    const check = this.checkAllowanceAvailable(this.txn.sender, spender);
    if (check[0]) {
      this.updateAllowance(this.txn.sender, value, check[1]);
    } else {
      this.addAllowance(this.txn.sender, spender, value);
    }
    this.arc200_Approval.log({ owner: this.txn.sender, spender: spender, value: value });
    return true;
  }

  /**
   * Returns the amount of tokens that a spender is allowed to spend on behalf of an owner.
   *
   * @param owner - The address of the token owner.
   * @param spender - The address of the spender.
   * @returns The amount of tokens the spender is allowed to spend.
   */
  arc200_allowance(owner: Address, spender: Address): uint256 {
    const check = this.checkAllowanceAvailable(this.txn.sender, spender);
    assert(check[0], 'Allowance Not Available');

    const allowance = this.getAllowance(owner, check[1]);
    return allowance.amount;
  }

  /**
   * Mints new tokens and assigns them to an account.
   *
   * @param account - The address of the account to mint tokens to.
   * @param value - The amount of tokens to mint.
   * @returns True if the minting was successful.
   */
  arc200_mint(account: Address, value: uint256): boolean {
    if (!this.users(globals.zeroAddress).exists) {
      this.users(globals.zeroAddress).value = { balance: 0 as uint256, allowances: [] };
    }
    assert(this.txn.sender == this.app.creator, 'Only Admin Can Mint');
    assert(account != globals.zeroAddress, 'Cannot Mint to Zero Address');
    this._transfer(globals.zeroAddress, account, value);
    return true;
  }

  /**
   * Burns tokens from an account, reducing the total supply.
   *
   * @param account - The address of the account to burn tokens from.
   * @param value - The amount of tokens to burn.
   * @returns True if the burning was successful.
   */
  arc200_burn(account: Address, value: uint256): boolean {
    assert(this.txn.sender == this.app.creator, 'Only Admin Can Burn');
    assert(account != globals.zeroAddress, 'Cannot Burn from Zero Address');
    assert(this.userExists(account), 'No Balance Available To Burn From Account');
    assert(this.ensureBalance(account, value), 'Insufficient Balance To Burn From Account');
    this._transfer(account, globals.zeroAddress, value);
    return true;
  }

  /**
   * Checks if a user exists in the user's BoxMap.
   *
   * @param user - The address of the user to check.
   * @returns True if the user exists, false otherwise.
   */
  private userExists(user: Address): boolean {
    return this.users(user).exists;
  }

  /**
   * Checks if a user has enough balance.
   *
   * @param user - The address of the user to check.
   * @param balance - The amount to check against the user's balance.
   * @returns True if the user has enough balance, false otherwise.
   */
  private ensureBalance(user: Address, balance: uint256): boolean {
    return this.users(user).value.balance >= balance;
  }

  /**
   * Creates a new user with an initial balance.
   *
   * @param user - The address of the new user.
   * @param balance - The initial balance of the new user.
   */
  private createNewUser(user: Address, balance: uint256): void {
    this.users(user).value = { balance: balance, allowances: [] };
  }

  /**
   * Internal function to transfer tokens from one address to another.
   *
   * @param from - The address to transfer tokens from.
   * @param to - The address to transfer tokens to.
   * @param value - The amount of tokens to transfer.
   */
  private _transfer(from: Address, to: Address, value: uint256): void {
    assert(!(from == globals.zeroAddress && to == globals.zeroAddress), 'Both Address Should not be zero');
    if (from == globals.zeroAddress) {
      if (this.users(to).exists) {
        this.users(to).value.balance = this.users(to).value.balance + value;
      } else {
        this.createNewUser(to, value);
      }
      this.totalSupply.value = this.totalSupply.value + value;
    } else if (to == globals.zeroAddress) {
      this.users(globals.zeroAddress).value.balance = this.users(globals.zeroAddress).value.balance + value;
      this.users(from).value.balance = this.users(from).value.balance - value;
      this.totalSupply.value = this.totalSupply.value - value;
    } else {
      if (this.users(to).exists) {
        this.users(to).value.balance = this.users(to).value.balance + value;
      } else {
        this.createNewUser(to, value);
      }
      this.users(from).value.balance = this.users(from).value.balance - value;
    }

    this.arc200_Transfer.log({ from: from, to: to, value: value });
  }

  /**
   * Checks if an allowance is available for a given user and spender.
   *
   * @param user - The address of the token owner.
   * @param spender - The address of the spender.
   * @returns A tuple containing a boolean indicating if the allowance is available, and the index of the allowance if it exists.
   */
  private checkAllowanceAvailable(user: Address, spender: Address): [boolean, uint64] {
    const allowances = this.users(user).value.allowances;
    const allowancesLength = (this.users(user).size - 36) / 64;
    let allowanceFound = false;
    let allowanceIndex = 0;

    for (let index = 0; index < allowancesLength; index += 1) {
      if (allowances[index].spender == spender) {
        allowanceFound = true;
        allowanceIndex = index;
        break;
      }
    }

    return [allowanceFound, allowanceIndex];
  }

  /**
   * Updates the balance of an existing allowance.
   *
   * @param user - The address of the token owner.
   * @param balance - The new balance of the allowance.
   * @param index - The index of the allowance to update.
   */
  private updateAllowance(user: Address, balance: uint256, index: uint64): void {
    const allowances = this.users(user).value.allowances;
    allowances[index].amount = balance;
  }

  /**
   * Adds a new allowance for a spender.
   *
   * @param user - The address of the token owner.
   * @param spender - The address of the spender.
   * @param balance - The amount of tokens the spender is allowed to spend.
   */
  private addAllowance(user: Address, spender: Address, balance: uint256): void {
    const allowances = this.users(user).value.allowances;
    const newAllowance: Allowance[] = [];
    const allowancesLength = (this.users(user).size - 36) / 64;
    const newElement: Allowance = { spender: spender, amount: balance };

    for (let i = 0; i < allowancesLength; i += 1) {
      newAllowance.push(allowances[i]);
    }

    newAllowance.push(newElement);
    this.users(user).value.allowances = newAllowance;
  }

  /**
   * Retrieves an allowance for a given user and index.
   *
   * @param user - The address of the token owner.
   * @param index - The index of the allowance to retrieve.
   * @returns The allowance object.
   */
  private getAllowance(user: Address, index: uint64): Allowance {
    const addressOffset = index * 64 + 36;
    const valueOffset = addressOffset + 32;
    return {
      spender: castBytes<Address>(this.users(user).extract(addressOffset, 32)),
      amount: castBytes<uint256>(this.users(user).extract(valueOffset, 32)),
    };
  }
}
