require("dotenv").config();

const { REST, Routes } = require("discord.js");
const commands = require("./commands");

async function deploy() {
    if (!process.env.DISCORD_TOKEN || !process.env.CLIENT_ID) {
        console.error("❌ DISCORD_TOKEN ou CLIENT_ID manquant dans .env");
        process.exit(1);
    }

    if (!Array.isArray(commands)) {
        console.error("❌ commands.js ne retourne pas un tableau.");
        process.exit(1);
    }

    const body = commands.map((command, index) => {
        if (!command.data || typeof command.data.toJSON !== "function") {
            throw new Error(`Commande invalide à l'index ${index}`);
        }

        return command.data.toJSON();
    });

    const rest = new REST({ version: "10" })
        .setToken(process.env.DISCORD_TOKEN);

    try {
        console.log("⏳ Déploiement global des commandes...");

        await rest.put(
            Routes.applicationCommands(process.env.CLIENT_ID),
            { body }
        );

        console.log(`✅ ${body.length} commandes déployées !`);
        console.log("🌍 MarketX est prêt pour le multi-serveurs.");
        console.log("🛒 Marketplace + 🎁 Giveaway");
    } catch (error) {
        console.error("❌ Erreur :", error);
        process.exitCode = 1;
    }
}

deploy();
