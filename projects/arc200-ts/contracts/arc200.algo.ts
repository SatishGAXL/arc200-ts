import { Contract } from '@algorandfoundation/tealscript';

export type Allowance = {
  spender: Address;
  amount: uint256;
};

export type User = {
  balance: uint256;
  allowances: Allowance[];
};

export class arc200 extends Contract {
  name = GlobalStateKey<bytes[32]>({ key: 'name' });
  symbol = GlobalStateKey<bytes[8]>({ key: 'symbol' });
  decimals = GlobalStateKey<uint8>({ key: 'decimals' });
  totalSupply = GlobalStateKey<uint256>({ key: 'totalSupply' });
  users = BoxMap<Address, User>({ dynamicSize: true });

  arc200_Transfer = new EventLogger<{ from: Address; to: Address; value: uint256 }>();
  arc200_Approval = new EventLogger<{ owner: Address; spender: Address; value: uint256 }>();

  /**
   * Contructor which initializes name, symbol, decimals and totalSupply of the token
   *
   * @param name
   * @param symbol
   * @param decimals
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
   * @param owner
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

  arc200_allowance(owner: Address, spender: Address): uint256 {
    const check = this.checkAllowanceAvailable(this.txn.sender, spender);
    assert(check[0], 'Allowance Not Available');

    const allowance = this.getAllowance(owner, check[1]);
    return allowance.amount;
  }

  arc200_mint(account: Address, value: uint256): boolean {
    if (!this.users(globals.zeroAddress).exists) {
      this.users(globals.zeroAddress).value = { balance: 0 as uint256, allowances: [] };
    }
    assert(this.txn.sender == this.app.creator, 'Only Admin Can Mint');
    assert(account != globals.zeroAddress, 'Cannot Mint to Zero Address');
    this._transfer(globals.zeroAddress, account, value);
    return true;
  }

  arc200_burn(account: Address, value: uint256): boolean {
    assert(this.txn.sender == this.app.creator, 'Only Admin Can Burn');
    assert(account != globals.zeroAddress, 'Cannot Burn from Zero Address');
    assert(this.userExists(account), 'No Balance Available To Burn From Account');
    assert(this.ensureBalance(account, value), 'Insufficient Balance To Burn From Account');
    this._transfer(account, globals.zeroAddress, value);
    return true;
  }

  private userExists(user: Address): boolean {
    return this.users(user).exists;
  }

  private ensureBalance(user: Address, balance: uint256): boolean {
    return this.users(user).value.balance >= balance;
  }

  private createNewUser(user: Address, balance: uint256): void {
    this.users(user).value = { balance: balance, allowances: [] };
  }

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

  private updateAllowance(user: Address, balance: uint256, index: uint64): void {
    const allowances = this.users(user).value.allowances;
    allowances[index].amount = balance;
  }

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

  private getAllowance(user: Address, index: uint64): Allowance {
    const addressOffset = index * 64 + 36;
    const valueOffset = addressOffset + 32;
    return {
      spender: castBytes<Address>(this.users(user).extract(addressOffset, 32)),
      amount: castBytes<uint256>(this.users(user).extract(valueOffset, 32)),
    };
  }
}
