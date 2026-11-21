require('dotenv').config();

const { REST, Routes } = require('discord.js');

const oldCommands = require('./commands');
const store = require('./modules/store');
const promotions = require('./modules/promotions');
const management = require('./modules/management');

async function deploy() {
  if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
    console.error('❌ DISCORD_TOKEN ou CLIENT_ID manquant.');
    process.exit(1);
  }

  const commands = [...oldCommands, ...store.commands, ...promotions.commands, ...management.commands];
  const names = commands.map(c => c.data.name);

  if (names.length !== new Set(names).size) {
    console.error('❌ Des commandes possèdent le même nom.');
    process.exit(1);
  }

  const body = commands.map(c => c.data.toJSON());

  const rest = new REST({ version: '10' })
    .setToken(process.env.DISCORD_TOKEN);

  try {
    console.log('⏳ Déploiement global de MarketX...');

    await rest.put(
      Routes.applicationCommands(process.env.CLIENT_ID),
      { body }
    );

    console.log(`✅ ${body.length} commandes déployées !`);
    console.log('🛒 Boutique et tickets activés.');
    console.log('🎁 Giveaway conservé.');
    console.log('🌍 Mode multi-serveurs.');
  } catch (error) {
    console.error('❌ Erreur de déploiement :', error);
    process.exitCode = 1;
  }
}

deploy();
