const { EmbedBuilder } = require('discord.js');
const fs = require('fs');
const path = require('path');

const CONFIG = {
  DISCORD_CHANNEL_ID: '1459615347538919515',
  DATA_FILE: path.join(__dirname, 'social-posts.json'),
  CHECK_INTERVAL: 10 * 60 * 1000,
  MAX_STORED_IDS: 200,
  
  PLATFORMS: {
    youtube: {
      name: 'YouTube',
      color: 0xFF0000,
      icon: 'https://cdn-icons-png.flaticon.com/512/1384/1384060.png',
      feeds: ['https://www.youtube.com/feeds/videos.xml?channel_id=UC_CHANNEL_ID']
    },
    twitter: {
      name: 'Twitter/X',
      color: 0x1DA1F2,
      icon: 'https://cdn-icons-png.flaticon.com/512/733/733579.png',
      feeds: [
        'https://rsshub.app/twitter/user/PRC_Roblox',
        'https://nitter.poast.org/PRC_Roblox/rss'
      ]
    }
  }
};

function loadSentPosts() {
  try {
    if (fs.existsSync(CONFIG.DATA_FILE)) {
      return JSON.parse(fs.readFileSync(CONFIG.DATA_FILE, 'utf8'));
    }
  } catch (e) {}
  return { youtube: [], twitter: [] };
}

function saveSentPosts(posts) {
  for (const platform in posts) {
    posts[platform] = posts[platform].slice(-CONFIG.MAX_STORED_IDS);
  }
  fs.writeFileSync(CONFIG.DATA_FILE, JSON.stringify(posts, null, 2), 'utf8');
}

function parseRSS(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>|<entry>([\s\S]*?)<\/entry>/g;
  let match;
  
  while ((match = itemRegex.exec(xml)) !== null) {
    const itemContent = match[1] || match[2];
    const title = extractTag(itemContent, 'title');
    const link = extractTag(itemContent, 'link') || extractTag(itemContent, 'id');
    const description = extractTag(itemContent, 'description') || extractTag(itemContent, 'content');
    const pubDate = extractTag(itemContent, 'pubDate') || extractTag(itemContent, 'published');
    
    const mediaMatch = description.match(/<img[^>]+src="([^"]+)"/) || itemContent.match(/<media:thumbnail[^>]+url="([^"]+)"/);
    const imageUrl = mediaMatch ? mediaMatch[1] : null;
    
    let cleanDescription = description
      .replace(/<br\s*\/?>/gi, '\n')
      .replace(/<[^>]+>/g, '')
      .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
      .replace(/&quot;/g, '"').replace(/&#39;/g, "'").trim();
    
    if (cleanDescription.length > 500) cleanDescription = cleanDescription.substring(0, 497) + '...';
    
    items.push({ id: link, title, link, description: cleanDescription, pubDate: pubDate ? new Date(pubDate) : new Date(), imageUrl });
  }
  return items;
}

function extractTag(content, tag) {
  const regex = new RegExp(`<${tag}[^>]*>([\\s\\S]*?)<\\/${tag}>`, 'i');
  const match = content.match(regex);
  return match ? match[1].trim() : '';
}

async function fetchRSS(url) {
  try {
    const response = await fetch(url, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; ThetfordBot/1.0)' },
      signal: AbortSignal.timeout(10000)
    });
    if (response.ok) return await response.text();
  } catch (error) {
    console.warn(`⚠️ RSS échoué (${url}): ${error.message}`);
  }
  return null;
}

async function checkYouTube(sentPosts) {
  const newPosts = [];
  for (const feedUrl of CONFIG.PLATFORMS.youtube.feeds) {
    const xml = await fetchRSS(feedUrl);
    if (xml) {
      const items = parseRSS(xml);
      for (const item of items) {
        if (!sentPosts.youtube.includes(item.id)) newPosts.push({ ...item, platform: 'youtube' });
      }
      break;
    }
  }
  return newPosts;
}

async function checkTwitter(sentPosts) {
  const newPosts = [];
  for (const feedUrl of CONFIG.PLATFORMS.twitter.feeds) {
    const xml = await fetchRSS(feedUrl);
    if (xml) {
      const items = parseRSS(xml);
      for (const item of items) {
        if (!sentPosts.twitter.includes(item.id)) newPosts.push({ ...item, platform: 'twitter' });
      }
      break;
    }
  }
  return newPosts;
}

function createPostEmbed(post) {
  const platform = CONFIG.PLATFORMS[post.platform];
  const embed = new EmbedBuilder()
    .setTitle(`📰 Nouveau post ${platform.name}`)
    .setDescription(post.description || post.title || 'Aucun contenu')
    .setColor(platform.color)
    .setURL(post.link)
    .setFooter({ text: `${platform.name} • PRC Roblox`, iconURL: platform.icon })
    .setTimestamp(post.pubDate);
  
  if (post.imageUrl) embed.setImage(post.imageUrl);
  embed.setThumbnail(platform.icon);
  return embed;
}

async function sendPostToDiscord(client, post) {
  try {
    const channel = await client.channels.fetch(CONFIG.DISCORD_CHANNEL_ID);
    if (!channel) return false;
    
    const embed = createPostEmbed(post);
    const platform = CONFIG.PLATFORMS[post.platform];
    
    await channel.send({ 
      content: `📢 **Nouveau post sur ${platform.name}** !`,
      embeds: [embed] 
    });
    console.log(`✅ Post ${platform.name} envoyé : ${post.link}`);
    return true;
  } catch (error) {
    console.error('❌ Erreur envoi post:', error);
    return false;
  }
}

async function checkAllPlatforms(client) {
  try {
    const sentPosts = loadSentPosts();
    const allNewPosts = [];
    
    allNewPosts.push(...await checkYouTube(sentPosts));
    allNewPosts.push(...await checkTwitter(sentPosts));
    
    if (allNewPosts.length === 0) return;
    
    console.log(`🆕 ${allNewPosts.length} nouveau(x) post(s) détecté(s)`);
    
    for (const post of allNewPosts) {
      const success = await sendPostToDiscord(client, post);
      if (success) {
        sentPosts[post.platform].push(post.id);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
    saveSentPosts(sentPosts);
  } catch (error) {
    console.error(' Erreur vérification plateformes:', error);
  }
}

async function startSocialMonitor(client) {
  console.log('🌐 Démarrage du moniteur social multi-plateforme');
  const sentPosts = loadSentPosts();
  
  const ytPosts = await checkYouTube({ youtube: [] });
  sentPosts.youtube = ytPosts.map(p => p.id);
  
  const twPosts = await checkTwitter({ twitter: [] });
  sentPosts.twitter = twPosts.map(p => p.id);
  
  saveSentPosts(sentPosts);
  console.log(`✅ ${ytPosts.length} posts YouTube + ${twPosts.length} posts Twitter marqués comme lus`);
  
  setInterval(() => checkAllPlatforms(client), CONFIG.CHECK_INTERVAL);
}

module.exports = { startSocialMonitor, checkAllPlatforms };
