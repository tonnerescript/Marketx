const {
  SlashCommandBuilder,
  EmbedBuilder,
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  PermissionFlagsBits
} = require('discord.js');

const db = require('../database/database');

function isAdmin(interaction) {
  return interaction.memberPermissions?.has(
    PermissionFlagsBits.Administrator
  );
}

function getPromotions(data, guildId) {
  if (!Array.isArray(data.promotions[guildId])) {
    data.promotions[guildId] = [];
  }
  return data.promotions[guildId];
}

function getPricing(data, guildId, product) {
  const promotions = getPromotions(data, guildId);

  const promotion = promotions.find(p =>
    p.status === 'active' &&
    (p.targetType === 'all' ||
      (p.targetType === 'product' && p.productId === product.id))
  );

  const originalPrice = Number(product.price);
  const percent = promotion ? promotion.percent : 0;
  const finalPrice = Math.max(
    0,
    Math.round(originalPrice * (1 - percent / 100) * 100) / 100
  );

  return {
    originalPrice,
    finalPrice,
    percent,
    promotion
  };
}

function formatPrice(value) {
  return `${value.toFixed(2).replace('.', ',')} €`;
}

const commands = [
  {
    data: new SlashCommandBuilder()
      .setName('solde')
      .setDescription('Gérer les réductions MarketX')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(sub => sub
        .setName('appliquer')
        .setDescription('Créer une réduction en pourcentage')
        .addStringOption(o => o
          .setName('portee')
          .setDescription('Choisir où appliquer la réduction')
          .setRequired(true)
          .addChoices(
            { name: 'Toute la boutique', value: 'all' },
            { name: 'Un produit précis', value: 'product' }
          )
        )
        .addIntegerOption(o => o
          .setName('pourcentage')
          .setDescription('Pourcentage de réduction')
          .setMinValue(1)
          .setMaxValue(100)
          .setRequired(true)
        )
        .addStringOption(o => o
          .setName('produit_id')
          .setDescription('ID du produit (obligatoire si portée = produit)')
          .setRequired(false)
        )
      )
      .addSubcommand(sub => sub
        .setName('desactiver')
        .setDescription('Désactiver une réduction')
        .addStringOption(o => o
          .setName('portee')
          .setDescription('Quelle réduction désactiver ?')
          .setRequired(true)
          .addChoices(
            { name: 'Réduction de toute la boutique', value: 'all' },
            { name: 'Réduction d’un produit', value: 'product' }
          )
        )
        .addStringOption(o => o
          .setName('produit_id')
          .setDescription('ID du produit concerné')
          .setRequired(false)
        )
      ),

    async execute(interaction) {
      if (!isAdmin(interaction)) {
        return interaction.reply({
          content: '❌ Réservé aux administrateurs.',
          ephemeral: true
        });
      }

      const data = db.load();
      const promotions = getPromotions(data, interaction.guildId);
      const sub = interaction.options.getSubcommand();
      const scope = interaction.options.getString('portee');
      const productId = interaction.options.getString('produit_id');

      if (sub === 'desactiver') {
        if (scope === 'product' && !productId) {
          return interaction.reply({
            content: '❌ Indique l’identifiant du produit.',
            ephemeral: true
          });
        }

        const before = promotions.length;

        data.promotions[interaction.guildId] = promotions.filter(p =>
          !(p.status === 'active' &&
            (scope === 'all'
              ? p.targetType === 'all'
              : p.targetType === 'product' && p.productId === productId))
        );

        const removed = before - data.promotions[interaction.guildId].length;

        if (!removed) {
          return interaction.reply({
            content: '❌ Aucune promotion active correspondante.',
            ephemeral: true
          });
        }

        db.save(data);

        return interaction.reply({
          content: `✅ ${removed} promotion(s) désactivée(s).`,
          ephemeral: true
        });
      }

      const percent = interaction.options.getInteger('pourcentage');

      let product = null;

      if (scope === 'product') {
        if (!productId) {
          return interaction.reply({
            content: '❌ Indique l’identifiant du produit.',
            ephemeral: true
          });
        }

        product = data.products.find(p =>
          p.id === productId && p.guildId === interaction.guildId
        );

        if (!product) {
          return interaction.reply({
            content: '❌ Produit introuvable sur ce serveur.',
            ephemeral: true
          });
        }
      }

      const conflict = promotions.find(p =>
        p.status === 'active' &&
        (scope === 'all'
          ? true
          : p.targetType === 'all' ||
            (p.targetType === 'product' && p.productId === productId))
      );

      if (conflict) {
        return interaction.reply({
          content: '❌ Une promotion active concerne déjà cette portée. Désactive-la avant d’en créer une nouvelle.',
          ephemeral: true
        });
      }

      const id = `${Date.now()}-${interaction.user.id}`;

      const promotion = {
        id,
        guildId: interaction.guildId,
        targetType: scope,
        productId: scope === 'product' ? productId : null,
        productName: product ? product.name : null,
        percent,
        status: 'pending',
        createdBy: interaction.user.id,
        createdAt: Date.now(),
        expiresAt: Date.now() + 15 * 60 * 1000
      };

      promotions.push(promotion);
      db.save(data);

      const affected = scope === 'all'
        ? data.products.filter(p => p.guildId === interaction.guildId)
        : [product];

      const preview = affected
        .slice(0, 10)
        .map(p => {
          const oldPrice = Number(p.price);
          const newPrice = Math.max(
            0,
            Math.round(oldPrice * (1 - percent / 100) * 100) / 100
          );

          return `• **${p.name}** : ~~${formatPrice(oldPrice)}~~ → **${formatPrice(newPrice)}**`;
        });

      const embed = new EmbedBuilder()
        .setColor(0x8B5CF6)
        .setTitle('🏷️ Aperçu de la promotion')
        .setDescription(
          `**Réduction :** -${percent} %\n` +
          `**Portée :** ${scope === 'all' ? 'Toute la boutique' : product.name}\n\n` +
          (preview.length
            ? preview.join('\n')
            : 'Aucun produit enregistré pour le moment.')
        )
        .setFooter({
          text: 'La promotion ne sera activée qu’après confirmation. Expiration de cet aperçu : 15 minutes.'
        });

      if (affected.length > 10) {
        embed.addFields({
          name: 'Autres produits',
          value: `${affected.length - 10} autre(s) produit(s) concerné(s).`
        });
      }

      const row = new ActionRowBuilder().addComponents(
        new ButtonBuilder()
          .setCustomId(`marketx_promo_confirm:${id}`)
          .setLabel('Confirmer')
          .setEmoji('✅')
          .setStyle(ButtonStyle.Success),
        new ButtonBuilder()
          .setCustomId(`marketx_promo_cancel:${id}`)
          .setLabel('Annuler')
          .setEmoji('✖️')
          .setStyle(ButtonStyle.Danger)
      );

      return interaction.reply({
        content: 'Vérifie les prix avant d’activer la réduction.',
        embeds: [embed],
        components: [row],
        ephemeral: true
      });
    }
  }
];

async function handleButton(interaction) {
  const match = interaction.customId.match(
    /^marketx_promo_(confirm|cancel):(.+)$/
  );

  if (!match) return false;

  if (!isAdmin(interaction)) {
    await interaction.reply({
      content: '❌ Seuls les administrateurs peuvent confirmer ou annuler.',
      ephemeral: true
    });
    return true;
  }

  const [, action, id] = match;
  const data = db.load();
  const promotions = getPromotions(data, interaction.guildId);
  const promotion = promotions.find(p => p.id === id);

  if (!promotion || promotion.status !== 'pending') {
    await interaction.update({
      content: '❌ Cet aperçu est introuvable ou a déjà été traité.',
      embeds: [],
      components: []
    });
    return true;
  }

  if (Date.now() > promotion.expiresAt) {
    promotion.status = 'expired';
    db.save(data);

    await interaction.update({
      content: '⌛ Cet aperçu a expiré. Relance `/solde appliquer`.',
      embeds: [],
      components: []
    });
    return true;
  }

  if (action === 'cancel') {
    promotion.status = 'cancelled';
    promotion.cancelledAt = Date.now();
    db.save(data);

    await interaction.update({
      content: '✖️ Promotion annulée. Aucun prix n’a été modifié.',
      embeds: [],
      components: []
    });
    return true;
  }

  const conflict = promotions.find(p =>
    p.id !== promotion.id &&
    p.status === 'active' &&
    (promotion.targetType === 'all'
      ? true
      : p.targetType === 'all' ||
        (p.targetType === 'product' &&
          p.productId === promotion.productId))
  );

  if (conflict) {
    promotion.status = 'cancelled';
    db.save(data);

    await interaction.update({
      content: '❌ Une autre promotion a été activée entre-temps. Cet aperçu est annulé.',
      embeds: [],
      components: []
    });
    return true;
  }

  if (promotion.targetType === 'product') {
    const product = data.products.find(p =>
      p.id === promotion.productId &&
      p.guildId === interaction.guildId
    );

    if (!product) {
      promotion.status = 'cancelled';
      db.save(data);

      await interaction.update({
        content: '❌ Le produit n’existe plus. Promotion annulée.',
        embeds: [],
        components: []
      });
      return true;
    }
  }

  promotion.status = 'active';
  promotion.activatedAt = Date.now();
  promotion.activatedBy = interaction.user.id;
  db.save(data);

  await interaction.update({
    content: `✅ Promotion activée : **-${promotion.percent} %** ${
      promotion.targetType === 'all'
        ? 'sur toute la boutique'
        : `sur **${promotion.productName || 'le produit sélectionné'}**`
    }.`,
    embeds: [],
    components: []
  });

  return true;
}

module.exports = {
  commands,
  handleButton,
  getPricing
};
