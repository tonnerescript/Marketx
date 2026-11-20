const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  StringSelectMenuBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');

const db = require('./database/database');

const commands = [
  {
    data: new SlashCommandBuilder()
      .setName('help')
      .setDescription('Afficher toutes les commandes de MarketX'),

    async execute(interaction) {
      const menu = new StringSelectMenuBuilder()
        .setCustomId('marketx_help')
        .setPlaceholder('Choisir une catégorie')
        .addOptions(
          { label: 'Toutes les commandes', value: 'all', emoji: '📚' },
          { label: 'Marketplace', value: 'market', emoji: '🛒' },
          { label: 'Giveaway', value: 'giveaway', emoji: '🎁' },
          { label: 'Administration', value: 'admin', emoji: '🛡️' }
        );

      const embed = new EmbedBuilder()
        .setColor(0x8B5CF6)
        .setTitle('📚 MarketX — Centre de commandes')
        .setDescription(
          'Bienvenue sur MarketX !\n' +
          'Utilise le menu ci-dessous pour découvrir toutes les commandes.'
        )
        .addFields(
          { name: '🛒 Marketplace', value: '`/boutique` · `/annonce` · `/catalogue`' },
          { name: '🎁 Giveaway', value: '`/giveaway`' },
          { name: '🛡️ Administration', value: '`/admin`' }
        )
        .setFooter({ text: 'MarketX • Marketplace & Giveaways' });

      await interaction.reply({
        embeds: [embed],
        components: [new ActionRowBuilder().addComponents(menu)],
        ephemeral: true
      });
    }
  },

  {
    data: new SlashCommandBuilder()
      .setName('boutique')
      .setDescription('Gérer ta boutique')
      .addSubcommand(sub => sub
        .setName('creer')
        .setDescription('Créer ta boutique')
        .addStringOption(o => o.setName('nom').setDescription('Nom de la boutique').setRequired(true))
        .addStringOption(o => o.setName('description').setDescription('Description').setRequired(true))
      )
      .addSubcommand(sub => sub
        .setName('voir')
        .setDescription('Voir ta boutique')
      ),

    async execute(interaction) {
      const data = db.load();
      const sub = interaction.options.getSubcommand();
      const id = interaction.user.id;
      const key = `${interaction.guildId}_${id}`;

      if (sub === 'creer') {
        if (data.shops[key]) {
          return interaction.reply({ content: '❌ Tu possèdes déjà une boutique.', ephemeral: true });
        }

        data.shops[key] = {
          guildId: interaction.guildId,
          owner: id,
          name: interaction.options.getString('nom'),
          description: interaction.options.getString('description'),
          createdAt: Date.now()
        };

        db.save(data);
        return interaction.reply({ content: '✅ Ta boutique a été créée !', ephemeral: true });
      }

      const shop = data.shops[key];
      if (!shop) {
        return interaction.reply({ content: '❌ Tu ne possèdes pas encore de boutique. Utilise `/boutique creer`.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(0x8B5CF6)
        .setTitle(`🏪 ${shop.name}`)
        .setDescription(shop.description)
        .addFields({ name: 'Vendeur', value: `<@${shop.owner}>` });

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },

  {
    data: new SlashCommandBuilder()
      .setName('annonce')
      .setDescription('Publier une annonce')
      .addSubcommand(sub => sub
        .setName('publier')
        .setDescription('Publier un produit')
        .addStringOption(o => o.setName('titre').setDescription('Titre du produit').setRequired(true))
        .addStringOption(o => o.setName('description').setDescription('Description du produit').setRequired(true))
        .addIntegerOption(o => o.setName('prix').setDescription('Prix en euros').setMinValue(0).setRequired(true))
      ),

    async execute(interaction) {
      const data = db.load();
      const key = `${interaction.guildId}_${interaction.user.id}`;
      const shop = data.shops[key];

      if (!shop) {
        return interaction.reply({ content: '❌ Crée d’abord ta boutique avec `/boutique creer`.', ephemeral: true });
      }

      const product = {
        id: Date.now().toString(),
        guildId: interaction.guildId,
        seller: interaction.user.id,
        title: interaction.options.getString('titre'),
        description: interaction.options.getString('description'),
        price: interaction.options.getInteger('prix'),
        createdAt: Date.now()
      };

      data.products.push(product);
      db.save(data);

      const embed = new EmbedBuilder()
        .setColor(0x22C55E)
        .setTitle(`🛒 ${product.title}`)
        .setDescription(product.description)
        .addFields(
          { name: 'Prix', value: `${product.price} €`, inline: true },
          { name: 'Vendeur', value: `<@${product.seller}>`, inline: true },
          { name: 'Boutique', value: shop.name, inline: true }
        )
        .setFooter({ text: `Référence : ${product.id}` });

      await interaction.reply({ embeds: [embed] });
    }
  },

  {
    data: new SlashCommandBuilder()
      .setName('catalogue')
      .setDescription('Consulter les annonces disponibles'),

    async execute(interaction) {
      const data = db.load();
      const products = data.products.filter(p => p.guildId === interaction.guildId).slice(-10).reverse();

      if (!products.length) {
        return interaction.reply({ content: '📭 Aucune annonce pour le moment.', ephemeral: true });
      }

      const embed = new EmbedBuilder()
        .setColor(0x8B5CF6)
        .setTitle('🛒 Catalogue MarketX')
        .setDescription(products.map(p =>
          `**${p.title}**\n${p.description}\n💰 ${p.price} € • Vendeur : <@${p.seller}>\nRéf. \`${p.id}\``
        ).join('\n\n').slice(0, 4000))
        .setFooter({ text: 'Les 10 annonces les plus récentes' });

      return interaction.reply({ embeds: [embed] });
    }
  },

  {
    data: new SlashCommandBuilder()
      .setName('giveaway')
      .setDescription('Gestion des concours')
      .addSubcommand(sub => sub
        .setName('creer')
        .setDescription('Créer un concours')
        .addStringOption(o => o.setName('lot').setDescription('Lot à gagner').setRequired(true))
        .addIntegerOption(o => o.setName('duree').setDescription('Durée en minutes').setMinValue(1).setMaxValue(10080).setRequired(true))
        .addIntegerOption(o => o.setName('gagnants').setDescription('Nombre de gagnants').setMinValue(1).setMaxValue(20).setRequired(true))
      )
      .addSubcommand(sub => sub
        .setName('terminer')
        .setDescription('Terminer un concours')
        .addStringOption(o => o.setName('message_id').setDescription('ID du message du concours').setRequired(true))
      )
      .addSubcommand(sub => sub
        .setName('reroll')
        .setDescription('Effectuer un nouveau tirage')
        .addStringOption(o => o.setName('message_id').setDescription('ID du message du concours').setRequired(true))
      )
      .addSubcommand(sub => sub
        .setName('liste')
        .setDescription('Voir les concours en cours')
      ),

    async execute(interaction, client) {
      const data = db.load();
      const sub = interaction.options.getSubcommand();

      if (sub === 'creer') {
        const prize = interaction.options.getString('lot');
        const duration = interaction.options.getInteger('duree');
        const winners = interaction.options.getInteger('gagnants');

        const embed = new EmbedBuilder()
          .setColor(0xF59E0B)
          .setTitle('🎁 NOUVEAU GIVEAWAY')
          .setDescription(`**Lot :** ${prize}\n\nClique sur le bouton pour participer !`)
          .addFields(
            { name: 'Gagnants', value: `${winners}`, inline: true },
            { name: 'Durée', value: `${duration} minutes`, inline: true },
            { name: 'Participants', value: '0', inline: true }
          )
          .setFooter({ text: 'MarketX Giveaway' });

        const button = new ButtonBuilder()
          .setCustomId('giveaway_join_pending')
          .setLabel('Participer')
          .setEmoji('🎉')
          .setStyle(ButtonStyle.Success);

        const message = await interaction.channel.send({
          embeds: [embed],
          components: [new ActionRowBuilder().addComponents(button)]
        });

        const entry = {
          guildId: interaction.guildId,
          channelId: interaction.channelId,
          messageId: message.id,
          prize,
          winners,
          creator: interaction.user.id,
          entrants: [],
          selected: [],
          endsAt: Date.now() + duration * 60000,
          ended: false
        };

        const updated = db.load();
        updated.giveaways[message.id] = entry;
        db.save(updated);

        const fixedButton = new ButtonBuilder()
          .setCustomId(`giveaway_join:${message.id}`)
          .setLabel('Participer')
          .setEmoji('🎉')
          .setStyle(ButtonStyle.Success);

        await message.edit({
          embeds: [embed],
          components: [new ActionRowBuilder().addComponents(fixedButton)]
        });

        client.scheduleGiveaway(message.id);
        return interaction.reply({ content: `✅ Concours créé ! Message : ${message.id}`, ephemeral: true });
      }

      if (sub === 'liste') {
        const active = Object.values(data.giveaways).filter(g =>
          g.guildId === interaction.guildId && !g.ended
        );

        return interaction.reply({
          content: active.length
            ? active.map(g => `🎁 **${g.prize}** — <#${g.channelId}> — ID : \`${g.messageId}\``).join('\n').slice(0, 1900)
            : 'Aucun concours en cours.',
          ephemeral: true
        });
      }

      const messageId = interaction.options.getString('message_id');
      const giveaway = data.giveaways[messageId];

      if (!giveaway || giveaway.guildId !== interaction.guildId) {
        return interaction.reply({ content: '❌ Concours introuvable.', ephemeral: true });
      }

      if (sub === 'terminer') {
        await client.finishGiveaway(messageId);
        return interaction.reply({ content: '✅ Tirage terminé.', ephemeral: true });
      }

      if (sub === 'reroll') {
        if (!giveaway.ended) {
          return interaction.reply({ content: '❌ Ce concours est encore en cours.', ephemeral: true });
        }

        const available = giveaway.entrants.filter(id => !giveaway.selected.includes(id));
        if (!available.length) {
          return interaction.reply({ content: '❌ Aucun autre participant disponible.', ephemeral: true });
        }

        const winner = available[Math.floor(Math.random() * available.length)];
        giveaway.selected.push(winner);
        db.save(data);

        return interaction.reply(`🎉 Nouveau gagnant : <@${winner}> pour **${giveaway.prize}** !`);
      }
    }
  },

  {
    data: new SlashCommandBuilder()
      .setName('admin')
      .setDescription('Administration MarketX')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(sub => sub
        .setName('stats')
        .setDescription('Afficher les statistiques du serveur')
      ),

    async execute(interaction) {
      const data = db.load();
      const shops = Object.values(data.shops).filter(s => s.guildId === interaction.guildId);
      const products = data.products.filter(p => p.guildId === interaction.guildId);
      const giveaways = Object.values(data.giveaways).filter(g => g.guildId === interaction.guildId);

      const embed = new EmbedBuilder()
        .setColor(0x8B5CF6)
        .setTitle('📊 Statistiques MarketX')
        .addFields(
          { name: 'Boutiques', value: `${shops.length}`, inline: true },
          { name: 'Annonces', value: `${products.length}`, inline: true },
          { name: 'Concours', value: `${giveaways.length}`, inline: true }
        );

      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  }
];

module.exports = commands;
