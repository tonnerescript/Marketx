require('dotenv').config();

const {
  Client,
  GatewayIntentBits,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  StringSelectMenuBuilder
} = require('discord.js');

const commands = require('./commands');
const db = require('./database/database');
const store = require('./modules/store');

if (!process.env.DISCORD_TOKEN) {
  console.error('❌ DISCORD_TOKEN manquant dans .env');
  process.exit(1);
}

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds
  ]
});

const allCommands = [...commands, ...store.commands];
client.commands = new Map(allCommands.map(c => [c.data.name, c]));

client.scheduleGiveaway = function(id) {
  const data = db.load();
  const giveaway = data.giveaways[id];
  if (!giveaway || giveaway.ended) return;

  const delay = giveaway.endsAt - Date.now();

  setTimeout(() => {
    client.finishGiveaway(id).catch(console.error);
  }, Math.max(0, delay));
};

client.finishGiveaway = async function(id) {
  const data = db.load();
  const giveaway = data.giveaways[id];

  if (!giveaway || giveaway.ended) return;

  giveaway.ended = true;

  const pool = [...giveaway.entrants];
  const winners = [];

  while (pool.length && winners.length < giveaway.winners) {
    const index = Math.floor(Math.random() * pool.length);
    winners.push(pool.splice(index, 1)[0]);
  }

  giveaway.selected = winners;
  db.save(data);

  try {
    const channel = await client.channels.fetch(giveaway.channelId);
    const message = await channel.messages.fetch(giveaway.messageId);

    const embed = new EmbedBuilder()
      .setColor(0x22C55E)
      .setTitle('🏆 GIVEAWAY TERMINÉ')
      .setDescription(
        `**Lot :** ${giveaway.prize}\n` +
        `**Participants :** ${giveaway.entrants.length}\n` +
        `**Gagnants :** ${winners.length ? winners.map(id => `<@${id}>`).join(', ') : 'Aucun gagnant'}`
      )
      .setFooter({ text: 'MarketX Giveaway' });

    await message.edit({
      embeds: [embed],
      components: [new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId('giveaway_finished')
          .setLabel('Concours terminé')
          .setStyle(ButtonStyle.Secondary)
          .setDisabled(true)
      )]
    });

    if (winners.length) {
      await channel.send(`🎉 Félicitations ${winners.map(id => `<@${id}>`).join(', ')} ! Vous avez gagné **${giveaway.prize}** !`);
    } else {
      await channel.send(`Le concours **${giveaway.prize}** est terminé sans participant.`);
    }
  } catch (error) {
    console.error('Erreur fin giveaway:', error);
  }
};

client.once('ready', () => {
  console.log('================================');
  console.log(`🤖 ${client.user.tag} est en ligne !`);
  console.log('🛒 Marketplace activée');
  console.log('🎁 Giveaway activé');
  console.log('📚 Commande /help disponible');
  console.log('================================');

  const data = db.load();
  for (const [id, giveaway] of Object.entries(data.giveaways)) {
    if (!giveaway.ended) client.scheduleGiveaway(id);
  }
});

client.on('interactionCreate', async interaction => {
  try {
    if (interaction.isChatInputCommand()) {
      const command = client.commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction, client);
      return;
    }

    if (interaction.isStringSelectMenu()) {
      const handled = await store.handleSelect(interaction);
      if (handled) return;
    }

    if (interaction.isButton()) {
      const handled = await store.handleButton(interaction);
      if (handled) return;
    }

    if (interaction.isStringSelectMenu() && interaction.customId === 'marketx_help') {
      const pages = {
        all: {
          title: '📚 Toutes les commandes',
          description: '`/help`\n`/boutique creer`\n`/boutique voir`\n`/annonce publier`\n`/catalogue`\n`/giveaway creer`\n`/giveaway terminer`\n`/giveaway reroll`\n`/giveaway liste`\n`/admin stats`'
        },
        market: {
          title: '🛒 Marketplace',
          description: '`/boutique creer` — Créer une boutique\n`/boutique voir` — Voir sa boutique\n`/annonce publier` — Publier un produit\n`/catalogue` — Voir les annonces'
        },
        giveaway: {
          title: '🎁 Giveaway',
          description: '`/giveaway creer` — Créer un concours\n`/giveaway terminer` — Terminer un concours\n`/giveaway reroll` — Nouveau gagnant\n`/giveaway liste` — Concours en cours'
        },
        admin: {
          title: '🛡️ Administration',
          description: '`/admin stats` — Statistiques du serveur'
        }
      };

      const page = pages[interaction.values[0]] || pages.all;
      const embed = new EmbedBuilder()
        .setColor(0x8B5CF6)
        .setTitle(page.title)
        .setDescription(page.description)
        .setFooter({ text: 'MarketX • Centre de commandes' });

      return interaction.update({ embeds: [embed] });
    }

    if (interaction.isButton() && interaction.customId.startsWith('giveaway_join:')) {
      const id = interaction.customId.split(':')[1];
      const data = db.load();
      const giveaway = data.giveaways[id];

      if (!giveaway || giveaway.ended) {
        return interaction.reply({ content: '❌ Ce concours est terminé ou introuvable.', ephemeral: true });
      }

      if (giveaway.guildId !== interaction.guildId) {
        return interaction.reply({ content: '❌ Concours invalide.', ephemeral: true });
      }

      if (giveaway.entrants.includes(interaction.user.id)) {
        return interaction.reply({ content: 'Tu participes déjà à ce concours !', ephemeral: true });
      }

      giveaway.entrants.push(interaction.user.id);
      db.save(data);

      return interaction.reply({ content: '🎉 Ta participation est enregistrée !', ephemeral: true });
    }
  } catch (error) {
    console.error('Erreur interaction:', error);

    if (interaction.isRepliable() && !interaction.replied && !interaction.deferred) {
      await interaction.reply({ content: '❌ Une erreur est survenue.', ephemeral: true }).catch(() => {});
    }
  }
});

client.login(process.env.DISCORD_TOKEN);
