// Charger les variables d'environnement
require('dotenv').config();

const { Client, GatewayIntentBits, Partials, EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');
const express = require('express');
const cors = require('cors');

// Importer les modules
const { handleCandidatureCommand, handleCandidatureInteraction } = require('./candidatures');
const { startSocialMonitor } = require('./social-monitor');
const { getMelonlyStats } = require('./melonly');

// Configuration
const CONFIG = {
  BOT_TOKEN: process.env.BOT_TOKEN,
  GUILD_ID: process.env.GUILD_ID || '1459362885724672014',
  UPDATE_INTERVAL: 10 * 60 * 1000,
  DATA_FILE: path.join(__dirname, 'server-data.json'),
  VOICE_CHANNEL_ID: '1525534997820473507',
  STATUS_CHANNEL_ID: '1525646824088670308',
  API_CHANNEL_ID: '1525646891969155184',
  STATUS_DATA_FILE: path.join(__dirname, 'status-messages.json'),
  STATUS_UPDATE_INTERVAL: 2 * 60 * 1000
};

if (!CONFIG.BOT_TOKEN) {
  console.error('❌ ERREUR: Le token du bot n\'est pas défini !');
  process.exit(1);
}

// Serveur Web Express
const app = express();
const PORT = process.env.PORT || 5000;

const allowedOrigins = [
  'https://jacobin904.github.io',
  'http://localhost:5500',
  'http://localhost:3000'
];

app.use(cors({
  origin: function(origin, callback) {
    if (!origin) return callback(null, true);
    if (allowedOrigins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(null, false);
    }
  }
}));

let apiRequestCount = 0;
let lastApiRequest = null;

app.get('/', (req, res) => {
  res.send('✅ Thetford Mines RP Bot is running!');
});

app.get('/api/data', (req, res) => {
  apiRequestCount++;
  lastApiRequest = new Date();
  try {
    const dataFile = path.join(__dirname, 'server-data.json');
    if (fs.existsSync(dataFile)) {
      const data = JSON.parse(fs.readFileSync(dataFile, 'utf8'));
      res.json(data);
    } else {
      res.status(404).json({ error: 'Aucune donnée disponible' });
    }
  } catch (error) {
    console.error('Erreur API:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.get('/api/candidatures', (req, res) => {
  apiRequestCount++;
  lastApiRequest = new Date();
  try {
    const candidaturesFile = path.join(__dirname, 'candidatures.json');
    if (fs.existsSync(candidaturesFile)) {
      const data = JSON.parse(fs.readFileSync(candidaturesFile, 'utf8'));
      res.json(data);
    } else {
      res.status(404).json({ error: 'Aucune candidature' });
    }
  } catch (error) {
    console.error('Erreur API candidatures:', error);
    res.status(500).json({ error: 'Erreur serveur' });
  }
});

app.listen(PORT, () => {
  console.log(`✅ Serveur API en ligne sur le port ${PORT}`);
  console.log(`🌐 URL publique: https://thetford-mines-rp.onrender.com`);
});

// Client Discord
const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildVoiceStates,
    GatewayIntentBits.MessageContent
  ],
  partials: [Partials.Channel, Partials.Message]
});

// Système de statut
let statusMessageId = null;
let apiMessageId = null;
let startTime = Date.now();
let lastDataCollection = null;
let nextUpdate = null;

function loadStatusMessages() {
  try {
    if (fs.existsSync(CONFIG.STATUS_DATA_FILE)) {
      const data = JSON.parse(fs.readFileSync(CONFIG.STATUS_DATA_FILE, 'utf8'));
      statusMessageId = data.statusMessageId;
      apiMessageId = data.apiMessageId;
    }
  } catch (e) {
    console.error('Erreur chargement status messages:', e);
  }
}

function saveStatusMessages() {
  fs.writeFileSync(CONFIG.STATUS_DATA_FILE, JSON.stringify({
    statusMessageId,
    apiMessageId
  }, null, 2), 'utf8');
}

function formatUptime(ms) {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  
  if (days > 0) return `${days}j ${hours % 24}h ${minutes % 60}m`;
  if (hours > 0) return `${hours}h ${minutes % 60}m`;
  return `${minutes}m ${seconds % 60}s`;
}

function formatFileSize(bytes) {
  if (bytes < 1024) return bytes + ' B';
  if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(2) + ' KB';
  return (bytes / (1024 * 1024)).toFixed(2) + ' MB';
}

function getMemoryUsage() {
  const mem = process.memoryUsage();
  return {
    heap: formatFileSize(mem.heapUsed),
    heapTotal: formatFileSize(mem.heapTotal)
  };
}

function createStatusEmbed() {
  const uptime = Date.now() - startTime;
  const memory = getMemoryUsage();
  const guild = client.guilds.cache.first();
  const ping = Math.round(client.ws.ping);
  
  let statusColor = 0x00FF00;
  let statusText = '🟢 En ligne';
  
  if (ping > 200) {
    statusColor = 0xFFA500;
    statusText = '🟡 Latence élevée';
  }
  
  const embed = new EmbedBuilder()
    .setTitle('🤖 Statut du Bot')
    .setColor(statusColor)
    .addFields(
      { name: '🟢 Statut', value: statusText, inline: true },
      { name: '⏱️ Uptime', value: formatUptime(uptime), inline: true },
      { name: '🏓 Latence', value: `${ping} ms`, inline: true },
      { name: '💾 Mémoire RAM', value: `${memory.heap} / ${memory.heapTotal}`, inline: true },
      { name: ' Serveur', value: guild?.name || 'N/A', inline: true },
      { name: '👥 Membres', value: guild?.memberCount?.toString() || '0', inline: true },
      { name: '📊 Dernière collecte', value: lastDataCollection ? `<t:${Math.floor(lastDataCollection.getTime() / 1000)}:R>` : 'Jamais', inline: true },
      { name: '🔄 Prochaine MAJ', value: nextUpdate ? `<t:${Math.floor(nextUpdate.getTime() / 1000)}:R>` : 'N/A', inline: true }
    )
    .setFooter({ text: 'Thetford Mines RP • Bot v1.0.0' })
    .setTimestamp();
  
  return embed;
}

function createApiEmbed() {
  const dataFile = path.join(__dirname, 'server-data.json');
  let dataSize = 'N/A';
  
  try {
    if (fs.existsSync(dataFile)) {
      const stats = fs.statSync(dataFile);
      dataSize = formatFileSize(stats.size);
    }
  } catch (e) {}
  
  const embed = new EmbedBuilder()
    .setTitle('🌐 Statut de l\'API')
    .setColor(0x00FF00)
    .addFields(
      { name: ' Statut API', value: '🟢 Opérationnelle', inline: true },
      { name: '🌍 URL', value: '[thetford-mines-rp.onrender.com](https://thetford-mines-rp.onrender.com)', inline: true },
      { name: '📈 Requêtes API', value: apiRequestCount.toString(), inline: true },
      { name: '📊 /api/data', value: '🟢 Actif', inline: true },
      { name: ' /api/candidatures', value: ' Actif', inline: true },
      { name: '💾 server-data.json', value: dataSize, inline: true },
      { name: ' Dernière requête', value: lastApiRequest ? `<t:${Math.floor(lastApiRequest.getTime() / 1000)}:R>` : 'Aucune', inline: true }
    )
    .setFooter({ text: 'Thetford Mines RP • API v1.0.0' })
    .setTimestamp();
  
  return embed;
}

async function updateStatusEmbed() {
  try {
    const channel = await client.channels.fetch(CONFIG.STATUS_CHANNEL_ID);
    if (!channel) return;
    
    const embed = createStatusEmbed();
    
    if (statusMessageId) {
      try {
        const message = await channel.messages.fetch(statusMessageId);
        await message.edit({ embeds: [embed] });
      } catch (e) {
        const newMessage = await channel.send({ embeds: [embed] });
        statusMessageId = newMessage.id;
        saveStatusMessages();
      }
    } else {
      const newMessage = await channel.send({ embeds: [embed] });
      statusMessageId = newMessage.id;
      saveStatusMessages();
    }
  } catch (error) {
    console.error('Erreur update status embed:', error);
  }
}

async function updateApiEmbed() {
  try {
    const channel = await client.channels.fetch(CONFIG.API_CHANNEL_ID);
    if (!channel) return;
    
    const embed = createApiEmbed();
    
    if (apiMessageId) {
      try {
        const message = await channel.messages.fetch(apiMessageId);
        await message.edit({ embeds: [embed] });
      } catch (e) {
        const newMessage = await channel.send({ embeds: [embed] });
        apiMessageId = newMessage.id;
        saveStatusMessages();
      }
    } else {
      const newMessage = await channel.send({ embeds: [embed] });
      apiMessageId = newMessage.id;
      saveStatusMessages();
    }
  } catch (error) {
    console.error('Erreur update API embed:', error);
  }
}

// Collecte de données
async function collectServerData() {
  try {
    console.log('🔄 Collecte des données du serveur...');
    
    const guild = await client.guilds.fetch(CONFIG.GUILD_ID);
    await guild.members.fetch();
    
    const serverInfo = {
      name: guild.name,
      id: guild.id,
      icon: guild.iconURL({ size: 1024, dynamic: true }),
      memberCount: guild.memberCount,
      createdAt: guild.createdAt.toISOString(),
      lastUpdated: new Date().toISOString()
    };

    const roles = guild.roles.cache
      .filter(role => role.name !== '@everyone')
      .map(role => ({
        id: role.id,
        name: role.name,
        color: role.hexColor,
        position: role.position,
        memberCount: role.members.size
      }))
      .sort((a, b) => b.position - a.position);

    const channels = guild.channels.cache.map(channel => ({
      id: channel.id,
      name: channel.name,
      type: channel.type,
      parentId: channel.parentId
    }));

    const members = guild.members.cache.map(member => ({
      id: member.id,
      username: member.user.username,
      displayName: member.displayName,
      joinedAt: member.joinedAt.toISOString(),
      roles: member.roles.cache
        .filter(role => role.name !== '@everyone')
        .map(role => ({ id: role.id, name: role.name }))
    }));

    const serverData = {
      serverInfo,
      roles,
      channels,
      members,
      metadata: {
        totalRoles: roles.length,
        totalChannels: channels.length,
        totalMembers: members.length,
        lastUpdated: new Date().toISOString()
      }
    };

    fs.writeFileSync(
      CONFIG.DATA_FILE,
      JSON.stringify(serverData, null, 2),
      'utf8'
    );

    console.log('✅ Données collectées avec succès !');
    lastDataCollection = new Date();
    nextUpdate = new Date(Date.now() + CONFIG.UPDATE_INTERVAL);

    return serverData;

  } catch (error) {
    console.error('❌ Erreur lors de la collecte des données:', error);
    throw error;
  }
}

// Rejoindre le salon vocal
async function joinVoiceChannel() {
  try {
    const { joinVoiceChannel } = require('@discordjs/voice');
    
    const voiceChannel = await client.channels.fetch(CONFIG.VOICE_CHANNEL_ID);
    
    if (!voiceChannel || voiceChannel.type !== 2) {
      console.warn('⚠️  Salon vocal non trouvé ou invalide');
      return;
    }

    const connection = joinVoiceChannel({
      channelId: voiceChannel.id,
      guildId: voiceChannel.guild.id,
      adapterCreator: voiceChannel.guild.voiceAdapterCreator,
      selfDeaf: false,
      selfMute: false
    });

    connection.on('stateChange', (oldState, newState) => {
      console.log('🎤 État de la connexion vocale:', newState.status);
    });

    console.log(`✅ Bot connecté au salon vocal: ${voiceChannel.name}`);

  } catch (error) {
    console.error('❌ Erreur lors de la connexion au salon vocal:', error);
  }
}

// Événements du bot
client.once('ready', async () => {
  console.log('═'.repeat(60));
  console.log(`✅ Bot connecté: ${client.user.tag}`);
  console.log(`📡 ID: ${client.user.id}`);
  console.log(`🏠 Serveur: ${client.guilds.cache.first()?.name}`);
  console.log('═'.repeat(60));

  await joinVoiceChannel();
  await collectServerData();

  // Tracker de statut
  loadStatusMessages();
  await updateStatusEmbed();
  await updateApiEmbed();
  setInterval(async () => {
    await updateStatusEmbed();
    await updateApiEmbed();
  }, CONFIG.STATUS_UPDATE_INTERVAL);
  console.log('✅ Status tracker démarré (mise à jour toutes les 2 min)');

  // Moniteur social
  try {
    await startSocialMonitor(client);
    console.log('✅ Moniteur social démarré');
  } catch (error) {
    console.error('❌ Erreur démarrage moniteur social:', error);
  }

  // Mise à jour automatique
  console.log(`⏰ Mise à jour automatique toutes les ${CONFIG.UPDATE_INTERVAL / 1000 / 60} minutes`);
  setInterval(async () => {
    try {
      await collectServerData();
    } catch (error) {
      console.error('❌ Erreur lors de la mise à jour automatique:', error);
    }
  }, CONFIG.UPDATE_INTERVAL);
});

// Gestion des messages
client.on('messageCreate', async (message) => {
  if (message.author.bot) return;
  
  if (message.content === '!update') {
    try {
      const msg = await message.reply('🔄 Mise à jour des données en cours...');
      await collectServerData();
      await msg.edit('✅ Données mises à jour avec succès !');
    } catch (error) {
      await message.reply('❌ Erreur: ' + error.message);
    }
    return;
  }
  
  if (message.content === '!stats') {
    try {
      if (fs.existsSync(CONFIG.DATA_FILE)) {
        const data = JSON.parse(fs.readFileSync(CONFIG.DATA_FILE, 'utf8'));
        const embed = {
          color: 0xFFD700,
          title: '📊 Statistiques du Serveur',
          fields: [
            { name: '👥 Membres', value: data.metadata.totalMembers.toString(), inline: true },
            { name: '📁 Salons', value: data.metadata.totalChannels.toString(), inline: true },
            { name: '🎭 Rôles', value: data.metadata.totalRoles.toString(), inline: true },
            { name: '🕐 Dernière MAJ', value: new Date(data.metadata.lastUpdated).toLocaleString('fr-CA') }
          ],
          timestamp: new Date().toISOString()
        };
        await message.reply({ embeds: [embed] });
      } else {
        await message.reply('❌ Aucune donnée disponible.');
      }
    } catch (error) {
      await message.reply('❌ Erreur: ' + error.message);
    }
    return;
  }
  
  if (message.content.startsWith('!candidature')) {
    try {
      await handleCandidatureCommand(message);
    } catch (error) {
      console.error('Erreur commande candidature:', error);
      await message.reply('❌ Erreur lors de la commande: ' + error.message);
    }
    return;
  }

  if (message.content === '!melonly' || message.content === '!stats-melonly') {
    try {
      const msg = await message.reply('🔄 Récupération des données Melonly en cours...');
      
      const melonlyData = await getMelonlyStats();
      
      if (!melonlyData) {
        return msg.edit('❌ Impossible de récupérer les données Melonly. Vérifie que le token est configuré.');
      }

      const embed = new EmbedBuilder()
        .setTitle('📊 Statistiques Melonly - Thetford Mines RP')
        .setDescription('Données en temps réel provenant du tableau de bord Melonly.')
        .setColor(0x5865F2)
        .addFields(
          { name: '📦 Données', value: '```json\n' + JSON.stringify(melonlyData, null, 2).substring(0, 1000) + '\n```' }
        )
        .setFooter({ text: 'Propulsé par Melonly.xyz' })
        .setTimestamp();

      await msg.edit({ content: null, embeds: [embed] });

    } catch (error) {
      console.error('Erreur commande melonly:', error);
      await message.reply('❌ Une erreur est survenue.');
    }
    return;
  }
});

// Gestion des interactions
client.on('interactionCreate', async (interaction) => {
  try {
    await handleCandidatureInteraction(interaction);
  } catch (error) {
    console.error('❌ Erreur interaction:', error);
    
    if (!interaction.replied && !interaction.deferred) {
      try {
        await interaction.reply({ 
          content: '❌ Une erreur est survenue.', 
          ephemeral: true 
        });
      } catch (e) {}
    }
  }
});

// Gestion des erreurs
client.on('error', (error) => {
  console.error('❌ Erreur Discord:', error);
});

client.on('disconnect', () => {
  console.warn('️  Bot déconnecté de Discord');
});

client.on('reconnecting', () => {
  console.log('🔄 Tentative de reconnexion...');
});

// Connexion
client.login(CONFIG.BOT_TOKEN)
  .catch(error => {
    console.error('❌ Échec de la connexion:', error);
    process.exit(1);
  });
