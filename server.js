// 必要な道具を読み込む
const express = require('express');
const cors = require('cors');
const sqlite3 = require('sqlite3').verbose();

// サーバーを作る
const app = express();
const PORT = process.env.PORT || 3000;

// データベースを作る
const db = new sqlite3.Database('./rpg.db');

// いろんなウェブサイトからアクセスできるようにする
app.use(cors());
app.use(express.json({ limit: '50mb' }));

// データベースの表を作る
db.serialize(() => {
  // プレイヤーデータの表
  db.run(`CREATE TABLE IF NOT EXISTS players (
    username TEXT PRIMARY KEY,
    character_data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

  // 持ち物の表
  db.run(`CREATE TABLE IF NOT EXISTS inventory (
    username TEXT PRIMARY KEY,
    items TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

  // ランキングの表
  db.run(`CREATE TABLE IF NOT EXISTS ranking (
    username TEXT PRIMARY KEY,
    level INTEGER NOT NULL,
    power INTEGER NOT NULL,
    class TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
});

// サーバーが動いているか確認
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'RPGサーバーが動いています！' });
});

// キャラクターデータを取得
app.get('/api/character/:username', (req, res) => {
  const username = req.params.username;
  
  db.get('SELECT * FROM players WHERE username = ?', [username], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'エラーが発生しました' });
    }
    if (!row) {
      return res.status(404).json({ error: 'プレイヤーが見つかりません' });
    }
    res.json({ 
      username: row.username,
      data: JSON.parse(row.character_data),
      updated_at: row.updated_at
    });
  });
});

// キャラクターデータを保存
app.post('/api/character/:username', (req, res) => {
  const username = req.params.username;
  const characterData = JSON.stringify(req.body);
  const now = Date.now();
  
  db.run(`INSERT OR REPLACE INTO players (username, character_data, updated_at) 
          VALUES (?, ?, ?)`, 
    [username, characterData, now], 
    function(err) {
      if (err) {
        return res.status(500).json({ error: '保存に失敗しました' });
      }
      
      // ランキングも更新
      const char = req.body;
      const power = calculatePower(char);
      db.run(`INSERT OR REPLACE INTO ranking (username, level, power, class, updated_at)
              VALUES (?, ?, ?, ?, ?)`,
        [username, char.level, power, char.class, now]
      );
      
      res.json({ success: true, updated_at: now });
    }
  );
});

// 持ち物を取得
app.get('/api/inventory/:username', (req, res) => {
  const username = req.params.username;
  
  db.get('SELECT * FROM inventory WHERE username = ?', [username], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'エラーが発生しました' });
    }
    if (!row) {
      return res.json({ items: [] });
    }
    res.json({ 
      items: JSON.parse(row.items),
      updated_at: row.updated_at
    });
  });
});

// 持ち物を保存
app.post('/api/inventory/:username', (req, res) => {
  const username = req.params.username;
  const items = JSON.stringify(req.body.items);
  const now = Date.now();
  
  db.run(`INSERT OR REPLACE INTO inventory (username, items, updated_at) 
          VALUES (?, ?, ?)`, 
    [username, items, now], 
    function(err) {
      if (err) {
        return res.status(500).json({ error: '保存に失敗しました' });
      }
      res.json({ success: true, updated_at: now });
    }
  );
});

// ランキングを取得
app.get('/api/ranking', (req, res) => {
  db.all(`SELECT * FROM ranking ORDER BY power DESC LIMIT 100`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'エラーが発生しました' });
    }
    res.json({ ranking: rows });
  });
});

// 戦闘力を計算
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

// サーバーを起動
app.listen(PORT, () => {
  console.log(`🎮 RPGサーバーが起動しました！ポート: ${PORT}`);
});


