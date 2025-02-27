import * as algosdk from 'algosdk';
import * as algokit from '@algorandfoundation/algokit-utils';
import { Arc200Client } from './clients/arc200Client';
import { AlgorandClient } from '@algorandfoundation/algokit-utils';

let algorand: AlgorandClient = AlgorandClient.defaultLocalNet();

const ZERO_ADDRESS = 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAY5HFKQ';
const ZERO_ADDRESS_BYTES = algosdk.decodeAddress(ZERO_ADDRESS).publicKey;

const fund = async (address: string, amount: number) => {
  const dispenser = await algorand.account.kmd.getLocalNetDispenserAccount();
  const suggestedParams = await algorand.client.algod.getTransactionParams().do();
  const xferTxn = algosdk.makePaymentTxnWithSuggestedParamsFromObject({
    from: dispenser.addr,
    to: address,
    suggestedParams,
    amount: algokit.algos(amount).microAlgos,
  });
  const signedXferTxn = xferTxn.signTxn(dispenser.account.sk);
  try {
    await algorand.client.algod.sendRawTransaction(signedXferTxn).do();
    const result = await algosdk.waitForConfirmation(algorand.client.algod, xferTxn.txID().toString(), 3);
    const confirmedRound = result['confirmed-round'];
    return true;
  } catch (e: any) {
    return false;
  }
};

function uint8ArrayToBigInt(uint8Array: Uint8Array) {
  let bigInt = BigInt(0);
  for (let i = 0; i < uint8Array.length; i++) {
    bigInt = (bigInt << BigInt(8)) | BigInt(uint8Array[i]);
  }
  return Number(bigInt);
}

(async () => {
  const contract_creator = algosdk.generateAccount();
  const th1 = algosdk.generateAccount();
  const th2 = algosdk.generateAccount();
  const th3 = algosdk.generateAccount();

  await fund(contract_creator.addr, 10);
  await fund(th1.addr, 10);
  await fund(th2.addr, 10);
  await fund(th3.addr, 10);

  const Caller = new Arc200Client(
    {
      resolveBy: 'id',
      id: 0,
    },
    algorand.client.algod
  );

  const toDecimalsTokens = (orginal: number, decimals: number) => {
    return orginal * 10 ** decimals;
  };
  const toOriginalTokens = (withDecimals: number, decimals: number) => {
    return withDecimals / 10 ** decimals;
  };

  const name = 'Satish';
  const decimals = 0;
  const symbol = 'SH';
  await Caller.create.createApplication({ name, decimals, symbol }, { sender: contract_creator });

  const getTotalSupply = async () => {
    const r = await Caller.getGlobalState();
    return toOriginalTokens(uint8ArrayToBigInt(r.totalSupply?.asByteArray()!), decimals);
  };

  const getBalanceOfAddress = async (address: string) => {
    const r: any = await Caller.appClient.getBoxValueFromABIType(
      algosdk.decodeAddress(address).publicKey,
      algosdk.ABIType.from('(uint256,(address,uint256)[])')
    );
    return toOriginalTokens(Number(r[0]), decimals);
  };

  const getAllowancesOfAddress = async (address: string) => {
    const r: any = await Caller.appClient.getBoxValueFromABIType(
      algosdk.decodeAddress(address).publicKey,
      algosdk.ABIType.from('(uint256,(address,uint256)[])')
    );
    let allowances = [];
    for (var i = 0; i < r[1].length; i++) {
      allowances.push({ address: r[1][i][0], value: toOriginalTokens(Number(r[1][i][1]), decimals) });
    }
    return allowances;
  };

  const { appId, appAddress } = await Caller.appClient.getAppReference();
  await fund(appAddress, 10);
  console.log(
    `
    Created Application with APP ID : ${appId}
    `
  );

  const res_name = await Caller.arc200Name({}, { sender: contract_creator });
  console.log(
    `
    Retrieved Token Name using arc200Name method: ${res_name.return}
    `
  );

  const res_symbol = await Caller.arc200Symbol({}, { sender: contract_creator });
  console.log(
    `
    Retrieved Symbol of Token using arc200Symbol method: ${res_symbol.return}
    `
  );

  const res_decimals = await Caller.arc200Decimals({}, { sender: contract_creator });
  console.log(
    `
    Retrieved Decimals of Token using arc200Decimals method: ${res_decimals.return}
    `
  );

  const res_totalSupply = await Caller.arc200TotalSupply({}, { sender: contract_creator });
  console.log(
    `
    Retrieved totalSupply of Token using arc200TotalSupply method: ${res_totalSupply.return}
    `
  );

  const res_mint = await Caller.arc200Mint(
    { account: th1.addr, value: BigInt(toDecimalsTokens(100, decimals)) },
    {
      sender: contract_creator,
      boxes: [
        { appId: 0, name: algosdk.decodeAddress(th1.addr).publicKey },
        { appIndex: 0, name: ZERO_ADDRESS_BYTES },
      ],
    }
  );
  console.log(
    `
    Minted 100 tokens to th1 ${th1.addr}
    totalSupply: ${await getTotalSupply()}
    th1 ${th1.addr} balance: ${await getBalanceOfAddress(th1.addr)}
    `
  );

  const transfer_res = await Caller.arc200Transfer(
    { to: th2.addr, value: toDecimalsTokens(20, decimals) },
    {
      sender: th1,
      boxes: [
        { appIndex: 0, name: algosdk.decodeAddress(th1.addr).publicKey },
        { appIndex: 0, name: algosdk.decodeAddress(th2.addr).publicKey },
      ],
    }
  );
  console.log(
    `
    Transferred 20 tokens to th2 ${th2.addr} from th1 ${th1.addr}
    totalSupply: ${await getTotalSupply()}
    th1 ${th1.addr} balance: ${await getBalanceOfAddress(th1.addr)}
    th2 ${th2.addr} balance: ${await getBalanceOfAddress(th2.addr)}
    `
  );

  const allowance_res = await Caller.arc200Approve(
    { spender: th3.addr, value: toDecimalsTokens(30, decimals) },
    {
      sender: th1,
      boxes: [
        { appIndex: 0, name: algosdk.decodeAddress(th1.addr).publicKey },
        { appIndex: 0, name: algosdk.decodeAddress(th3.addr).publicKey },
      ],
    }
  );
  var allowances = await getAllowancesOfAddress(th1.addr);
  console.log(
    `
    Given Allownace of 30 tokens to th3 ${th3.addr} from th1 ${th1.addr}
    totalSupply: ${await getTotalSupply()}
    th1 ${th1.addr} allowances:`
  );
  allowances.forEach((allowance) => {
    console.log(
      `{
          address: "${allowance.address}",
          value: ${allowance.value}
       },
      `
    );
  });

  const allowance2_res = await Caller.arc200Approve(
    { spender: th2.addr, value: toDecimalsTokens(20, decimals) },
    {
      sender: th1,
      boxes: [
        { appIndex: 0, name: algosdk.decodeAddress(th1.addr).publicKey },
        { appIndex: 0, name: algosdk.decodeAddress(th2.addr).publicKey },
      ],
    }
  );
  var allowances = await getAllowancesOfAddress(th1.addr);
  console.log(
    `
    Given Allownace of 20 tokens to th2 ${th2.addr} from th1 ${th1.addr}
    totalSupply: ${await getTotalSupply()}
    th1 ${th1.addr} allowances:`
  );
  allowances.forEach((allowance) => {
    console.log(
      `{
          address: "${allowance.address}",
          value: ${allowance.value}
       },
      `
    );
  });

  const allowanceTransfer_res = await Caller.arc200TransferFrom(
    {
      from: th1.addr,
      to: th2.addr,
      value: toDecimalsTokens(30, decimals),
    },
    {
      sender: th3,
      boxes: [
        { appIndex: 0, name: algosdk.decodeAddress(th1.addr).publicKey },
        { appIndex: 0, name: algosdk.decodeAddress(th2.addr).publicKey },
      ],
    }
  );
  console.log(
    `
    Trasferred 30 tokens to th2 ${th2.addr} using allowance given to  ${th3.addr}
    totalSupply: ${await getTotalSupply()}
    th1 ${th1.addr} balance: ${await getBalanceOfAddress(th1.addr)}
    th2 ${th2.addr} balance: ${await getBalanceOfAddress(th2.addr)}
    th1 ${th1.addr} allowances:`
  );
  var allowances = await getAllowancesOfAddress(th1.addr);
  allowances.forEach((allowance) => {
    console.log(
      `{
          address: "${allowance.address}",
          value: ${allowance.value}
       },
      `
    );
  });

  const allowanceTransfer2_res = await Caller.arc200TransferFrom(
    {
      from: th1.addr,
      to: th3.addr,
      value: toDecimalsTokens(20, decimals),
    },
    {
      sender: th2,
      boxes: [
        { appIndex: 0, name: algosdk.decodeAddress(th1.addr).publicKey },
        { appIndex: 0, name: algosdk.decodeAddress(th3.addr).publicKey },
      ],
    }
  );
  console.log(
    `
    Trasferred 20 tokens to th3 ${th3.addr} using allowance given to th2 ${th2.addr}
    totalSupply: ${await getTotalSupply()}
    th1 ${th1.addr} balance: ${await getBalanceOfAddress(th1.addr)}
    th2 ${th2.addr} balance: ${await getBalanceOfAddress(th2.addr)}
    th3 ${th3.addr} balance: ${await getBalanceOfAddress(th3.addr)}
    th1 ${th1.addr} allowances:`
  );
  var allowances = await getAllowancesOfAddress(th1.addr);
  allowances.forEach((allowance) => {
    console.log(
      `{
          address: "${allowance.address}",
          value: ${allowance.value}
       },
      `
    );
  });

  const allowance3_res = await Caller.arc200Approve(
    { spender: th2.addr, value: toDecimalsTokens(15, decimals) },
    {
      sender: th1,
      boxes: [
        { appIndex: 0, name: algosdk.decodeAddress(th1.addr).publicKey },
        { appIndex: 0, name: algosdk.decodeAddress(th2.addr).publicKey },
      ],
    }
  );
  var allowances = await getAllowancesOfAddress(th1.addr);
  console.log(
    `
    Given Allownace of 15 tokens to th2 ${th2.addr} from th1 ${th1.addr}
    totalSupply: ${await getTotalSupply()}
    th1 ${th1.addr} allowances:`
  );
  allowances.forEach((allowance) => {
    console.log(
      `{
          address: "${allowance.address}",
          value: ${allowance.value}
       },
      `
    );
  });

  const burn_res = await Caller.arc200Burn(
    { account: th3.addr, value: 20 },
    {
      sender: contract_creator,
      boxes: [
        { appIndex: 0, name: algosdk.decodeAddress(th3.addr).publicKey },
        { appIndex: 0, name: ZERO_ADDRESS_BYTES },
      ],
    }
  );
  console.log(
    `
    Burned 20 tokens from th3 ${th3.addr}
    totalSupply: ${await getTotalSupply()}
    th1 ${th1.addr} balance: ${await getBalanceOfAddress(th1.addr)}
    th2 ${th2.addr} balance: ${await getBalanceOfAddress(th2.addr)}
    th3 ${th3.addr} balance: ${await getBalanceOfAddress(th3.addr)}
    ZeroAddress ${ZERO_ADDRESS} balance: ${await getBalanceOfAddress(ZERO_ADDRESS)}
    th1 ${th1.addr} allowances:`
  );
  var allowances = await getAllowancesOfAddress(th1.addr);
  allowances.forEach((allowance) => {
    console.log(
      `{
        address: "${allowance.address}",
        value: ${allowance.value}
     },
    `
    );
  });
})();
