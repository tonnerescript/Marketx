const {
  SlashCommandBuilder,
  EmbedBuilder,
  PermissionFlagsBits
} = require('discord.js');
const db = require('../database/database');

function guildData(guildId) {
  const data = db.load();
  data.categories ||= {};
  data.coupons ||= {};
  data.loyalty ||= {};
  data.vendors ||= {};
  data.storeSettings ||= {};
  data.orderHistory ||= {};
  data.categories[guildId] ||= [];
  data.coupons[guildId] ||= [];
  data.loyalty[guildId] ||= { pointsPerEuro: 1, members: {} };
  data.loyalty[guildId].members ||= {};
  data.vendors[guildId] ||= { users: [], roles: [] };
  data.vendors[guildId].users ||= [];
  data.vendors[guildId].roles ||= [];
  return data;
}

function admin(interaction) {
  return interaction.memberPermissions?.has(PermissionFlagsBits.Administrator);
}

function money(value) {
  return `${Number(value || 0).toFixed(2).replace('.', ',')} €`;
}

const commands = [
  {
    data: new SlashCommandBuilder()
      .setName('marketx-panel')
      .setDescription('Ouvrir le centre de gestion MarketX')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      const data = guildData(interaction.guildId);
      const products = data.products.filter(p => p.guildId === interaction.guildId);
      const orders = Object.values(data.orders).filter(o => o.guildId === interaction.guildId);
      const active = orders.filter(o => o.status === 'pending').length;
      const vendors = data.vendors[interaction.guildId];
      const embed = new EmbedBuilder()
        .setColor(data.storeSettings[interaction.guildId]?.color || 0x8B5CF6)
        .setTitle('✦ MARKETX — CENTRE DE GESTION')
        .setDescription('Toutes les commandes d’administration de ta boutique sont regroupées ci-dessous.')
        .addFields(
          { name: '🛍️ Catalogue', value: `**${products.length}** produit(s)\n\`/produit\` · \`/categorie\``, inline: true },
          { name: '🎫 Commandes', value: `**${active}** en attente\n\`/commandes\` · \`/historique-achats\``, inline: true },
          { name: '👥 Vendeurs', value: `**${vendors.users.length + vendors.roles.length}** entrée(s)\n\`/vendeurs\``, inline: true },
          { name: '🎟️ Promotions', value: `\`/codepromo\` · \`/solde\``, inline: true },
          { name: '⭐ Fidélité', value: '\`/fidelite\`', inline: true },
          { name: '📊 Analyse', value: '\`/marketx-stats\`', inline: true },
          { name: '🎨 Personnalisation', value: '\`/boutique-config\`', inline: true }
        )
        .setFooter({ text: `MarketX • Serveur ${interaction.guild.name}` })
        .setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('categorie')
      .setDescription('Gérer les catégories de produits')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(s => s.setName('ajouter').setDescription('Créer une catégorie').addStringOption(o => o.setName('nom').setDescription('Nom de la catégorie').setMaxLength(60).setRequired(true)))
      .addSubcommand(s => s.setName('supprimer').setDescription('Supprimer une catégorie').addStringOption(o => o.setName('nom').setDescription('Nom exact').setRequired(true)))
      .addSubcommand(s => s.setName('liste').setDescription('Afficher les catégories')),
    async execute(interaction) {
      if (!admin(interaction)) return interaction.reply({ content: '❌ Réservé aux administrateurs.', ephemeral: true });
      const data = guildData(interaction.guildId);
      const list = data.categories[interaction.guildId];
      const sub = interaction.options.getSubcommand();
      if (sub === 'ajouter') {
        const name = interaction.options.getString('nom', true).trim();
        if (!name) return interaction.reply({ content: '❌ Nom invalide.', ephemeral: true });
        if (list.some(x => x.toLowerCase() === name.toLowerCase())) return interaction.reply({ content: '❌ Cette catégorie existe déjà.', ephemeral: true });
        list.push(name); db.save(data);
        return interaction.reply({ content: `✅ Catégorie **${name}** créée.`, ephemeral: true });
      }
      if (sub === 'supprimer') {
        const name = interaction.options.getString('nom', true);
        const index = list.findIndex(x => x.toLowerCase() === name.toLowerCase());
        if (index < 0) return interaction.reply({ content: '❌ Catégorie introuvable.', ephemeral: true });
        list.splice(index, 1);
        for (const product of data.products) if (product.guildId === interaction.guildId && product.category === name) product.category = null;
        db.save(data);
        return interaction.reply({ content: `✅ Catégorie **${name}** supprimée. Les produits concernés restent disponibles sans catégorie.`, ephemeral: true });
      }
      return interaction.reply({ content: list.length ? `📂 **Catégories**\n${list.map(x => `• ${x}`).join('\n')}` : '📭 Aucune catégorie créée.', ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('codepromo')
      .setDescription('Gérer les codes promotionnels personnalisés')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(s => s.setName('creer').setDescription('Créer un code promo').addStringOption(o => o.setName('code').setDescription('Code à saisir par le client').setMaxLength(24).setRequired(true)).addIntegerOption(o => o.setName('pourcentage').setDescription('Réduction en %').setMinValue(1).setMaxValue(90).setRequired(true)).addIntegerOption(o => o.setName('utilisations').setDescription('Nombre maximum d’utilisations').setMinValue(1).setMaxValue(100000).setRequired(true)).addStringOption(o => o.setName('produit_id').setDescription('Limiter à un produit (facultatif)').setRequired(false)))
      .addSubcommand(s => s.setName('liste').setDescription('Lister les codes promo'))
      .addSubcommand(s => s.setName('supprimer').setDescription('Supprimer un code promo').addStringOption(o => o.setName('code').setDescription('Code à supprimer').setRequired(true))),
    async execute(interaction) {
      if (!admin(interaction)) return interaction.reply({ content: '❌ Réservé aux administrateurs.', ephemeral: true });
      const data = guildData(interaction.guildId); const list = data.coupons[interaction.guildId];
      const sub = interaction.options.getSubcommand();
      if (sub === 'creer') {
        const code = interaction.options.getString('code', true).trim().toUpperCase().replace(/[^A-Z0-9_-]/g, '');
        const percent = interaction.options.getInteger('pourcentage', true);
        const maxUses = interaction.options.getInteger('utilisations', true);
        const productId = interaction.options.getString('produit_id');
        if (code.length < 3) return interaction.reply({ content: '❌ Le code doit contenir au moins 3 caractères (A-Z, 0-9, _ ou -).', ephemeral: true });
        if (list.some(c => c.code === code)) return interaction.reply({ content: '❌ Ce code existe déjà.', ephemeral: true });
        if (productId && !data.products.some(p => p.guildId === interaction.guildId && p.id === productId)) return interaction.reply({ content: '❌ Produit introuvable sur ce serveur.', ephemeral: true });
        list.push({ code, percent, maxUses, uses: 0, productId: productId || null, createdBy: interaction.user.id, createdAt: Date.now(), status: 'active' });
        db.save(data);
        return interaction.reply({ content: `✅ Code **${code}** créé : -${percent} %, ${maxUses} utilisation(s)${productId ? `, produit \`${productId}\`` : ', toute la boutique'}.`, ephemeral: true });
      }
      if (sub === 'supprimer') {
        const code = interaction.options.getString('code', true).trim().toUpperCase();
        const before = list.length; data.coupons[interaction.guildId] = list.filter(c => c.code !== code);
        if (before === data.coupons[interaction.guildId].length) return interaction.reply({ content: '❌ Code introuvable.', ephemeral: true });
        db.save(data); return interaction.reply({ content: `✅ Code **${code}** supprimé.`, ephemeral: true });
      }
      return interaction.reply({ content: list.length ? list.map(c => `• **${c.code}** : -${c.percent}% — ${c.uses}/${c.maxUses} utilisation(s)${c.productId ? ` — produit ${c.productId}` : ''}`).join('\n') : '📭 Aucun code promo.', ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('vendeurs')
      .setDescription('Gérer les vendeurs et leurs rôles')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(s => s.setName('ajouter').setDescription('Autoriser un vendeur').addUserOption(o => o.setName('membre').setDescription('Membre vendeur').setRequired(true)))
      .addSubcommand(s => s.setName('retirer').setDescription('Retirer un vendeur').addUserOption(o => o.setName('membre').setDescription('Membre vendeur').setRequired(true)))
      .addSubcommand(s => s.setName('role-ajouter').setDescription('Autoriser un rôle vendeur').addRoleOption(o => o.setName('role').setDescription('Rôle vendeur').setRequired(true)))
      .addSubcommand(s => s.setName('role-retirer').setDescription('Retirer un rôle vendeur').addRoleOption(o => o.setName('role').setDescription('Rôle vendeur').setRequired(true)))
      .addSubcommand(s => s.setName('liste').setDescription('Afficher les vendeurs autorisés')),
    async execute(interaction) {
      if (!admin(interaction)) return interaction.reply({ content: '❌ Réservé aux administrateurs.', ephemeral: true });
      const data = guildData(interaction.guildId); const cfg = data.vendors[interaction.guildId]; const sub = interaction.options.getSubcommand();
      if (sub === 'ajouter' || sub === 'retirer') {
        const user = interaction.options.getUser('membre', true); const has = cfg.users.includes(user.id);
        if (sub === 'ajouter' && !has) cfg.users.push(user.id);
        if (sub === 'retirer' && has) cfg.users = cfg.users.filter(id => id !== user.id);
        db.save(data); return interaction.reply({ content: sub === 'ajouter' ? `✅ <@${user.id}> est vendeur.` : `✅ <@${user.id}> n’est plus vendeur.`, ephemeral: true });
      }
      if (sub === 'role-ajouter' || sub === 'role-retirer') {
        const role = interaction.options.getRole('role', true); const has = cfg.roles.includes(role.id);
        if (sub === 'role-ajouter' && !has) cfg.roles.push(role.id);
        if (sub === 'role-retirer' && has) cfg.roles = cfg.roles.filter(id => id !== role.id);
        db.save(data); return interaction.reply({ content: sub === 'role-ajouter' ? `✅ Le rôle ${role} est vendeur.` : `✅ Le rôle ${role} a été retiré.`, ephemeral: true });
      }
      return interaction.reply({ content: `**Vendeurs :** ${cfg.users.length ? cfg.users.map(id => `<@${id}>`).join(', ') : 'Aucun'}\n**Rôles :** ${cfg.roles.length ? cfg.roles.map(id => `<@&${id}>`).join(', ') : 'Aucun'}`, ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('codepromo-appliquer')
      .setDescription('Appliquer un code promo dans une commande ouverte')
      .addStringOption(o => o.setName('code').setDescription('Code promotionnel').setRequired(true)),
    async execute(interaction) {
      const data = guildData(interaction.guildId); const order = data.orders[interaction.channelId];
      if (!order || order.guildId !== interaction.guildId || order.status !== 'pending') return interaction.reply({ content: '❌ Cette commande doit être utilisée dans un ticket de commande en attente.', ephemeral: true });
      if (order.clientId !== interaction.user.id) return interaction.reply({ content: '❌ Seul le client de cette commande peut appliquer son code.', ephemeral: true });
      if (order.couponCode) return interaction.reply({ content: '❌ Un code promo est déjà appliqué à cette commande.', ephemeral: true });
      const code = interaction.options.getString('code', true).trim().toUpperCase();
      const coupon = data.coupons[interaction.guildId].find(c => c.code === code && c.status === 'active');
      if (!coupon || coupon.uses >= coupon.maxUses) return interaction.reply({ content: '❌ Code invalide, désactivé ou épuisé.', ephemeral: true });
      if (coupon.userId && coupon.userId !== interaction.user.id) return interaction.reply({ content: '❌ Ce code est réservé à un autre membre.', ephemeral: true });
      if (coupon.productId && coupon.productId !== order.productId) return interaction.reply({ content: '❌ Ce code ne concerne pas ce produit.', ephemeral: true });
      const base = Number(order.price);
      const discount = Math.round(base * coupon.percent) / 100;
      order.beforeCouponPrice = base; order.price = Math.max(0, Math.round((base - discount) * 100) / 100);
      order.couponCode = coupon.code; order.couponPercent = coupon.percent; order.couponAppliedAt = Date.now();
      const ticket = data.tickets[interaction.channelId]; if (ticket) { ticket.price = order.price; ticket.couponCode = coupon.code; }
      db.save(data);
      return interaction.reply({ content: `✅ Code **${coupon.code}** appliqué : -${coupon.percent} %.\nPrix précédent : ${money(base)}\nNouveau prix : **${money(order.price)}**`, ephemeral: false });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('fidelite')
      .setDescription('Programme de fidélité MarketX')
      .addSubcommand(s => s.setName('solde').setDescription('Consulter les points').addUserOption(o => o.setName('membre').setDescription('Membre à consulter').setRequired(false)))
      .addSubcommand(s => s.setName('configurer').setDescription('Définir les points gagnés par euro').addIntegerOption(o => o.setName('points_par_euro').setDescription('Points par euro dépensé').setMinValue(0).setMaxValue(100).setRequired(true)))
      .addSubcommand(s => s.setName('convertir').setDescription('Convertir des points en code promo').addIntegerOption(o => o.setName('points').setDescription('Nombre de points (multiple de 100)').setMinValue(100).setRequired(true))),
    async execute(interaction) {
      const data = guildData(interaction.guildId); const cfg = data.loyalty[interaction.guildId]; const sub = interaction.options.getSubcommand();
      if (sub === 'configurer') {
        if (!admin(interaction)) return interaction.reply({ content: '❌ Réservé aux administrateurs.', ephemeral: true });
        cfg.pointsPerEuro = interaction.options.getInteger('points_par_euro', true); db.save(data);
        return interaction.reply({ content: `✅ Programme configuré : ${cfg.pointsPerEuro} point(s) par euro dépensé.`, ephemeral: true });
      }
      if (sub === 'solde') {
        const user = interaction.options.getUser('membre') || interaction.user;
        if (user.id !== interaction.user.id && !admin(interaction)) return interaction.reply({ content: '❌ Tu peux uniquement consulter ton propre solde.', ephemeral: true });
        const member = cfg.members[user.id] || { points: 0 };
        return interaction.reply({ content: `⭐ **MarketX Rewards**\nMembre : <@${user.id}>\nSolde : **${member.points || 0} points**`, ephemeral: true });
      }
      const points = interaction.options.getInteger('points', true);
      if (points % 100 !== 0) return interaction.reply({ content: '❌ Le nombre de points doit être un multiple de 100.', ephemeral: true });
      const member = cfg.members[interaction.user.id] || { points: 0, history: [] };
      if (member.points < points) return interaction.reply({ content: `❌ Il te manque ${points - member.points} points.`, ephemeral: true });
      member.points -= points; member.history ||= []; member.history.push({ type: 'redeem', points: -points, at: Date.now() });
      const percent = Math.min(50, (points / 100) * 5);
      const code = `FIDELITE-${interaction.user.id.slice(-5)}-${Date.now().toString(36).toUpperCase()}`;
      data.coupons[interaction.guildId].push({ code, percent, maxUses: 1, uses: 0, productId: null, userId: interaction.user.id, createdAt: Date.now(), status: 'active', source: 'loyalty' });
      cfg.members[interaction.user.id] = member; db.save(data);
      return interaction.reply({ content: `🎉 Tu as échangé **${points} points** contre un code personnel **${code}** (-${percent} %). Utilise \`/codepromo-appliquer\` dans ton prochain ticket.`, ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('historique-achats')
      .setDescription('Consulter l’historique des achats d’un membre')
      .addUserOption(o => o.setName('membre').setDescription('Membre concerné').setRequired(false)),
    async execute(interaction) {
      const user = interaction.options.getUser('membre') || interaction.user;
      if (user.id !== interaction.user.id && !admin(interaction)) return interaction.reply({ content: '❌ Seuls les administrateurs peuvent consulter l’historique d’un autre membre.', ephemeral: true });
      const data = guildData(interaction.guildId);
      const entries = (data.orderHistory[interaction.guildId] || []).filter(o => o.clientId === user.id).slice(-10).reverse();
      if (!entries.length) return interaction.reply({ content: `📭 Aucun achat enregistré pour <@${user.id}>.`, ephemeral: true });
      const embed = new EmbedBuilder().setColor(0x8B5CF6).setTitle(`🧾 Achats de ${user.username}`).setDescription(entries.map(o => `**${o.productName || 'Produit'}** — ${money(o.price)}\nStatut : ${o.status || 'inconnu'} • ${new Date(o.completedAt || o.createdAt || Date.now()).toLocaleDateString('fr-FR')}`).join('\n\n').slice(0, 3900)).setFooter({ text: '10 derniers achats enregistrés' });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('commandes')
      .setDescription('Consulter les commandes de la boutique')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addSubcommand(s => s.setName('en-attente').setDescription('Voir les commandes en attente'))
      .addSubcommand(s => s.setName('historique').setDescription('Voir les dernières commandes traitées')),
    async execute(interaction) {
      if (!admin(interaction)) return interaction.reply({ content: '❌ Réservé aux administrateurs.', ephemeral: true });
      const data = guildData(interaction.guildId);
      const sub = interaction.options.getSubcommand();
      const all = Object.values(data.orders).filter(o => o.guildId === interaction.guildId);
      const entries = (sub === 'en-attente' ? all.filter(o => o.status === 'pending') : all.filter(o => o.status !== 'pending')).sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0)).slice(0, 10);
      if (!entries.length) return interaction.reply({ content: '📭 Aucune commande dans cette catégorie.', ephemeral: true });
      const embed = new EmbedBuilder().setColor(0x8B5CF6).setTitle(sub === 'en-attente' ? '🎫 Commandes en attente' : '📚 Historique des commandes').setDescription(entries.map(o => `**${o.productName || 'Produit'}** — ${money(o.price)}
Client : <@${o.clientId}> • Statut : **${o.status}**
Ticket : ${o.channelId ? `<#${o.channelId}>` : 'Salon supprimé'}`).join('\n\n').slice(0, 3900)).setFooter({ text: '10 commandes maximum affichées' });
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('commande-prendre')
      .setDescription('Prendre en charge la commande de ce ticket'),
    async execute(interaction) {
      const data = guildData(interaction.guildId);
      const order = data.orders[interaction.channelId];
      if (!order || order.guildId !== interaction.guildId || order.status !== 'pending') return interaction.reply({ content: '❌ Aucune commande en attente dans ce salon.', ephemeral: true });
      const vendor = data.vendors[interaction.guildId];
      const roles = data.ticketRoles[interaction.guildId] || [];
      const allowed = admin(interaction) || vendor.users.includes(interaction.user.id) || interaction.member.roles.cache.some(r => roles.includes(r.id) || vendor.roles.includes(r.id));
      if (!allowed) return interaction.reply({ content: '❌ Tu ne possèdes pas les autorisations vendeur.', ephemeral: true });
      if (order.sellerId && order.sellerId !== interaction.user.id) return interaction.reply({ content: `❌ Cette commande est déjà prise par <@${order.sellerId}>.`, ephemeral: true });
      order.sellerId = interaction.user.id; order.assignedAt = Date.now();
      const ticket = data.tickets[interaction.channelId]; if (ticket) ticket.sellerId = interaction.user.id;
      db.save(data);
      await interaction.channel.send(`👤 Commande prise en charge par <@${interaction.user.id}>.`);
      return interaction.reply({ content: '✅ Tu es maintenant responsable de cette commande.', ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('marketx-stats')
      .setDescription('Afficher les statistiques de la boutique')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator),
    async execute(interaction) {
      const data = guildData(interaction.guildId);
      const products = data.products.filter(p => p.guildId === interaction.guildId);
      const orders = Object.values(data.orders).filter(o => o.guildId === interaction.guildId);
      const completed = orders.filter(o => o.status === 'completed');
      const revenue = completed.reduce((sum, o) => sum + Number(o.price || 0), 0);
      const pending = orders.filter(o => o.status === 'pending').length;
      const embed = new EmbedBuilder().setColor(0x8B5CF6).setTitle('📊 Statistiques MarketX').addFields(
        { name: 'Produits', value: `${products.length}`, inline: true },
        { name: 'Commandes totales', value: `${orders.length}`, inline: true },
        { name: 'En attente', value: `${pending}`, inline: true },
        { name: 'Commandes validées', value: `${completed.length}`, inline: true },
        { name: 'Chiffre d’affaires validé', value: money(revenue), inline: true },
        { name: 'Codes promo', value: `${data.coupons[interaction.guildId].length}`, inline: true }
      ).setTimestamp();
      return interaction.reply({ embeds: [embed], ephemeral: true });
    }
  },
  {
    data: new SlashCommandBuilder()
      .setName('boutique-config')
      .setDescription('Personnaliser l’apparence de la boutique')
      .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
      .addStringOption(o => o.setName('nom').setDescription('Nom affiché').setMaxLength(80).setRequired(false))
      .addStringOption(o => o.setName('description').setDescription('Description affichée').setMaxLength(1000).setRequired(false))
      .addStringOption(o => o.setName('couleur').setDescription('Couleur hexadécimale, ex. #8B5CF6').setRequired(false))
      .addStringOption(o => o.setName('footer').setDescription('Texte du pied de page').setMaxLength(100).setRequired(false)),
    async execute(interaction) {
      if (!admin(interaction)) return interaction.reply({ content: '❌ Réservé aux administrateurs.', ephemeral: true });
      const data = guildData(interaction.guildId);
      data.storeSettings[interaction.guildId] ||= { name: 'MarketX Store', description: 'Bienvenue dans notre boutique !', color: '#8B5CF6', footer: 'MarketX Store' };
      const cfg = data.storeSettings[interaction.guildId];
      const name = interaction.options.getString('nom'); const description = interaction.options.getString('description'); const color = interaction.options.getString('couleur'); const footer = interaction.options.getString('footer');
      if (![name, description, color, footer].some(v => v !== null)) return interaction.reply({ content: `**Configuration actuelle**\nNom : ${cfg.name}\nDescription : ${cfg.description}\nCouleur : ${cfg.color}\nPied de page : ${cfg.footer}`, ephemeral: true });
      if (color && !/^#[0-9A-Fa-f]{6}$/.test(color)) return interaction.reply({ content: '❌ Couleur invalide. Utilise le format #8B5CF6.', ephemeral: true });
      if (name !== null) cfg.name = name; if (description !== null) cfg.description = description; if (color !== null) cfg.color = color; if (footer !== null) cfg.footer = footer;
      db.save(data); return interaction.reply({ content: '✅ Apparence de la boutique mise à jour.', ephemeral: true });
    }
  }
];

module.exports = { commands };
