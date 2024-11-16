import { Connection, Keypair, VersionedTransaction } from "@solana/web3.js";
import fs from "fs";
import axios from "axios";
import FormData from "form-data";
import chalk from "chalk";
import path from "path";
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const config = {
    CONFIG_FILE: 'config.json',
    DEFAULT_CONFIG: {
        devnet: {
            wallet: 'devnet-wallet.json'
        },
        mainnet: {
            wallet: 'mainnet-wallet.json'
        },
        pinata: {
            apiKey: "",
            secretApiKey: ""
        }
    }
};

const solanaService = {
    loadConfig: () => {
        try {
            if (!fs.existsSync(config.CONFIG_FILE)) {
                fs.writeFileSync(config.CONFIG_FILE, JSON.stringify(config.DEFAULT_CONFIG, null, 2));
                console.log(chalk.green("✅ Created default config file: "), chalk.cyan(config.CONFIG_FILE));
            }
            return JSON.parse(fs.readFileSync(config.CONFIG_FILE, 'utf8'));
        } catch (error) {
            console.error(chalk.red("❌ Error loading config:"), chalk.yellow(error.message));
            throw error;
        }
    },

    loadWallet: (env) => {
        try {
            const cfg = solanaService.loadConfig();
            const walletPath = cfg[env].wallet;

            if (!fs.existsSync(walletPath)) {
                throw new Error(`Wallet file not found: ${walletPath}. Please create a wallet using --create-wallet`);
            }

            const walletData = JSON.parse(fs.readFileSync(walletPath, 'utf8'));
            console.log(chalk.green("📂 Wallet loaded successfully from:"), chalk.cyan(walletPath));
            return Keypair.fromSecretKey(new Uint8Array(walletData));
        } catch (error) {
            console.error(chalk.red("❌ Error loading wallet:"), chalk.yellow(error.message));
            throw error;
        }
    },

    createWallet: (env) => {
        try {
            // Define wallet file path directly in the current directory
            const walletFile = path.join(__dirname, `${env}-wallet.json`);

            // Generate a new wallet
            const wallet = Keypair.generate();
            fs.writeFileSync(walletFile, JSON.stringify(Array.from(wallet.secretKey)));

            // Get wallet address and relevant details
            const walletAddress = wallet.publicKey.toBase58();
            console.log(chalk.green("🛠️ New wallet created successfully!"));

            return {
                filePath: walletFile,
                address: walletAddress,
                explorerUrl: `https://explorer.solana.com/address/${walletAddress}?cluster=${env}`,
                faucetUrl: env === 'devnet' ? 'https://faucet.solana.com' : null,
            };
        } catch (error) {
            console.error(chalk.red("❌ Error creating wallet:"), chalk.yellow(error.message));
            throw error;
        }
    },

    checkWalletBalance: async (connection, wallet) => {
        const balance = await connection.getBalance(wallet.publicKey);
        console.log(chalk.blue(`💰 Checking wallet balance: ${balance / 1e9} SOL`));
        return balance / 1e9;
    },

    getConnection: (isMainnet) => {
        const url = isMainnet
            ? "https://api.mainnet-beta.solana.com"
            : "https://api.devnet.solana.com";
        console.log(chalk.green("🔗 Connected to Solana"), isMainnet ? chalk.green("Mainnet") : chalk.cyan("Devnet"));
        return new Connection(url);
    }
};

const pinataService = {
    getCredentials: () => {
        const config = solanaService.loadConfig();
        if (!config.pinata?.apiKey || !config.pinata?.secretApiKey) {
            throw new Error('Pinata API credentials not found in config.json. Please add them to continue.');
        }
        console.log(chalk.green("🔑 Pinata credentials loaded successfully!"));
        return {
            apiKey: config.pinata.apiKey,
            secretApiKey: config.pinata.secretApiKey
        };
    },

    isUrl: (imagePath) => {
        try {
            new URL(imagePath);
            return true;
        } catch (e) {
            return false;
        }
    },

    uploadImage: async (imagePath) => {
        const url = "https://api.pinata.cloud/pinning/pinFileToIPFS";
        const credentials = pinataService.getCredentials();

        try {
            let formData = new FormData();

            if (pinataService.isUrl(imagePath)) {
                console.log(chalk.yellow("🌐 Downloading remote image..."));
                const response = await axios.get(imagePath, {
                    responseType: 'arraybuffer',
                    headers: {
                        'Accept': 'image/*'
                    }
                });

                const fileName = imagePath.split('/').pop() || 'image.png';
                formData.append('file', Buffer.from(response.data), {
                    filename: fileName,
                    contentType: response.headers['content-type'] || 'image/png'
                });
            } else {
                formData.append('file', fs.createReadStream(imagePath));
            }

            const response = await axios.post(url, formData, {
                headers: {
                    pinata_api_key: credentials.apiKey,
                    pinata_secret_api_key: credentials.secretApiKey,
                    ...formData.getHeaders()
                },
                maxContentLength: Infinity,
                maxBodyLength: Infinity,
            });

            console.log(chalk.green("✅ Image uploaded to Pinata."));
            return `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
        } catch (err) {
            console.error(chalk.red("❌ Failed to upload image to Pinata:"), chalk.yellow(err.message));
            if (err.response) {
                console.error(chalk.red("⚠️ Response data:"), chalk.yellow(err.response.data));
                console.error(chalk.red("⚠️ Response status:"), chalk.yellow(err.response.status));
            }
            throw err;
        }
    },

    uploadMetadata: async (metadata) => {
        const url = "https://api.pinata.cloud/pinning/pinJSONToIPFS";
        const credentials = pinataService.getCredentials();

        try {
            const response = await axios.post(url, metadata, {
                headers: {
                    pinata_api_key: credentials.apiKey,
                    pinata_secret_api_key: credentials.secretApiKey,
                },
            });

            console.log(chalk.green("✅ Metadata uploaded to Pinata."));
            return `https://gateway.pinata.cloud/ipfs/${response.data.IpfsHash}`;
        } catch (err) {
            console.error(chalk.red("❌ Failed to upload metadata to Pinata:"), chalk.yellow(err.message));
            throw err;
        }
    }
};

const pumpFunService = {
    submitToken: async (connection, wallet, imagePath, ticker) => {
        console.log(chalk.green("📝 Preparing submission to PumpFun..."));

        try {
            // Upload image and metadata
            const imageUri = await pinataService.uploadImage(imagePath);
            const metadata = {
                name: ticker,
                symbol: ticker,
                description: `This is ${ticker} token.`,
                image: imageUri,
            };
            const metadataUri = await pinataService.uploadMetadata(metadata);

            const mintKeypair = Keypair.generate();

            const response = await fetch("https://pumpportal.fun/api/trade-local", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    publicKey: wallet.publicKey.toBase58(),
                    action: "create",
                    tokenMetadata: {
                        name: ticker,
                        symbol: ticker,
                        uri: metadataUri
                    },
                    mint: mintKeypair.publicKey.toBase58(),
                    denominatedInSol: "true",
                    amount: 0.2,
                    slippage: 10,
                    priorityFee: 0.0005,
                    pool: "pump"
                })
            });

            if (response.status !== 200) {
                throw new Error(`Failed to create token on pump.fun: ${response.statusText}`);
            }

            // response success
            const data = await response.arrayBuffer();
            const tx = VersionedTransaction.deserialize(new Uint8Array(data));

            const { blockhash } = await connection.getLatestBlockhash();
            tx.recentBlockhash = blockhash;
            tx.feePayer = wallet.publicKey;

            tx.sign([mintKeypair, wallet]);

            const txSignature = await connection.sendTransaction(tx, {
                skipPreflight: false,
                preflightCommitment: 'processed'
            });

            console.log(chalk.green("✅ Token successfully submitted to PumpFun!"));
            return txSignature;
        } catch (error) {
            console.error(chalk.red("❌ Failed to submit to PumpFun:"), chalk.yellow(error.message));
            throw error;
        }
    }
};

export {
    solanaService,
    pinataService,
    pumpFunService
};
