import { Command } from 'commander';
import readline from 'readline';
import { solanaService, pumpFunService } from './services.js';
import chalk from 'chalk';

const confirmMainnet = () => {
    return new Promise((resolve) => {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout,
        });

        rl.question(
            chalk.bold.yellow("⚠️ WARNING: You are about to perform an operation on the Mainnet.\n") +
            chalk.yellowBright("Press Enter to confirm or Ctrl+C to cancel: "),
            () => {
                rl.close();
                resolve(true);
            }
        );
    });
};

const program = new Command();

program
    .name("SolanaPump CLI")
    .description(chalk.bold.cyan("A CLI tool for managing Solana wallets and tokens with PumpFun!"))
    .version("1.0.0")
    .option("--mainnet", chalk.yellow("Use Mainnet (production environment)"))
    .option("--create-wallet", chalk.yellow("Create a new wallet"))
    .arguments("[imagePath] [ticker]")
    .action(async (imagePath, ticker, options) => {
        try {
            const isMainnet = options.mainnet;
            const env = isMainnet ? 'mainnet' : 'devnet';

            if (isMainnet) {
                await confirmMainnet();
            }

            if (options.createWallet) {
                console.log(chalk.green(`🛠️ Creating a new ${isMainnet ? 'mainnet' : 'devnet'} wallet...`));
                const walletInfo = solanaService.createWallet(env);
                console.log(chalk.cyan(`💾 Wallet saved to: ${walletInfo.filePath}`));
                console.log(chalk.magenta(`📬 Wallet Address: ${walletInfo.address}`));
                console.log(chalk.blue(`🔗 View on Explorer: ${walletInfo.explorerUrl}`));
                if (!isMainnet) {
                    console.log(chalk.yellow(`💰 To fund your wallet, visit the Solana Faucet: ${walletInfo.faucetUrl}`));
                }
                process.exit(0);
            }

            if (!imagePath || !ticker) {
                console.error(chalk.red("❌ Error: Both imagePath and ticker are required."));
                console.log(
                    chalk.cyan("Run the following command for usage information: ") +
                    chalk.yellow("node index.js --help")
                );
                process.exit(1);
            }

            const wallet = solanaService.loadWallet(env);
            console.log(chalk.green(`👜 Using wallet: ${chalk.cyan(wallet.publicKey)}`));

            const connection = solanaService.getConnection(isMainnet);

            const balance = await solanaService.checkWalletBalance(connection, wallet);
            console.log(chalk.blue(`💸 Wallet balance: ${chalk.cyan(balance)} SOL`));
            if (balance === 0) {
                console.error(
                    chalk.red("❌ Error: Wallet balance is 0. Please fund your wallet using ") +
                    chalk.yellow("https://faucet.solana.com")
                );
                process.exit(1);
            }

            const signature = await pumpFunService.submitToken(connection, wallet, imagePath, ticker);
            console.log(
                chalk.green(`✅ Token creation successful! View transaction:`),
                chalk.cyan(`https://solscan.io/tx/${signature}`)
            );
        } catch (error) {
            console.error(chalk.red("❌ Operation failed:"), chalk.yellow(error.message));
            process.exit(1);
        }
    });

program
    .on("--help", () => {
        console.log();
        console.log(chalk.bold.magenta("Examples:"));
        console.log(chalk.cyan("  Create a wallet:") + " node index.js --create-wallet");
        console.log(
            chalk.cyan("  Submit a token:") +
            " node index.js --mainnet ./path-to-image.png TOKEN"
        );
    })
    .addHelpText(
        "after",
        chalk.bold.greenBright(
            "\n🛠️ SolanaPump CLI - Manage your Solana wallets and tokens with ease! 🚀"
        )
    );

program.parse(process.argv);
