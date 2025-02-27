# ARC200 Token Standard Implementation in TealScript

This project implements the ARC200 token standard on the Algorand blockchain using TealScript. ARC200 is a token standard similar to ERC20 on Ethereum, providing a common interface for fungible tokens on Algorand.

## Overview

This repository contains:

-   TealScript source code for the ARC200 smart contract.
-   A demonstration script (`arc200.demo.ts`) for interacting with the contract on an Algorand local network.
-   This README file providing instructions and information about the project.

## Getting Started

### Prerequisites

-   Node.js and npm installed
-   Algorand Sandbox (local network) running
-   `algokit` CLI tool installed and configured

### Installation

1.  Clone the repository:

    ```bash
    git clone https://github.com/SatishGAXL/arc200-ts.git
    cd arc200-ts/projects/arc200-ts
    ```

2.  Install dependencies:

    ```bash
    npm install
    ```

### Compilation (Optional)

Compile the TealScript code into TEAL using the TealScript compiler:

```bash
npm run build
```

This will generate the TEAL files needed to deploy the contract.

### Deployment and Usage (Local Network)

1.  **Start Algorand Sandbox:** Ensure your Algorand Sandbox is running.

```bash
algokit localnet reset
```

2.  **Run the Demo Script:** The `arc200.demo.ts` script is designed to be used with the Algorand local network. It demonstrates basic token operations like:

    -   Deploying the contract
    -   Minting tokens
    -   Transferring tokens
    -   Burning tokens
    -   Getting token info

    Run the script using:

    ```bash
    npx tsx .\contracts\arc200.demo.ts
    ```

    **Note:** This script requires `algokit` to be configured correctly to interact with your local Algorand network.  Ensure you have started running localnet using `algokit localnet reset`.

### Contract Interface (ARC200 Standard)

The ARC200 smart contract implements the following methods:

-   `deploy`: Deploys the contract and initializes token parameters.
-   `mint`: Mints new tokens to a specified account.
-   `transfer`: Transfers tokens from one account to another.
-   `transferFrom`: Transfers tokens from one account to another, with allowance.
-   `burn`: Burns tokens from a specified account.
-   `approve`: Approves another account to spend tokens on behalf of the owner.
-   `allowance`: Returns the amount of tokens that an owner has allowed to a spender.
-   `balanceOf`: Returns the token balance of an account.
-   `totalSupply`: Returns the total supply of tokens.
-   `name`: Returns the name of the token.
-   `symbol`: Returns the symbol of the token.
-   `decimals`: Returns the number of decimals the token uses.