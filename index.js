const { 
  Client, 
  GatewayIntentBits, 
  Partials, 
  AuditLogEvent, 
  EmbedBuilder, 
  ChannelType 
} = require('discord.js');
const config = require('./config.json');

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildModeration
  ],
  partials: [
    Partials.GuildMember,
    Partials.User,
    Partials.Channel
  ]
});

// Cache bot owner ID(s)
let botOwnerId = null;

client.once('ready', async () => {
  console.log(`Bot ${client.user.tag} olarak giriş yaptı!`);
  
  try {
    const app = await client.application.fetch();
    if (app.owner) {
      if (app.owner.members) {
        // If owner is a Team
        botOwnerId = Array.from(app.owner.members.keys());
        console.log(`Bot sahipleri (Takım): ${botOwnerId.join(', ')}`);
      } else {
        botOwnerId = app.owner.id;
        console.log(`Bot sahibi: ${botOwnerId}`);
      }
    }
  } catch (error) {
    console.error("Uygulama bilgileri (bot sahibi) alınamadı:", error);
  }
  
  // Check and create log channels in all guilds the bot is currently in
  for (const guild of client.guilds.cache.values()) {
    await checkAndCreateLogChannel(guild);
  }
});

client.on('guildCreate', async (guild) => {
  console.log(`Yeni bir sunucuya katıldı: ${guild.name}`);
  await checkAndCreateLogChannel(guild);
});

// Helper: Check if user is whitelisted
async function isWhitelisted(guild, userId) {
  // Bot itself is whitelisted
  if (userId === client.user.id) return true;
  // Guild owner is whitelisted
  if (userId === guild.ownerId) return true;
  
  // Bot owner is whitelisted
  if (Array.isArray(botOwnerId)) {
    if (botOwnerId.includes(userId)) return true;
  } else if (botOwnerId === userId) {
    return true;
  }
  
  return false;
}

// Helper: Auto check/create log channel under target category
async function checkAndCreateLogChannel(guild) {
  try {
    let category = guild.channels.cache.get(config.logCategoryId);
    if (!category) {
      // Fallback: look for category named "LOG" if the configured ID is not found in this guild
      category = guild.channels.cache.find(c => c.name === "LOG" && c.type === ChannelType.GuildCategory);
    }
    
    const channelName = 'guard-log';
    let logChannel = guild.channels.cache.find(c => 
      c.name === channelName && 
      c.type === ChannelType.GuildText && 
      c.parentId === (category ? category.id : null)
    );
    
    if (!logChannel) {
      const createOptions = {
        name: channelName,
        type: ChannelType.GuildText,
      };
      if (category) {
        createOptions.parent = category.id;
      }
      logChannel = await guild.channels.create(createOptions);
      console.log(`[LOG] ${guild.name} sunucusunda '${channelName}' kanalı oluşturuldu.`);
    }
    return logChannel;
  } catch (error) {
    console.error(`[HATA] ${guild.name} sunucusunda log kanalı kontrolü başarısız:`, error);
    return null;
  }
}

// Helper: Fetch audit log entry with retries
async function getAuditLogEntry(guild, actionType, targetId, retries = 3) {
  for (let i = 0; i < retries; i++) {
    try {
      const fetchedLogs = await guild.fetchAuditLogs({
        limit: 5,
        type: actionType,
      });
      
      const entry = fetchedLogs.entries.find(e => 
        (targetId && e.targetId === targetId) || 
        (Date.now() - e.createdTimestamp < 8000)
      );
      
      if (entry) return entry;
    } catch (e) {
      console.error("Audit log çekilirken hata oluştu:", e);
    }
    await new Promise(resolve => setTimeout(resolve, 800));
  }
  return null;
}

// Helper: Strip all roles from member
async function stripRoles(member, reason) {
  try {
    const guild = member.guild;
    const botMember = guild.members.me || await guild.members.fetch(client.user.id);
    const botHighestRole = botMember.roles.highest;
    
    // Filter roles: exclude @everyone, integration roles, and roles higher than bot's highest role
    const rolesToRemove = member.roles.cache.filter(role => 
      role.id !== guild.id && 
      !role.managed && 
      role.position < botHighestRole.position
    );
    
    if (rolesToRemove.size === 0) {
      return { success: false, reason: "Çıkarılabilir rol bulunamadı (Botun rolü yetersiz veya kullanıcının rolü yok)." };
    }
    
    await member.roles.remove(rolesToRemove, reason);
    return { success: true, removedCount: rolesToRemove.size, roles: rolesToRemove.map(r => r.name) };
  } catch (error) {
    console.error(`Rol alma hatası (${member.user.tag}):`, error);
    return { success: false, reason: error.message };
  }
}

// Event: Role Delete
client.on('roleDelete', async (role) => {
  const guild = role.guild;
  
  // Wait briefly for audit log
  await new Promise(resolve => setTimeout(resolve, 500));
  const entry = await getAuditLogEntry(guild, AuditLogEvent.RoleDelete, role.id);
  
  if (!entry) return;
  const { executor } = entry;
  
  // Skip if whitelisted
  if (await isWhitelisted(guild, executor.id)) return;
  
  // Strip roles from executor
  try {
    const member = await guild.members.fetch(executor.id);
    const result = await stripRoles(member, "Rol Silme Koruması tetiklendi");
    
    // Log the event
    const logChannel = await checkAndCreateLogChannel(guild);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle('🛡️ Guard Koruması: Rol Silindi!')
        .setColor('#FF0000')
        .addFields(
          { name: 'Silinen Rol', value: `${role.name} (${role.id})`, inline: true },
          { name: 'Silen Kullanıcı', value: `${executor} (${executor.tag} / ${executor.id})`, inline: true },
          { name: 'Sonuç', value: result.success ? `Kullanıcının ${result.removedCount} adet yetki/rolü alındı.` : `Yetkiler alınamadı: ${result.reason}` }
        )
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error("RoleDelete koruma işlemi sırasında hata:", error);
  }
});

// Event: Channel Delete
client.on('channelDelete', async (channel) => {
  if (channel.type === ChannelType.DM || channel.type === ChannelType.GroupDM) return;
  
  const guild = channel.guild;
  
  // Wait briefly for audit log
  await new Promise(resolve => setTimeout(resolve, 500));
  const entry = await getAuditLogEntry(guild, AuditLogEvent.ChannelDelete, channel.id);
  
  if (!entry) return;
  const { executor } = entry;
  
  if (await isWhitelisted(guild, executor.id)) return;
  
  try {
    const member = await guild.members.fetch(executor.id);
    const result = await stripRoles(member, "Kanal Silme Koruması tetiklendi");
    
    const logChannel = await checkAndCreateLogChannel(guild);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle('🛡️ Guard Koruması: Kanal Silindi!')
        .setColor('#FF0000')
        .addFields(
          { name: 'Silinen Kanal', value: `${channel.name} (${channel.id})`, inline: true },
          { name: 'Silen Kullanıcı', value: `${executor} (${executor.tag} / ${executor.id})`, inline: true },
          { name: 'Sonuç', value: result.success ? `Kullanıcının ${result.removedCount} adet yetki/rolü alındı.` : `Yetkiler alınamadı: ${result.reason}` }
        )
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error("ChannelDelete koruma işlemi sırasında hata:", error);
  }
});

// Event: Channel Update (Name change)
client.on('channelUpdate', async (oldChannel, newChannel) => {
  if (oldChannel.type === ChannelType.DM || oldChannel.type === ChannelType.GroupDM) return;
  if (oldChannel.name === newChannel.name) return; // Only trigger if name changed
  
  const guild = newChannel.guild;
  
  // Wait briefly for audit log
  await new Promise(resolve => setTimeout(resolve, 500));
  const entry = await getAuditLogEntry(guild, AuditLogEvent.ChannelUpdate, newChannel.id);
  
  if (!entry) return;
  const { executor } = entry;
  
  if (await isWhitelisted(guild, executor.id)) return;
  
  try {
    const member = await guild.members.fetch(executor.id);
    const result = await stripRoles(member, "Kanal İsmi Değiştirme Koruması tetiklendi");
    
    // Revert channel name back to oldChannel.name to prevent unauthorized renaming
    try {
      await newChannel.setName(oldChannel.name, "Kanal ismi değiştirme koruması nedeniyle geri alındı");
    } catch (revertErr) {
      console.error("Kanal adı eski haline getirilemedi:", revertErr);
    }
    
    const logChannel = await checkAndCreateLogChannel(guild);
    if (logChannel) {
      const embed = new EmbedBuilder()
        .setTitle('🛡️ Guard Koruması: Kanal İsmi Değiştirildi!')
        .setColor('#FF0000')
        .addFields(
          { name: 'Kanal', value: `${newChannel} (${newChannel.id})`, inline: true },
          { name: 'Eski İsim', value: oldChannel.name, inline: true },
          { name: 'Yeni İsim', value: newChannel.name, inline: true },
          { name: 'Değiştiren Kullanıcı', value: `${executor} (${executor.tag} / ${executor.id})`, inline: true },
          { name: 'Sonuç', value: result.success ? `Kullanıcının ${result.removedCount} adet yetki/rolü alındı. Kanal ismi eski haline getirildi.` : `Yetkiler alınamadı: ${result.reason}. Kanal ismi eski haline getirilmeye çalışıldı.` }
        )
        .setTimestamp();
      await logChannel.send({ embeds: [embed] });
    }
  } catch (error) {
    console.error("ChannelUpdate koruma işlemi sırasında hata:", error);
  }
});

client.login(config.token).catch(err => {
  console.error("Bot giriş yapamadı. Token geçersiz olabilir:", err);
});
