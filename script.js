(() => {
  const cvs = document.getElementById('game');
  const ctx = cvs.getContext('2d');
  const DPR = window.devicePixelRatio || 1;
  function fit(){
    const ratio = 10/16;
    const w = Math.min(window.innerWidth * 0.95, 520);
    const h = w / ratio;
    cvs.style.width = w + 'px';
    cvs.style.height = h + 'px';
    cvs.width = Math.floor(w * DPR);
    cvs.height = Math.floor(h * DPR);
    ctx.setTransform(DPR,0,0,DPR,0,0);
  }
  fit(); addEventListener('resize', fit);

  const state = {
    running:false, paused:false, over:false,
    score:0, level:1, lives:3,
    input:{left:false, right:false},
    meteors:[], stars:[], particles:[],
    powerups:[],
    t:0, spawnM:0, spawnS:0, spawnP:0,
    slowMo: 0,
    shield: 0
  };

  const ship = {
    x:(cvs.width/DPR)/2, y:(cvs.height/DPR)*0.88, r:16, vx:0, speed:260,
    palette:{
      body:'#a78bfa', stroke:'#7c3aed',
      window:'#5eead4', windowStroke:'#14b8a6',
      fins:'#f472b6', finsStroke:'#be185d',
      flame:'#fb923c', flameStroke:'#ea580c'
    }
  };

  // Input
  addEventListener('keydown', e=>{
    if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A') state.input.left=true;
    if(e.key==='ArrowRight'||e.key==='d'||e.key==='D') state.input.right=true;
    if(e.key==='p'||e.key==='P') togglePause();
    if(e.key===' ' && state.over) restart(true);
  });
  addEventListener('keyup', e=>{
    if(e.key==='ArrowLeft'||e.key==='a'||e.key==='A') state.input.left=false;
    if(e.key==='ArrowRight'||e.key==='d'||e.key==='D') state.input.right=false;
  });
  cvs.addEventListener('touchstart', e=>{
    const rect=cvs.getBoundingClientRect();
    for(const t of e.touches){
      if(t.clientX < rect.left + rect.width/2){ state.input.left=true; state.input.right=false; }
      else { state.input.right=true; state.input.left=false; }
    }
  }, {passive:true});
  cvs.addEventListener('touchend', ()=>{ state.input.left=false; state.input.right=false; });

  document.getElementById('btnPause').onclick = togglePause;
  document.getElementById('btnRestart').onclick = ()=> restart(true);
  function togglePause(){ if(state.running){ state.paused = !state.paused; } }

  // Utils
  const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
  const rnd=(a,b)=>a+Math.random()*(b-a);
  const hit=(a,b)=>{ const dx=a.x-b.x,dy=a.y-b.y,rr=a.r+b.r; return dx*dx+dy*dy <= rr*rr; };

  // Particles (sparks)
  function spawnSparks(x,y,color='#fbbf24'){
    for(let i=0;i<12;i++){
      state.particles.push({ x, y, r:2, vx:rnd(-90,90), vy:rnd(-140,-20), life:rnd(0.3,0.6), age:0, color });
    }
  }

  function spawnPowerup(){
    const w=cvs.width/DPR;
    const type = Math.random()<0.6 ? 'shield' : 'slow';
    state.powerups.push({ type, x:rnd(18,w-18), y:-14, r:12, vy:rnd(70,100) });
  }

  function restart(force=false){
    const w=cvs.width/DPR, h=cvs.height/DPR;
    Object.assign(state,{
      running:true, paused:false, over:false,
      score:0, level:1, lives:3,
      meteors:[], stars:[], particles:[], powerups:[],
      t:0, spawnM:0, spawnS:0, spawnP:0,
      slowMo:0, shield:0
    });
    ship.x = w/2; ship.y = h*0.88; ship.vx=0;
    if(force){ last=performance.now(); loop(last); }
  }

  let last=performance.now();
  function loop(now){
    let dt=Math.min(0.033, (now-last)/1000); last=now;
    const slowFactor = state.slowMo>0 ? 0.45 : 1;
    dt *= slowFactor;
    if(state.running && !state.paused) update(dt);
    draw();
    requestAnimationFrame(loop);
  }

  function update(dt){
    const w=cvs.width/DPR, h=cvs.height/DPR;
    state.t += dt; state.spawnM += dt; state.spawnS += dt; state.spawnP += dt;
    if(state.slowMo>0) state.slowMo = Math.max(0, state.slowMo - dt);
    if(state.shield>0) state.shield = Math.max(0, state.shield - dt);

    const mInterval=Math.max(0.22, 0.92 - state.level*0.08);
    if(state.spawnM>=mInterval){
      state.spawnM=0;
      const r=rnd(10,24);
      state.meteors.push({x:rnd(r,w-r), y:-r, r, vy:rnd(120,180)+state.level*24});
    }
    if(state.spawnS>=1.05){
      state.spawnS=0;
      state.stars.push({x:rnd(8,w-8), y:-8, r:8, vy:rnd(90,130)});
    }
    if(state.spawnP>=6.0){
      state.spawnP=0; spawnPowerup();
    }

    ship.vx=0;
    if(state.input.left)  ship.vx -= ship.speed;
    if(state.input.right) ship.vx += ship.speed;
    ship.x = clamp(ship.x + ship.vx*dt, ship.r, w-ship.r);

    state.meteors.forEach(m=> m.y += m.vy*dt);
    state.stars.forEach(s=> s.y += s.vy*dt);
    state.powerups.forEach(p=> p.y += p.vy*dt);

    for(let i=state.particles.length-1;i>=0;i--){
      const p=state.particles[i];
      p.age += dt; p.x += p.vx*dt; p.y += p.vy*dt; p.vy += 200*dt;
      p.r *= 0.98;
      if(p.age>=p.life || p.r<0.5) state.particles.splice(i,1);
    }

    for(let i=state.meteors.length-1;i>=0;i--){
      const m=state.meteors[i];
      if(m.y - m.r > h){ state.meteors.splice(i,1); continue; }
      if(hit({x:ship.x,y:ship.y,r:ship.r}, m)){
        state.meteors.splice(i,1);
        if(state.shield>0){
          state.shield = 0;
          spawnSparks(ship.x, ship.y, '#93c5fd');
        }else{
          state.lives--;
          if(state.lives<=0){ state.over=true; state.running=false; return; }
        }
      }
    }
    for(let i=state.stars.length-1;i>=0;i--){
      const s=state.stars[i];
      if(s.y - s.r > h){ state.stars.splice(i,1); continue; }
      if(hit({x:ship.x,y:ship.y,r:ship.r}, s)){
        state.stars.splice(i,1);
        state.score += 12;
        spawnSparks(s.x, s.y, '#fbbf24');
        if(navigator.vibrate) navigator.vibrate(15);
      }
    }
    for(let i=state.powerups.length-1;i>=0;i--){
      const p=state.powerups[i];
      if(p.y - p.r > h){ state.powerups.splice(i,1); continue; }
      if(hit({x:ship.x,y:ship.y,r:ship.r}, p)){
        state.powerups.splice(i,1);
        if(p.type==='shield'){ state.shield = 6; }
        if(p.type==='slow'){ state.slowMo = 4; }
        spawnSparks(ship.x, ship.y, p.type==='shield' ? '#93c5fd' : '#86efac');
        if(navigator.vibrate) navigator.vibrate(25);
      }
    }

    state.score += Math.floor(14*dt*(state.slowMo>0?0.7:1));
    state.level = 1 + Math.floor((state.score + state.t*30)/180);
  }

  function nebulaBG(w,h){
    const rad = ctx.createRadialGradient(w*0.25,h*0.3, 10, w*0.25,h*0.3, w*0.7);
    rad.addColorStop(0,'rgba(168,85,247,0.18)');
    rad.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=rad; ctx.fillRect(0,0,w,h);
    const rad2 = ctx.createRadialGradient(w*0.78,h*0.65, 10, w*0.78,h*0.65, w*0.6);
    rad2.addColorStop(0,'rgba(14,165,233,0.15)');
    rad2.addColorStop(1,'rgba(0,0,0,0)');
    ctx.fillStyle=rad2; ctx.fillRect(0,0,w,h);
  }

  const starLayers = [
    { n:60, speed:12, stars:[] },
    { n:40, speed:24, stars:[] },
    { n:25, speed:42, stars:[] }
  ];
  function initStars(){
    const w=cvs.width/DPR, h=cvs.height/DPR;
    starLayers.forEach((L,i)=>{
      L.stars = Array.from({length:L.n}, ()=>({ x:rnd(0,w), y:rnd(0,h), s:(i+1), tw:rnd(0,6.28) }));
    });
  }
  initStars();

  function drawStars(w,h,dt){
    starLayers.forEach(L=>{
      ctx.fillStyle='rgba(255,255,255,0.7)';
      L.stars.forEach(st=>{
        st.y += L.speed*dt*(state.slowMo>0?0.5:1);
        if(st.y>h) st.y -= h;
        st.tw += dt*2; const a = 0.6 + Math.sin(st.tw)*0.25;
        ctx.globalAlpha = a;
        ctx.fillRect(st.x, st.y, st.s*0.9, st.s*0.9);
        ctx.globalAlpha = 1;
      });
    });
  }

  function drawShip(ctx, P, t){
    const pal = ship.palette;
    ctx.save();
    ctx.translate(P.x, P.y);
    const tilt = Math.max(-0.35, Math.min(0.35, P.vx/300));
    ctx.rotate(tilt);

    if(state.shield>0){
      const pulse = 0.6 + 0.4*Math.sin(t*6);
      ctx.beginPath();
      ctx.arc(0,0, P.r*1.55, 0, Math.PI*2);
      ctx.fillStyle = `rgba(147,197,253,${0.18*pulse})`;
      ctx.fill();
    }

    ctx.globalAlpha = 0.15;
    ctx.beginPath(); ctx.ellipse(0, P.r+6, P.r*1.3, P.r*0.5, 0, 0, Math.PI*2);
    ctx.fillStyle = '#000'; ctx.fill(); ctx.globalAlpha = 1;

    ctx.beginPath();
    ctx.moveTo(0, -P.r*1.6);
    ctx.bezierCurveTo(P.r*0.9, -P.r, P.r*0.9, P.r*0.3, 0, P.r*1.4);
    ctx.bezierCurveTo(-P.r*0.9, P.r*0.3, -P.r*0.9, -P.r, 0, -P.r*1.6);
    ctx.closePath();
    ctx.fillStyle = pal.body; ctx.fill();
    ctx.lineWidth = 1.2; ctx.strokeStyle = pal.stroke; ctx.stroke();

    ctx.beginPath();
    ctx.ellipse(0, -P.r*0.5, P.r*0.55, P.r*0.42, 0, 0, Math.PI*2);
    ctx.fillStyle = pal.window; ctx.fill();
    ctx.strokeStyle = pal.windowStroke; ctx.stroke();

    ctx.fillStyle = pal.fins; ctx.strokeStyle = pal.finsStroke;
    ctx.beginPath();
    ctx.moveTo(P.r*0.9, -P.r*0.1);
    ctx.lineTo(P.r*1.5, P.r*0.6);
    ctx.lineTo(P.r*0.5, P.r*0.8);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(-P.r*0.9, -P.r*0.1);
    ctx.lineTo(-P.r*1.5, P.r*0.6);
    ctx.lineTo(-P.r*0.5, P.r*0.8);
    ctx.closePath(); ctx.fill(); ctx.stroke();

    const flame = P.r * (0.9 + 0.25 * Math.sin(t*20));
    ctx.beginPath();
    ctx.moveTo(0, P.r*1.4);
    ctx.quadraticCurveTo(P.r*0.5, P.r*1.8, 0, P.r*2.2 + flame*0.1);
    ctx.quadraticCurveTo(-P.r*0.5, P.r*1.8, 0, P.r*1.4);
    ctx.fillStyle = pal.flame; ctx.fill();
    ctx.lineWidth = 1; ctx.strokeStyle = pal.flameStroke; ctx.stroke();

    ctx.restore();
  }

  function draw(){
    const w=cvs.width/DPR, h=cvs.height/DPR;
    const g = ctx.createLinearGradient(0,0,0,h);
    g.addColorStop(0,'#0f172a'); g.addColorStop(1,'#0b1020');
    ctx.fillStyle=g; ctx.fillRect(0,0,w,h);

    nebulaBG(w,h);
    drawStars(w,h,0.016);

    state.meteors.forEach(m=>{ ctx.beginPath(); ctx.fillStyle='#f87171'; ctx.arc(m.x,m.y,m.r,0,Math.PI*2); ctx.fill(); });
    state.stars.forEach(s=>{ ctx.beginPath(); ctx.fillStyle='#fbbf24'; ctx.arc(s.x,s.y,s.r,0,Math.PI*2); ctx.fill(); });
    state.powerups.forEach(p=>{
      ctx.beginPath();
      if(p.type==='shield'){ ctx.strokeStyle='#93c5fd'; ctx.fillStyle='rgba(147,197,253,0.15)'; }
      else { ctx.strokeStyle='#86efac'; ctx.fillStyle='rgba(134,239,172,0.15)'; }
      ctx.lineWidth=2; ctx.arc(p.x,p.y,p.r,0,Math.PI*2); ctx.fill(); ctx.stroke();
      ctx.font='10px system-ui'; ctx.fillStyle='#e5e7eb';
      ctx.textAlign='center'; ctx.fillText(p.type==='shield'?'⛨':'⏵', p.x, p.y+3);
      ctx.textAlign='start';
    });

    state.particles.forEach(pt=>{
      ctx.beginPath(); ctx.fillStyle=pt.color;
      ctx.globalAlpha = Math.max(0, 1 - pt.age/pt.life);
      ctx.arc(pt.x,pt.y,pt.r,0,Math.PI*2); ctx.fill(); ctx.globalAlpha=1;
    });

    drawShip(ctx, ship, state.t);

    ctx.fillStyle='#e5e7eb'; ctx.font='14px system-ui';
    ctx.fillText('Score: '+state.score, 12, 22);
    ctx.fillText('Level: '+state.level, 12, 40);
    ctx.fillText('Lives: '+state.lives + (state.shield>0?' (+Shield)':''), w-160, 22);
    if(state.slowMo>0){
      ctx.fillStyle='#93c5fd'; ctx.fillText('Slow‑Mo '+state.slowMo.toFixed(1)+'s', w-160, 40);
      ctx.fillStyle='#e5e7eb';
    }

    if(state.paused){
      ctx.fillStyle='rgba(2,6,23,0.55)'; ctx.fillRect(0,0,w,h);
      ctx.fillStyle='#e5e7eb'; ctx.font='bold 24px system-ui'; ctx.textAlign='center';
      ctx.fillText('מושהה', w/2, h/2); ctx.textAlign='start';
    }
    if(state.over){
      ctx.fillStyle='rgba(2,6,23,0.6)'; ctx.fillRect(0,0,w,h);
      ctx.fillStyle='#e5e7eb'; ctx.font='bold 26px system-ui'; ctx.textAlign='center';
      ctx.fillText('Game Over — רווח/משחק חדש', w/2, h*0.45); ctx.textAlign='start';
    }
  }

  addEventListener('load', ()=>{ fit(); setTimeout(()=>restart(true), 30); });
})();