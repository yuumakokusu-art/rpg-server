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

  // パーティー募集の表
  db.run(`CREATE TABLE IF NOT EXISTS party_recruits (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL,
    class TEXT NOT NULL,
    level INTEGER NOT NULL,
    power INTEGER NOT NULL,
    message TEXT NOT NULL,
    max_members INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`);

  // パーティー申請の表
  db.run(`CREATE TABLE IF NOT EXISTS party_requests (
    id TEXT PRIMARY KEY,
    from_user TEXT NOT NULL,
    to_user TEXT NOT NULL,
    class TEXT NOT NULL,
    level INTEGER NOT NULL,
    power INTEGER NOT NULL,
    created_at INTEGER NOT NULL
  )`);

  // パーティーデータの表
  db.run(`CREATE TABLE IF NOT EXISTS parties (
    party_id TEXT PRIMARY KEY,
    leader TEXT NOT NULL,
    party_data TEXT NOT NULL,
    updated_at INTEGER NOT NULL
  )`);

  // 協力バトルセッションの表
  db.run(`CREATE TABLE IF NOT EXISTS battle_sessions (
    session_id TEXT PRIMARY KEY,
    session_data TEXT NOT NULL,
    created_at INTEGER NOT NULL,
    updated_at INTEGER NOT NULL
  )`);
});

// サーバーが動いているか確認
app.get('/', (req, res) => {
  res.json({ status: 'ok', message: 'RPGサーバーが動いています！' });
});

// ===== キャラクターデータ関連 =====

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

// ===== インベントリ関連 =====

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

// ===== ランキング関連 =====

// ランキングを取得
app.get('/api/ranking', (req, res) => {
  db.all(`SELECT * FROM ranking ORDER BY power DESC LIMIT 100`, [], (err, rows) => {
    if (err) {
      return res.status(500).json({ error: 'エラーが発生しました' });
    }
    res.json({ ranking: rows });
  });
});

// ===== パーティー募集関連 =====

// パーティー募集一覧を取得
app.get('/api/party-recruits', (req, res) => {
  const thirtyMinutesAgo = Date.now() - 1800000; // 30分前
  
  db.all(
    `SELECT * FROM party_recruits WHERE created_at > ? ORDER BY created_at DESC`,
    [thirtyMinutesAgo],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'エラーが発生しました' });
      }
      res.json({ recruits: rows });
    }
  );
});

// パーティー募集を投稿
app.post('/api/party-recruits', (req, res) => {
  const { id, username, class: charClass, level, power, message, maxMembers } = req.body;
  const now = Date.now();
  
  // 同じユーザーの古い募集を削除
  db.run('DELETE FROM party_recruits WHERE username = ?', [username], (err) => {
    if (err) {
      return res.status(500).json({ error: '削除に失敗しました' });
    }
    
    // 新しい募集を追加
    db.run(
      `INSERT INTO party_recruits (id, username, class, level, power, message, max_members, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [id, username, charClass, level, power, message, maxMembers, now],
      function(err) {
        if (err) {
          return res.status(500).json({ error: '投稿に失敗しました' });
        }
        res.json({ success: true, id });
      }
    );
  });
});

// パーティー募集を削除
app.delete('/api/party-recruits/:id', (req, res) => {
  const id = req.params.id;
  
  db.run('DELETE FROM party_recruits WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: '削除に失敗しました' });
    }
    res.json({ success: true });
  });
});

// ===== パーティー申請関連 =====

// パーティー申請を取得
app.get('/api/party-requests/:username', (req, res) => {
  const username = req.params.username;
  const thirtyMinutesAgo = Date.now() - 1800000;
  
  db.all(
    `SELECT * FROM party_requests WHERE to_user = ? AND created_at > ? ORDER BY created_at DESC`,
    [username, thirtyMinutesAgo],
    (err, rows) => {
      if (err) {
        return res.status(500).json({ error: 'エラーが発生しました' });
      }
      res.json({ requests: rows });
    }
  );
});

// パーティー申請を送信
app.post('/api/party-requests', (req, res) => {
  const { id, fromUser, toUser, class: charClass, level, power } = req.body;
  const now = Date.now();
  
  db.run(
    `INSERT OR REPLACE INTO party_requests (id, from_user, to_user, class, level, power, created_at)
     VALUES (?, ?, ?, ?, ?, ?, ?)`,
    [id, fromUser, toUser, charClass, level, power, now],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '送信に失敗しました' });
      }
      res.json({ success: true, id });
    }
  );
});

// パーティー申請を削除
app.delete('/api/party-requests/:id', (req, res) => {
  const id = req.params.id;
  
  db.run('DELETE FROM party_requests WHERE id = ?', [id], function(err) {
    if (err) {
      return res.status(500).json({ error: '削除に失敗しました' });
    }
    res.json({ success: true });
  });
});

// ===== パーティーデータ関連 =====

// パーティーデータを取得
app.get('/api/party/:partyId', (req, res) => {
  const partyId = req.params.partyId;
  
  db.get('SELECT * FROM parties WHERE party_id = ?', [partyId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'エラーが発生しました' });
    }
    if (!row) {
      return res.status(404).json({ error: 'パーティーが見つかりません' });
    }
    res.json({
      party_id: row.party_id,
      data: JSON.parse(row.party_data),
      updated_at: row.updated_at
    });
  });
});

// パーティーデータを保存
app.post('/api/party/:partyId', (req, res) => {
  const partyId = req.params.partyId;
  const partyData = JSON.stringify(req.body);
  const leader = req.body.leader;
  const now = Date.now();
  
  db.run(
    `INSERT OR REPLACE INTO parties (party_id, leader, party_data, updated_at)
     VALUES (?, ?, ?, ?)`,
    [partyId, leader, partyData, now],
    function(err) {
      if (err) {
        return res.status(500).json({ error: '保存に失敗しました' });
      }
      res.json({ success: true, updated_at: now });
    }
  );
});

// パーティーを削除
app.delete('/api/party/:partyId', (req, res) => {
  const partyId = req.params.partyId;
  
  db.run('DELETE FROM parties WHERE party_id = ?', [partyId], function(err) {
    if (err) {
      return res.status(500).json({ error: '削除に失敗しました' });
    }
    res.json({ success: true });
  });
});

// ===== 協力バトルセッション関連 =====

// バトルセッションを取得
app.get('/api/battle-session/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  
  db.get('SELECT * FROM battle_sessions WHERE session_id = ?', [sessionId], (err, row) => {
    if (err) {
      return res.status(500).json({ error: 'エラーが発生しました' });
    }
    if (!row) {
      return res.status(404).json({ error: 'セッションが見つかりません' });
    }
    res.json({
      session_id: row.session_id,
      data: JSON.parse(row.session_data),
      created_at: row.created_at,
      updated_at: row.updated_at
    });
  });
});

// バトルセッションを保存
app.post('/api/battle-session/:sessionId', (req, res) => {
  const sessionId = req.params.sessionId;
  const sessionData = JSON.stringify(req.body);
  const now = Date.now();
  
  db.get('SELECT created_at FROM battle_sessions WHERE session_id = ?', [sessionId], (err, row) => {
    const createdAt = row ? row.created_at : now;
    
    db.run(
      `INSERT OR REPLACE INTO battle_sessions (session_id, session_data, created_at, updated_at)
       VALUES (?, ?, ?, ?)`,
      [sessionId, sessionData, createdAt, now],
      function(err) {
        if (err) {
          return res.status(500).json({ error: '保存に失敗しました' });
        }
        res.json({ success: true, updated_at: now });
      }
    );
  });
});

// 古いバトルセッションを削除（1時間以上経過）
app.delete('/api/battle-sessions/cleanup', (req, res) => {
  const oneHourAgo = Date.now() - 3600000;
  
  db.run('DELETE FROM battle_sessions WHERE updated_at < ?', [oneHourAgo], function(err) {
    if (err) {
      return res.status(500).json({ error: '削除に失敗しました' });
    }
    res.json({ success: true, deleted: this.changes });
  });
});

// ===== ユーティリティ関数 =====

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
