const express = require('express');
const cors = require('cors');

const app = express();
const PORT = process.env.PORT || 3000;

// データ保存用
let characters = {};
let inventories = {};
let ranking = [];

// ★★★ 重要: CORS設定（これがないとブラウザがブロックする）★★★
app.use(cors({
  origin: '*',  // すべてのオリジンを許可
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Accept', 'Authorization'],
  credentials: true
}));

app.use(express.json({ limit: '10mb' }));

// ★★★ OPTIONSリクエストに対応（CORS preflight）★★★
app.options('*', cors());

// ルート（動作確認用）
app.get('/', (req, res) => {
  console.log('✅ ルートアクセス from:', req.headers.origin || 'unknown');
  res.json({ 
    status: 'ok', 
    message: '🎮 RPGサーバー稼働中！',
    cors: 'enabled',
    time: new Date().toISOString()
  });
});

// キャラクター取得
app.get('/api/character/:username', (req, res) => {
  const username = req.params.username;
  const data = characters[username];
  
  if (data) {
    console.log('✅ キャラ取得:', username);
    res.json({ success: true, data: data });
  } else {
    console.log('❌ キャラ未発見:', username);
    res.status(404).json({ success: false, message: 'Not found' });
  }
});

// キャラクター保存
app.post('/api/character/:username', (req, res) => {
  const username = req.params.username;
  const data = req.body;
  
  characters[username] = data;
  console.log('💾 キャラ保存:', username, 'Lv', data.level);
  
  // ランキング更新
  const power = calculatePower(data);
  updateRanking(username, data.class, data.level, power);
  
  res.json({ success: true });
});

// ランキング取得
app.get('/api/ranking', (req, res) => {
  const sorted = ranking.sort((a, b) => b.power - a.power);
  console.log('📊 ランキング:', sorted.length, '人');
  res.json({ success: true, ranking: sorted });
});

// インベントリ取得
app.get('/api/inventory/:username', (req, res) => {
  const items = inventories[username] || [];
  console.log('🎒 インベントリ取得:', username, items.length, '個');
  res.json({ success: true, items: items });
});

// インベントリ保存
app.post('/api/inventory/:username', (req, res) => {
  const username = req.params.username;
  inventories[username] = req.body.items || [];
  console.log('💾 インベントリ保存:', username);
  res.json({ success: true });
});

// パーティー募集
app.get('/api/party-recruits', (req, res) => {
  res.json({ success: true, recruits: [] });
});

app.post('/api/party-recruits', (req, res) => {
  res.json({ success: true });
});

app.delete('/api/party-recruits/:id', (req, res) => {
  res.json({ success: true });
});

// パーティー申請
app.get('/api/party-requests/:username', (req, res) => {
  res.json({ success: true, requests: [] });
});

app.post('/api/party-requests', (req, res) => {
  res.json({ success: true });
});

app.delete('/api/party-requests/:id', (req, res) => {
  res.json({ success: true });
});

// ヘルパー関数
function calculatePower(char) {
  if (!char) return 0;
  let totalAtk = char.attack || 10;
  let totalDef = char.defense || 10;
  let totalSpd = char.speed || 10;
  
  if (char.equipment && Array.isArray(char.equipment)) {
    char.equipment.forEach(item => {
      totalAtk += item.attack || 0;
      totalDef += item.defense || 0;
      totalSpd += item.speed || 0;
    });
  }
  
  return Math.floor(char.maxHp * 0.5 + totalAtk * 3 + totalDef * 2 + totalSpd * 1.5);
}

function updateRanking(username, charClass, level, power) {
  const index = ranking.findIndex(r => r.username === username);
  const data = {
    username,
    class: charClass,
    level,
    power,
    lastActive: new Date().toISOString()
  };
  
  if (index >= 0) {
    ranking[index] = data;
  } else {
    ranking.push(data);
  }
}

// サーバー起動
app.listen(PORT, '0.0.0.0', () => {
  console.log('===================');
  console.log('🚀 サーバー起動！');
  console.log('📡 ポート:', PORT);
  console.log('✅ CORS: 有効');
  console.log('===================');
});
