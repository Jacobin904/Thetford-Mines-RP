const CONFIG = {
  SERVER_ID: '7482501509096148992',
  API_URL: `https://melonly.xyz/api/v1/servers/7482501509096148992/stats`
};

async function getMelonlyStats() {
  const token = process.env.MELONLY_TOKEN;
  
  if (!token) {
    console.error('❌ ERREUR: La variable MELONLY_TOKEN n\'est pas définie.');
    return null;
  }

  try {
    const response = await fetch(CONFIG.API_URL, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json',
        'User-Agent': 'ThetfordMinesRP-Bot/1.0'
      }
    });

    if (!response.ok) {
      console.error(`❌ Erreur API Melonly: ${response.status} ${response.statusText}`);
      return null;
    }

    const data = await response.json();
    return data;

  } catch (error) {
    console.error('❌ Erreur de connexion à l\'API Melonly:', error.message);
    return null;
  }
}

module.exports = {
  getMelonlyStats
};
