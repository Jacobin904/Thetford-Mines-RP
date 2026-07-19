const { 
  EmbedBuilder, 
  ActionRowBuilder, 
  ButtonBuilder, 
  ButtonStyle, 
  ModalBuilder, 
  TextInputBuilder, 
  TextInputStyle,
  PermissionFlagsBits
} = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  CANDIDATURES_CHANNEL: '1459623557842731100',
  RESULTS_CHANNEL: '1459618170913554674',
  DATA_FILE: path.join(__dirname, 'candidatures.json')
};

function loadCandidatures() {
  try {
    if (fs.existsSync(CONFIG.DATA_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG.DATA_FILE, 'utf8'));
    }
  } catch (e) {}
  return {};
}

function saveCandidatures(data) {
  fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify(data, null, 2), 'utf8');
}

const COLORS = {
  'SQ': 0x2C4A6E,
  'EMS': 0xC94040,
  'Pompiers': 0xD97736,
  'MTQ': 0xC9A961,
  'Justice': 0x8E6BB5,
  'Citoyen': 0x2ECC71,
  'Modérateur': 0x1ABC9C,
  'Admin': 0x2980B9,
  'Développeur': 0x9B59B6
};

async function sendCandidatureInfo(message, type) {
  const isStaff = type === 'staff';
  
  const restrictions = isStaff ? [
    '• Avoir au moins 16 ans IRL',
    '• Être membre depuis minimum 2 semaines',
    '• Avoir un micro fonctionnel',
    '• Être actif régulièrement sur le serveur',
    '• Aucune sanction grave dans les 30 derniers jours'
  ] : [
    '• Avoir au moins 14 ans IRL',
    '• Être membre depuis minimum 1 semaine',
    '• Avoir un micro fonctionnel',
    '• Connaître le règlement du serveur',
    '• Aucune sanction dans les 14 derniers jours'
  ];

  const embed = new EmbedBuilder()
    .setTitle(`📋 Candidature ${isStaff ? 'Staff' : 'Département'}`)
    .setDescription(isStaff 
      ? '**Rejoins l\'équipe qui fait vivre Thetford Mines RP !**'
      : '**Rejoins l\'un de nos départements officiels !**')
    .setColor(isStaff ? 0xFFD700 : 0x3498DB)
    .addFields(
      { name: ' Restrictions', value: restrictions.join('\n'), inline: false },
      { name: '⚠️ Important', value: '• Réponds honnêtement à toutes les questions\n• Les fausses informations = refus automatique\n• Une seule candidature par mois', inline: false }
    )
    .setFooter({ text: 'Thetford Mines RP - Système de candidatures' })
    .setTimestamp();

  const button = new ButtonBuilder()
    .setCustomId(`candidature_start_${type}_${message.author.id}`)
    .setLabel('📝 Commencer ma candidature')
    .setStyle(ButtonStyle.Primary);

  const row = new ActionRowBuilder().addComponents(button);

  await message.reply({ embeds: [embed], components: [row] });
}

async function handleCandidatureInteraction(interaction) {
  if (interaction.isButton() && interaction.customId.startsWith('candidature_start_')) {
    const [, , type, userId] = interaction.customId.split('_');
    
    if (interaction.user.id !== userId) {
      return interaction.reply({ 
        content: '❌ Ce bouton n\'est pas pour toi !', 
        ephemeral: true 
      });
    }

    const isStaff = type === 'staff';
    const modal = new ModalBuilder()
      .setCustomId(`candidature_modal_${type}`)
      .setTitle(`Candidature ${isStaff ? 'Staff' : 'Département'}`);

    const questions = isStaff ? [
      { id: 'poste', label: 'Poste visé (Modo/Admin/Dev)', style: TextInputStyle.Short, placeholder: 'Ex: Modérateur' },
      { id: 'age', label: 'Âge IRL et fuseau horaire', style: TextInputStyle.Short, placeholder: 'Ex: 17 ans, EST (Québec)' },
      { id: 'temps', label: 'Heures/semaine disponibles', style: TextInputStyle.Short, placeholder: 'Ex: 15-20 heures' },
      { id: 'experience', label: 'Expériences staff précédentes', style: TextInputStyle.Paragraph, placeholder: 'Détaille tes expériences...' },
      { id: 'situation', label: 'Mise en situation (insultes)', style: TextInputStyle.Paragraph, placeholder: 'Comment réagirais-tu ?' }
    ] : [
      { id: 'departement', label: 'Département visé', style: TextInputStyle.Short, placeholder: 'Ex: SQ, EMS, Pompiers...' },
      { id: 'age', label: 'Âge IRL + temps sur ER:LC', style: TextInputStyle.Short, placeholder: 'Ex: 15 ans, 2 ans sur ER:LC' },
      { id: 'autres_rp', label: 'Autres serveurs RP ?', style: TextInputStyle.Short, placeholder: 'Ex: Oui, Liberty City RP' },
      { id: 'motivation', label: 'Pourquoi ce département ? (min 100 chars)', style: TextInputStyle.Paragraph, placeholder: 'Explique ta motivation...' },
      { id: 'scenario', label: 'Exemple de scénario RP', style: TextInputStyle.Paragraph, placeholder: 'Décris un scénario que tu aimerais créer...' }
    ];

    questions.forEach((q, i) => {
      const input = new TextInputBuilder()
        .setCustomId(`q${i+1}_${q.id}`)
        .setLabel(q.label)
        .setStyle(q.style)
        .setPlaceholder(q.placeholder)
        .setRequired(true)
        .setMaxLength(q.style === TextInputStyle.Short ? 100 : 1000);
      
      modal.addComponents(new ActionRowBuilder().addComponents(input));
    });

    await interaction.showModal(modal);
  }

  if (interaction.isModalSubmit() && interaction.customId.startsWith('candidature_modal_')) {
    const type = interaction.customId.replace('candidature_modal_', '');
    const isStaff = type === 'staff';
    
    await interaction.deferReply({ ephemeral: true });

    const reponses = [];
    for (let i = 1; i <= 5; i++) {
      const field = interaction.fields.components[i-1].components[0];
      reponses.push({
        id: field.customId,
        question: field.customId.split('_')[1],
        reponse: interaction.fields.getTextInputValue(field.customId)
      });
    }

    const candidatureId = `${Date.now()}_${interaction.user.id}`;
    const candidature = {
      id: candidatureId,
      type: type,
      userId: interaction.user.id,
      username: interaction.user.username,
      displayName: interaction.user.displayName,
      date: new Date().toISOString(),
      reponses: reponses,
      statut: 'en_attente'
    };

    const data = loadCandidatures();
    data[candidatureId] = candidature;
    saveCandidatures(data);

    const departement = reponses[0].reponse;
    const couleur = COLORS[departement] || 0x3498DB;

    const embed = new EmbedBuilder()
      .setTitle(`📋 Nouvelle candidature ${isStaff ? 'Staff' : 'Département'}`)
      .setDescription(`**Candidat :** ${interaction.user} (${interaction.user.username})\n**Type :** ${departement}\n**Date :** ${new Date().toLocaleString('fr-CA')}`)
      .setColor(couleur)
      .setThumbnail(interaction.user.displayAvatarURL({ size: 256 }));

    const labels = isStaff 
      ? ['🎯 Poste visé', '🎂 Âge & Fuseau', ' Disponibilité', '💼 Expériences', '🤔 Mise en situation']
      : ['🏢 Département', '🎂 Âge & ER:LC', '🎮 Autres serveurs', '💭 Motivation', '🎬 Scénario'];
    
    reponses.forEach((r, i) => {
      embed.addFields({
        name: labels[i],
        value: r.reponse.substring(0, 1024),
        inline: false
      });
    });

    embed.setFooter({ text: `ID: ${candidatureId}` });

    const buttons = new ActionRowBuilder().addComponents(
      new ButtonBuilder()
        .setCustomId(`candidature_accept_${candidatureId}`)
        .setLabel('✅ Accepter')
        .setStyle(ButtonStyle.Success),
      new ButtonBuilder()
        .setCustomId(`candidature_refuse_${candidatureId}`)
        .setLabel('❌ Refuser')
        .setStyle(ButtonStyle.Danger),
      new ButtonBuilder()
        .setCustomId(`candidature_entretien_${candidatureId}`)
        .setLabel('🎤 Entretien')
        .setStyle(ButtonStyle.Secondary),
      new ButtonBuilder()
        .setCustomId(`candidature_info_${candidatureId}`)
        .setLabel(' Plus d\'infos')
        .setStyle(ButtonStyle.Primary)
    );

    try {
      const channel = await interaction.client.channels.fetch(CONFIG.CANDIDATURES_CHANNEL);
      await channel.send({ embeds: [embed], components: [buttons] });
      
      await interaction.editReply({ 
        content: '✅ **Candidature envoyée avec succès !** Le staff va examiner ta candidature.' 
      });
    } catch (err) {
      await interaction.editReply({ content: '❌ Erreur lors de l\'envoi de la candidature.' });
    }
  }

  if (interaction.isButton() && interaction.customId.startsWith('candidature_')) {
    const [, action, candidatureId] = interaction.customId.split('_');
    
    const member = interaction.member;
    const staffRoles = ['Modérateur', 'Administrateur', 'Manager', 'Directeur', 'Fondatrice'];
    const hasStaffRole = member.roles.cache.some(r => staffRoles.includes(r.name));
    
    if (!hasStaffRole && !member.permissions.has(PermissionFlagsBits.Administrator)) {
      return interaction.reply({ 
        content: '❌ Seuls les membres du staff peuvent utiliser ces boutons.', 
        ephemeral: true 
      });
    }

    const data = loadCandidatures();
    const candidature = data[candidatureId];
    
    if (!candidature) {
      return interaction.reply({ content: ' Candidature introuvable.', ephemeral: true });
    }

    if (action === 'accept') {
      candidature.statut = 'acceptee';
      candidature.decision = { par: interaction.user.id, date: new Date().toISOString(), action: 'accept' };
      saveCandidatures(data);
      
      try {
        const user = await interaction.client.users.fetch(candidature.userId);
        const dmEmbed = new EmbedBuilder()
          .setTitle(' Félicitations !')
          .setDescription(`Ta candidature pour **${candidature.reponses[0].reponse}** a été **acceptée** !`)
          .setColor(0x00FF00)
          .setFooter({ text: 'Thetford Mines RP' })
          .setTimestamp();
        await user.send({ embeds: [dmEmbed] });
      } catch (e) {}

      await logResult(interaction, candidature, '✅ ACCEPTÉE', 0x00FF00);
      
      await interaction.update({ 
        components: [], 
        content: `✅ **Candidature acceptée** par ${interaction.user}` 
      });
    }

    else if (action === 'refuse') {
      candidature.statut = 'refusee';
      candidature.decision = { par: interaction.user.id, date: new Date().toISOString(), action: 'refuse' };
      saveCandidatures(data);

      try {
        const user = await interaction.client.users.fetch(candidature.userId);
        const dmEmbed = new EmbedBuilder()
          .setTitle('📋 Décision concernant ta candidature')
          .setDescription(`Malheureusement, ta candidature n'a pas été retenue cette fois.`)
          .setColor(0xFF0000)
          .setFooter({ text: 'Thetford Mines RP' })
          .setTimestamp();
        await user.send({ embeds: [dmEmbed] });
      } catch (e) {}

      await logResult(interaction, candidature, '❌ REFUSÉE', 0xFF0000);
      
      await interaction.update({ 
        components: [], 
        content: `❌ **Candidature refusée** par ${interaction.user}` 
      });
    }

    else if (action === 'entretien') {
      try {
        const user = await interaction.client.users.fetch(candidature.userId);
        const dmEmbed = new EmbedBuilder()
          .setTitle('🎤 Invitation à un entretien')
          .setDescription(`Le staff souhaite te rencontrer pour discuter de ta candidature !`)
          .setColor(0xFFA500)
          .setFooter({ text: 'Thetford Mines RP' })
          .setTimestamp();
        await user.send({ embeds: [dmEmbed] });
        
        candidature.statut = 'entretien';
        saveCandidatures(data);
        
        await interaction.reply({ 
          content: '🎤 Invitation à l\'entretien envoyée au candidat !', 
          ephemeral: true 
        });
      } catch (e) {
        await interaction.reply({ content: '❌ Impossible d\'envoyer le DM.', ephemeral: true });
      }
    }
  }
}

async function logResult(interaction, candidature, statutText, color) {
  try {
    const channel = await interaction.client.channels.fetch(CONFIG.RESULTS_CHANNEL);
    
    const embed = new EmbedBuilder()
      .setTitle(`📋 Résultat de candidature ${statutText}`)
      .setColor(color)
      .addFields(
        { name: '👤 Candidat', value: `<@${candidature.userId}> (${candidature.username})`, inline: true },
        { name: '🏢 Type', value: candidature.reponses[0].reponse, inline: true },
        { name: '️ Décision par', value: `${interaction.user}`, inline: true },
        { name: ' Date', value: new Date().toLocaleString('fr-CA'), inline: false }
      )
      .setFooter({ text: `ID: ${candidature.id}` })
      .setTimestamp();

    await channel.send({ embeds: [embed] });
  } catch (e) {
    console.error('Erreur log résultat:', e);
  }
}

async function handleCandidatureCommand(message) {
  const args = message.content.split(' ').slice(1);
  const type = args[0]?.toLowerCase();
  
  if (!type || !['dep', 'staff'].includes(type)) {
    return message.reply({
      embeds: [new EmbedBuilder()
        .setTitle('📋 Système de candidatures')
        .setDescription('**Utilisation :**\n• `!candidature dep` - Postuler pour un département\n• `!candidature staff` - Postuler pour le staff')
        .setColor(0xFFD700)
      ]
    });
  }

  await sendCandidatureInfo(message, type);
}

module.exports = {
  handleCandidatureCommand,
  handleCandidatureInteraction
};
