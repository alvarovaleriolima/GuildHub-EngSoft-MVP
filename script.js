// GuildHub PoC Final (Option A) - corrected, robust localStorage-based PoC
document.addEventListener('DOMContentLoaded', () => {
  // initialize seed data if absent
  if (!localStorage.getItem('guildhubDB')) {
    const seed = {
      users: [
        { user: 'player_one', pass: '123456', profile: { name: 'Player One', bio: 'FPS lover' }, friends: [] }, // Removido sentRequests
        { user: 'gamer_girl', pass: 'abc123', profile: { name: 'Gamer Girl', bio: 'RPG speedrunner' }, friends: [] } // Removido sentRequests
      ],
      posts: [
        { id: 1, user: 'player_one', content: 'Check my new setup! 3080 + 240Hz', likes: [], ts: Date.now() - 60000 },
        { id: 2, user: 'gamer_girl', content: 'Platina no jogo X, dicas para boss?', likes: [], ts: Date.now() - 120000 }
      ],
      messages: [], // {from,to,text,ts}
      requests: [] // {from,to,status,id,ts}
    };
    localStorage.setItem('guildhubDB', JSON.stringify(seed));
  }

  const DB = {
    load: () => JSON.parse(localStorage.getItem('guildhubDB') || '{"users":[],"posts":[],"messages":[],"requests":[]}'),
    save: (o) => localStorage.setItem('guildhubDB', JSON.stringify(o))
  };

  const currentUser = () => localStorage.getItem('currentUser');

  /* ---------- Auth (index.html) ---------- */
  const loginPanel = document.getElementById('loginPanel');
  const registerPanel = document.getElementById('registerPanel');
  const authMsg = document.getElementById('authMsg');

  const btnShowRegister = document.getElementById('btnShowRegister');
  const btnCancelReg = document.getElementById('btnCancelReg');
  const btnCreate = document.getElementById('btnCreate');
  const btnLogin = document.getElementById('btnLogin');

  if (btnShowRegister) btnShowRegister.addEventListener('click', () => {
    loginPanel.classList.add('hidden'); registerPanel.classList.remove('hidden'); authMsg.innerText = '';
  });
  if (btnCancelReg) btnCancelReg.addEventListener('click', () => {
    registerPanel.classList.add('hidden'); loginPanel.classList.remove('hidden'); authMsg.innerText = '';
  });

  if (btnCreate) btnCreate.addEventListener('click', () => {
    const u = document.getElementById('regUser').value.trim();
    const p = document.getElementById('regPass').value;
    const n = document.getElementById('regName').value.trim();
    if (!u || !p || p.length < 4) {
      authMsg && (authMsg.innerText = 'Informe usuário e senha (mín 4 chars)');
      return;
    }
    const db = DB.load();
    if (db.users.find(x => x.user === u)) {
      authMsg && (authMsg.innerText = 'Usuário já existe');
      return;
    }
    // Removido sentRequests da criação de novo usuário
    db.users.push({ user: u, pass: p, profile: { name: n || u, bio: '' }, friends: [] }); 
    DB.save(db);
    authMsg && (authMsg.innerText = 'Conta criada! Faça login.');
    setTimeout(() => {
      registerPanel.classList.add('hidden'); loginPanel.classList.remove('hidden');
    }, 800);
  });

  if (btnLogin) btnLogin.addEventListener('click', () => {
    const u = document.getElementById('loginUser').value.trim();
    const p = document.getElementById('loginPass').value;
    const db = DB.load();
    // robust check: ensure strings compared, trim spaces
    const user = db.users.find(x => String(x.user).trim() === String(u).trim() && String(x.pass) === String(p));
    if (!user) {
      authMsg && (authMsg.innerText = 'Credenciais inválidas');
      return;
    }
    localStorage.setItem('currentUser', user.user);
    window.location = 'home.html';
  });

  /* ---------- Common: logout buttons ---------- */
  const logoutBtns = document.querySelectorAll('#logoutBtn, #logoutBtn2, #logoutBtn3');
  logoutBtns.forEach(b => b && b.addEventListener('click', (e) => { e.preventDefault(); localStorage.removeItem('currentUser'); window.location = 'index.html'; }));

  /* ---------- Profile page (CORRIGIDO) ---------- */
  if (location.pathname.endsWith('profile.html')) {
    const db = DB.load();
    const u = currentUser();
    if (!u) { window.location = 'index.html'; return; }
    const me = db.users.find(x => x.user === u);
    const profName = document.getElementById('profName');
    const profBio = document.getElementById('profBio');
    const sentReqs = document.getElementById('sentReqs');
    
    profName.value = me.profile.name || '';
    profBio.value = me.profile.bio || '';
    sentReqs.innerHTML = '';

    // CORREÇÃO: Listar solicitações enviadas buscando na lista global db.requests
    const sent = db.requests.filter(r => r.from === u && r.status === 'pending');
    
    if (sent.length === 0) {
      sentReqs.innerHTML = '<div class="post small hint">Nenhuma solicitação enviada pendente.</div>';
    } else {
      sent.forEach(s => { 
        sentReqs.innerHTML += `<div class="post small">Para: ${s.to} (pendente)</div>`; 
      });
    }

    document.getElementById('btnSaveProfile').addEventListener('click', () => {
      me.profile.name = profName.value;
      me.profile.bio = profBio.value;
      DB.save(db);
      alert('Perfil salvo');
    });
  }

  /* ---------- Home page logic ---------- */
  if (location.pathname.endsWith('home.html')) {
    const u = currentUser();
    if (!u) { window.location = 'index.html'; return; }
    document.querySelector('header .logo') && (document.querySelector('header .logo').alt = u);
    document.getElementById('logoutBtn').addEventListener('click', (e) => { e.preventDefault(); localStorage.removeItem('currentUser'); window.location = 'index.html'; });

    // elements
    const friendsListEl = document.getElementById('friendsList');
    const reqListEl = document.getElementById('reqList');
    const feedEl = document.getElementById('feed');
    const searchInput = document.getElementById('searchUser');

    // initial render functions
    function renderFriends() {
      const db = DB.load();
      const me = db.users.find(x => x.user === u);
      friendsListEl.innerHTML = '';
      if ((me.friends || []).length === 0) {
         friendsListEl.innerHTML = '<div class="hint">Nenhum amigo ainda. Envie uma solicitação!</div>';
      }
      (me.friends || []).forEach(f => {
        friendsListEl.innerHTML += `<div class="post">${f} <button class="btn small ghost" onclick="openChat('${f}')">Msg</button></div>`;
      });
      // friend notifications (pending requests)
      const pending = DB.load().requests.filter(r => r.to === u && r.status === 'pending').length;
      document.getElementById('notifFriends').innerText = pending ? `(${pending})` : '';
    }

    function renderRequests() {
      const db = DB.load();
      const incoming = db.requests.filter(r => r.to === u && r.status === 'pending');
      reqListEl.innerHTML = '';
      if (incoming.length === 0) {
         reqListEl.innerHTML = '<div class="hint">Nenhuma solicitação pendente.</div>';
      }
      incoming.forEach(r => {
        reqListEl.innerHTML += `<div class="post">${r.from} <button class="btn small" onclick="acceptReq('${r.from}')">Aceitar</button> <button class="btn small ghost" onclick="declineReq('${r.from}')">Recusar</button></div>`;
      });
    }

    function renderFeed() {
      const db = DB.load();
      const me = db.users.find(x => x.user === u);
      const people = new Set([u, ...(me.friends || [])]);
      // Order posts by ts desc; show those from people set
      const feed = db.posts.filter(p => people.has(p.user)).sort((a, b) => b.ts - a.ts);
      feedEl.innerHTML = '';
      if (feed.length === 0) {
         feedEl.innerHTML = '<div class="hint">Seu feed está vazio. Publique algo ou adicione amigos!</div>';
      }
      feed.forEach(p => {
        const liked = p.likes && p.likes.includes(u);
        feedEl.innerHTML += `<div class="post">
          <b>${p.user}</b> <small class="small">• ${new Date(p.ts).toLocaleString()}</small>
          <p>${escapeHtml(p.content)}</p>
          <div class="row">
            <button class="btn small" onclick="likePost(${p.id})">${liked ? 'Curtido' : 'Curtir'} (${(p.likes || []).length})</button>
            <button class="btn small ghost" onclick="openChat('${p.user}')">Msg</button>
          </div>
        </div>`;
      });
    }

    // actions
    document.getElementById('btnPublish').addEventListener('click', () => {
      const content = document.getElementById('newPost').value.trim();
      if (!content) return alert('Escreva algo antes de publicar');
      const db = DB.load();
      // Usando Date.now() como ID, mesmo que seja redundante
      const postId = Math.max(...db.posts.map(p => p.id), 0) + 1; 
      const post = { id: postId, user: u, content, likes: [], ts: Date.now() };
      db.posts.unshift(post);
      DB.save(db);
      document.getElementById('newPost').value = '';
      renderFeed();
    });

    document.getElementById('btnSearch').addEventListener('click', () => {
      const who = searchInput.value.trim();
      if (!who) return alert('Digite um usuário para procurar');
      const db = DB.load();
      if (who === u) return alert('Você não pode enviar solicitação para si mesmo');
      const target = db.users.find(x => x.user === who);
      if (!target) return alert('Usuário não encontrado');
      // evitar duplicata pendente ou amigo existente
      if (db.requests.find(r => r.from === u && r.to === who && r.status === 'pending')) return alert('Solicitação já enviada');
      if (db.users.find(x => x.user === u).friends.includes(who)) return alert('Já é seu amigo');
      
      // Adiciona a solicitação à lista global de requests
      db.requests.push({ from: u, to: who, status: 'pending', id: Date.now(), ts: Date.now() });
      
      DB.save(db);
      alert('Solicitação enviada');
      renderRequests();
      renderFriends();
    });

    // expose functions to global for onclick handlers
    window.acceptReq = (from) => {
      const db = DB.load();
      const ucur = u;
      const req = db.requests.find(r => r.from === from && r.to === ucur && r.status === 'pending');
      if (!req) return;
      req.status = 'accepted';
      const a = db.users.find(x => x.user === ucur);
      const b = db.users.find(x => x.user === from);
      if (!a.friends.includes(from)) a.friends.push(from);
      if (!b.friends.includes(ucur)) b.friends.push(ucur);
      DB.save(db);
      renderFriends();
      renderRequests();
      renderFeed();
    };
    window.declineReq = (from) => {
      const db = DB.load();
      const ucur = u;
      const req = db.requests.find(r => r.from === from && r.to === ucur && r.status === 'pending');
      if (!req) return;
      req.status = 'declined';
      DB.save(db);
      renderRequests();
      renderFriends();
    };

    window.openChat = (other) => {
      localStorage.setItem('openChat', other);
      window.location = 'messages.html';
    };

    window.likePost = (id) => {
      const db = DB.load();
      const p = db.posts.find(x => x.id === id);
      if (!p) return;
      if (!p.likes) p.likes = []; // Garante que a lista de likes exista
      
      if (!p.likes.includes(u)) p.likes.push(u);
      else p.likes = p.likes.filter(x => x !== u);
      
      DB.save(db);
      renderFeed();
    };

    // initial
    renderFriends();
    renderRequests();
    renderFeed();
  }

  /* ---------- Messages page ---------- */
  if (location.pathname.endsWith('messages.html')) {
    const u = currentUser();
    if (!u) { window.location = 'index.html'; return; }

    const convoList = document.getElementById('convoList');
    const messagesPane = document.getElementById('messagesPane');
    const chatWithTitle = document.getElementById('chatWith');

    function renderConvos() {
      const db = DB.load();
      const users = new Set();
      db.messages.forEach(m => {
        if (m.from === u) users.add(m.to);
        if (m.to === u) users.add(m.from);
      });
      const me = db.users.find(x => x.user === u);
      (me.friends || []).forEach(f => users.add(f));
      convoList.innerHTML = '';
      if (users.size === 0) {
         convoList.innerHTML = '<div class="hint">Nenhuma conversa. Comece enviando uma mensagem para um amigo.</div>';
      }
      Array.from(users).forEach(other => {
        convoList.innerHTML += `<div class="post" onclick="openConversation('${other}')">${other}</div>`;
      });
    }

    window.openConversation = (other) => {
      localStorage.setItem('openChat', other);
      const db = DB.load();
      const msgs = db.messages.filter(m => (m.from === other && m.to === u) || (m.from === u && m.to === other)).sort((a,b)=>a.ts-b.ts);
      messagesPane.innerHTML = '';
      if (msgs.length === 0) {
         messagesPane.innerHTML = '<div class="hint" style="text-align:center">Diga olá!</div>';
      }
      msgs.forEach(m => {
        const cls = m.from === u ? 'message me' : 'message them';
        messagesPane.innerHTML += `<div class="${cls}"><b>${m.from}</b><div>${escapeHtml(m.text)}</div><small class="small">${new Date(m.ts).toLocaleString()}</small></div>`;
      });
      chatWithTitle.innerText = 'Conversa com ' + other;
      messagesPane.scrollTop = messagesPane.scrollHeight;
    };

    document.getElementById('btnSend').addEventListener('click', () => {
      const to = localStorage.getItem('openChat');
      if (!to) return alert('Selecione uma conversa');
      const text = document.getElementById('msgText').value.trim();
      if (!text) return;
      const db = DB.load();
      db.messages.push({ from: u, to, text, ts: Date.now() });
      DB.save(db);
      document.getElementById('msgText').value = '';
      openConversation(to);
      renderConvos();
    });

    // expose to global for clicking convos
    window.openConversation = window.openConversation;

    // initial
    renderConvos();
    const open = localStorage.getItem('openChat');
    if (open) openConversation(open);
  }

  /* ---------- Utility ---------- */
  function escapeHtml(str) {
    return String(str || '')
      .replace(/&/g, '&amp;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

}); // DOMContentLoaded end