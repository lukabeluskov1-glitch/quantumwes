require('dotenv').config();
const { Client, GatewayIntentBits, Collection } = require('discord.js');
const cron = require('node-cron');
const { checkAllFeeds } = require('./src/feedChecker');
const { loadSeen, saveSeen } = require('./src/storage');
const { registerCommands } = require('./src/commands');
const { log } = require('./src/logger');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMessages,
  ]
});

client.commands = new Collection();

client.once('ready', async () => {
  log(`✅ Bot online as ${client.user.tag}`);

  // Load commands
  await registerCommands(client);

  // Load previously seen items from disk
  await loadSeen();

  // Seed existing articles on startup so we don't flood with old posts
  log('⏳ Seeding existing articles...');
  await checkAllFeeds(client, true); // true = seed mode (no posting)
  log('✅ Seeding complete. Now watching for NEW announcements...');

  // Check feeds every 10 minutes
  cron.schedule('*/10 * * * *', async () => {
    log('🔍 Checking feeds...');
    await checkAllFeeds(client, false);
    await saveSeen(); // Persist after each check
  });

  // Save seen items every hour as backup
  cron.schedule('0 * * * *', saveSeen);
});

// Handle slash commands
client.on('interactionCreate', async (interaction) => {
  if (!interaction.isChatInputCommand()) return;
  const command = client.commands.get(interaction.commandName);
  if (!command) return;
  try {
    await command.execute(interaction, client);
  } catch (err) {
    log(`❌ Command error: ${err.message}`, 'error');
    const msg = { content: '❌ Something went wrong.', ephemeral: true };
    interaction.replied ? interaction.followUp(msg) : interaction.reply(msg);
  }
});

client.login(process.env.DISCORD_TOKEN);
