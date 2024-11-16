# <div align="center">SolanaPumpFun CLI</div>

## Overview
SolanaPumpFun CLI is a command-line tool for managing Solana wallets and tokens with PumpFun. It allows you to create wallets, check wallet balances, and submit tokens to PumpFun.

## Prerequisites
- Node.js
- npm

## Installation

Install the dependencies:
```sh
  npm install
```

## Usage
To use the SolanaPumpFun CLI, you can run the following commands:

1. **Create a Wallet:**
    ```sh
    node index.js --create-wallet
    ```
   This command creates a new wallet and saves it to a file. It also displays the wallet address and a link to view it on the Solana Explorer.

2. **Submit a Token:**
    ```sh
    node index.js [imagePath] [ticker] --mainnet
    ```
   This command submits a token to PumpFun. You need to provide the path to the image and the ticker symbol for the token. The `--mainnet` option is used to perform the operation on the Mainnet.

## Help
To display the help information, run:
```sh
node index.js --help
```

This command shows the available options and examples of how to use the CLI.

## Examples
- **Create a Wallet:**
    ```sh
    node index.js --create-wallet
    ```

- **Submit a Token:**
    ```sh
    node index.js --mainnet ./path-to-image.png TOKEN
    ```

## Notes
- Ensure your wallet has sufficient balance before submitting a token.
- Use the Solana Faucet to fund your wallet if you are using the Devnet environment.

#### License
This project is licensed under the MIT License.
