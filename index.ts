import { Telegraf } from 'telegraf';
import { Connection, PublicKey } from '@solana/web3.js';
import dotenv from 'dotenv';
import axios from 'axios';

dotenv.config();

//initialize bot
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN!);

//connect to sol mainnet
const connection = new Connection(process.env.SOLANA_RPC_URL!, 'confirmed');

// Helper function to fetch token holdings
async function getTokenAccounts(walletAddress: string) {
    const publicKey = new PublicKey(walletAddress);
    const tokenAccounts = await connection.getParsedTokenAccountsByOwner(publicKey, { programId: new PublicKey('TokenkegQfeZyiNwAJbN7p6kWaa5Beo9NNodXcxnqfnmm') });
  
    return tokenAccounts.value.map(account => {
      const tokenAmount = account.account.data.parsed.info.tokenAmount;
      return {
        mint: account.account.data.parsed.info.mint,
        amount: tokenAmount.uiAmountString,
      };
    });
  }
  
  // Helper function to get transaction history (simplified for now)
  async function getTransactionHistory(walletAddress: string) {
    const publicKey = new PublicKey(walletAddress);
    const confirmedSignatures = await connection.getConfirmedSignaturesForAddress2(publicKey, { limit: 10 });
  
    return confirmedSignatures;
  }
  
  // Helper function to fetch NFTs (using Solana Beach API or another service)
  async function getNFTs(walletAddress: string) {
    const response = await axios.get(`https://api.solanabeach.io/v1/address/${walletAddress}/tokens?type=nft`);
    return response.data;
  }
  
  // Helper function to fetch wallet's first transaction (to approximate creation date)
  async function getWalletCreationDate(walletAddress: string) {
    const publicKey = new PublicKey(walletAddress);
    const confirmedSignatures = await connection.getConfirmedSignaturesForAddress2(publicKey, { limit: 1, before: undefined, until: undefined });
  
    if (confirmedSignatures.length > 0) {
      const signature = confirmedSignatures[0].signature;
      const transaction = await connection.getTransaction(signature);
      return transaction?.blockTime ? new Date(transaction.blockTime * 1000) : null;
    }
    return null;
  }

// Handle /start command
bot.start((ctx) => {
    ctx.reply('Welcome to the Solana\'s Bureau of Investigation Bot! Use /track to track a wallet or /memecoins for token info.');
});

// Track wallet balance
bot.command('track', async (ctx) => {
    const args = ctx.message.text.split(' ');
    if (args.length < 2) {
        ctx.reply('Please provide a wallet address. Example: /track <wallet_address>');
        return;
    }

    const walletAddress = args[1];
    try {
        const publicKey = new PublicKey(walletAddress);
        // Fetch wallet creation date
    const creationDate = await getWalletCreationDate(walletAddress);

    // Fetch wallet balance
    const balance = await connection.getBalance(publicKey);

    // Fetch token accounts (SPL tokens)
    const tokens = await getTokenAccounts(walletAddress);

    // Fetch NFTs owned by the wallet
    const nfts = await getNFTs(walletAddress);

    // Fetch transaction history
    const transactions = await getTransactionHistory(walletAddress);

    // Example: Calculate profit and loss based on transactions (you'd need more detailed logic here)
    let profitLoss = 0;
    for (const tx of transactions) {
      const transaction = await connection.getTransaction(tx.signature);
      if (transaction) {
        transaction.meta?.postBalances.forEach((balance, index) => {
          if (index === 0) { // Assuming it's SOL being sent/received
            profitLoss += balance / 1e9; // Convert lamports to SOL
          }
        });
      }
    }

    // Build the response message
    let response = `**Wallet Info for ${walletAddress}**\n\n`;
    response += `**Balance:** ${(balance / 1e9).toFixed(2)} SOL\n`;
    response += `**Creation Date:** ${creationDate ? creationDate.toLocaleString() : 'N/A'}\n`;
    response += `**Profit/Loss:** ${profitLoss.toFixed(2)} SOL\n`;
    response += `**Tokens:**\n`;
    tokens.forEach(token => {
      response += `- Token: ${token.mint}, Amount: ${token.amount}\n`;
    });
    response += `\n**NFTs:**\n`;
    nfts.forEach((nft: { name: any; mintAddress: any; }) => {
      response += `- NFT: ${nft.name}, Mint: ${nft.mintAddress}\n`;
    });
    response += `\n**Latest Transactions:**\n`;
    transactions.forEach(tx => {
        const date = tx.blockTime ? new Date(tx.blockTime * 1000).toLocaleString() : 'Unknown Date';
        response += `- Tx: ${tx.signature}, Date: ${date}\n`;
      });
      

    ctx.reply(response);
  } catch (err) {
    ctx.reply('Failed to retrieve wallet data. Please ensure the address is valid.');
  }
});

// Fetch meme token information
bot.command('memecoins', async (ctx) => {
    // Replace this with actual token fetching logic
    ctx.reply('Fetching memecoin details is under construction 🚧');
});

// Start the bot
bot.launch().then(() => console.log('Bot is running...'));

// Graceful stop
process.once('SIGINT', () => bot.stop('SIGINT'));
process.once('SIGTERM', () => bot.stop('SIGTERM'));
