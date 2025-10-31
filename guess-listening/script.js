/* Guess what I'm listening — v2.2
   - Story export (1080x1920)
   - Only-covers mode
   - Decade roulette (now includes 40s/50s/60s)
   - Crowd cheer SFX on correct guess
   - Guess-mode blur of title/artist until correct
   - Separate Play / Pause buttons
   - Buy Me a Coffee button (+ pulse on correct guess)
*/

const els = {
  title: document.getElementById('title'),
  artist: document.getElementById('artist'),
  titleWrap: document.getElementById('titleWrap'),
  cover: document.getElementById('cover'),
  eq: document.getElementById('eq'),
  audio: document.getElementById('audio'),

  btnRandom: document.getElementById('btnRandom'),
  btnNext: document.getElementById('btnNext'),
  btnPlay: document.getElementById('btnPlay'),
  btnPause: document.getElementById('btnPause'),
  btnCopy: document.getElementById('btnCopy'),
  btnShare: document.getElementById('btnShare'),
  btnDownload: document.getElementById('btnDownload'),
  btnDownloadStory: document.getElementById('btnDownloadStory'),
  btnCoffee: document.getElementById('btnCoffee'),

  toggleGuess: document.getElementById('toggleGuess'),
  toggleOnlyCovers: document.getElementById('toggleOnlyCovers'),

  guessBox: document.getElementById('guessBox'),
  choices: document.getElementById('choices'),
  result: document.getElementById('result'),

  vibe: document.getElementById('vibe'),
  decade: document.getElementById('decade'),
  canvas: document.getElementById('canvas')
};

let current = null;
let lastPool = [];
let audioCtx = null; // for cheer SFX

function ensureAudioCtx(){
  if (!audioCtx) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    audioCtx = new Ctx();
  }
}

/* ---------- Buy Me a Coffee helpers ---------- */
const BMC_URL_BASE = "https://buymeacoffee.com/guesswhatimlisteningto";
function bmcUrl(reason = "app"){
  try {
    const u = new URL(BMC_URL_BASE);
    u.searchParams.set("utm_source","app");
    u.searchParams.set("utm_medium","button");
    u.searchParams.set("utm_campaign", reason);
    return u.toString();
  } catch {
    return BMC_URL_BASE;
  }
}
function openCoffee(reason){
  window.open(bmcUrl(reason), "_blank", "noopener");
}

/* ---------- Decade roulette helpers ---------- */
const decadeSeeds = {
  "1940": ["big band","swing","vocal jazz","boogie-woogie","crooner"],
  "1950": ["rock and roll","doo-wop","skiffle","blues","country"],
  "1960": ["psychedelic rock","motown","british invasion","folk rock","soul"],
  "1970": ["disco","funk","classic rock","soul","soft rock"],
  "1980": ["synthpop","new wave","hair metal","post-punk","boogie"],
  "1990": ["alt rock","britpop","grunge","eurodance","boom bap"],
  "2000": ["indie rock","rnb","pop punk","electro house","trance"],
  "2010": ["trap","future bass","edm","indietronica","tropical house"],
  "2020": ["hyperpop","afrobeats","bedroom pop","lofi","drill"]
};
function randItem(arr){return arr[Math.floor(Math.random()*arr.length)]}
function randomSeed(){
  const letters = 'abcdefghijklmnopqrstuvwxyz';
  const generic = ['love','night','dream','dance','heart','moon','fire','star','city','lane','blue','gold','wild'];
  return Math.random() < 0.55 ? randItem(generic) : letters[Math.floor(Math.random()*letters.length)];
}
function weightedSeed(decadeValue){
  if (!decadeValue) return randomSeed();
  const seeds = decadeSeeds[decadeValue];
  return Math.random() < 0.7 ? randItem(seeds) : randomSeed(); // 70% decade vibe, 30% generic
}

/* ---------- Fetching tracks (with decade post-filter) ---------- */
async function fetchRandomTrack(vibe='', decadeValue=''){
  const seed = vibe || weightedSeed(decadeValue);
  const term = encodeURIComponent(seed);
  const limit = 50;
  const url = `https://itunes.apple.com/search?term=${term}&entity=song&limit=${limit}`;
  const res = await fetch(url);
  const data = await res.json();
  let pool = (data?.results || [])
    .filter(x => x.trackName && x.artistName && (x.artworkUrl100 || x.artworkUrl60));

  if (decadeValue) {
    const start = parseInt(decadeValue, 10);
    const end = start + 9;
    const filtered = pool.filter(x => {
      const y = +(x.releaseDate?.slice(0,4) || 0);
      return y >= start && y <= end;
    });
    if (filtered.length >= 6) pool = filtered; // keep variety
  }

  if (!pool.length) throw new Error('No tracks found.');
  lastPool = pool;
  return randItem(pool);
}

function artwork512(url){
  return url ? url.replace(/100x100bb.jpg/, '512x512bb.jpg').replace(/60x60bb.jpg/,'512x512bb.jpg') : '';
}

function updateUIFromTrack(t){
  current = {
    title: t.trackName,
    artist: t.artistName,
    artwork: artwork512(t.artworkUrl100 || t.artworkUrl60),
    preview: t.previewUrl || ''
  };
  els.title.textContent = current.title;
  els.artist.textContent = current.artist;
  els.cover.src = current.artwork || '';
  els.audio.src = current.preview || '';
  els.eq.style.visibility = current.preview ? 'visible' : 'hidden';

  // If there is no preview, make play/pause inert
  const hasPreview = !!current.preview;
  els.btnPlay.disabled = !hasPreview;
  els.btnPause.disabled = !hasPreview;
}

/* Hide or reveal title/artist and enable/disable share actions */
function setGuessUIHidden(isHidden){
  if (isHidden) {
    els.titleWrap.classList.add('blur');
    els.btnCopy.disabled = true;
    els.btnShare.disabled = true;
    els.btnDownload.disabled = true;
    els.btnDownloadStory.disabled = true;
  } else {
    els.titleWrap.classList.remove('blur');
    els.btnCopy.disabled = false;
    els.btnShare.disabled = false;
    els.btnDownload.disabled = false;
    els.btnDownloadStory.disabled = false;
  }
}

async function surprise(){
  setLoading(true);
  els.result.textContent = '';
  try{
    const t = await fetchRandomTrack(els.vibe.value.trim(), els.decade.value);
    updateUIFromTrack(t);

    // Hide the title/artist while guessing; show otherwise
    setGuessUIHidden(els.toggleGuess.checked);

    if (els.toggleGuess.checked) {
      await setupGuessRound(t);
    } else {
      els.guessBox.classList.add('hidden');
    }
  }catch(e){
    console.error(e);
    fallbackUI('Could not fetch a track. Try again.');
  }finally{
    setLoading(false);
  }
}

function fallbackUI(msg){
  els.title.textContent = msg || 'Oops.';
  els.artist.textContent = 'Network gremlins are dancing.';
  els.cover.src = '';
  els.audio.removeAttribute('src');
  els.btnPlay.disabled = true;
  els.btnPause.disabled = true;
}

function setLoading(is){
  els.btnRandom.disabled = els.btnNext.disabled = is;
  els.btnRandom.textContent = is ? 'Loading…' : '🎲 Surprise me';
}

/* ---------- Preview controls ---------- */
function playPreview(){
  if (!els.audio.src) return;
  els.audio.play().catch(()=>{});
  els.eq.classList.add('playing');
}
function pausePreview(){
  if (!els.audio.src) return;
  els.audio.pause();
  els.eq.classList.remove('playing');
}
els.audio.addEventListener('ended', ()=> {
  els.eq.classList.remove('playing');
});

/* ---------- Guess mode with cheer SFX ---------- */
async function setupGuessRound(answer){
  let pool = lastPool.filter(x => x.trackId !== answer.trackId);
  if (pool.length < 2) {
    const more = await fetchRandomTrack(els.vibe.value.trim(), els.decade.value);
    pool = pool.concat(lastPool.filter(x => x.trackId !== answer.trackId));
  }
  const distractors = [];
  while (distractors.length < 2 && pool.length){
    const pick = pool.splice(Math.floor(Math.random()*pool.length),1)[0];
    if (pick && pick.trackName && pick.artistName) distractors.push(pick);
  }
  const options = [answer, ...distractors].sort(()=>Math.random()-0.5);
  els.choices.innerHTML = '';
  els.result.textContent = '';
  options.forEach(opt=>{
    const btn = document.createElement('button');
    btn.className = 'choice';
    btn.textContent = `${opt.trackName} — ${opt.artistName}`;
    btn.addEventListener('click', ()=>{
      const correct = opt.trackId === answer.trackId;
      btn.classList.add(correct ? 'correct' : 'wrong');
      els.result.textContent = correct ? '✅ Nice ears!' : `❌ Nope — it was “${answer.trackName}” by ${answer.artistName}.`;
      document.getElementById('card').style.animation = 'pulse .6s ease';
      setTimeout(()=>document.getElementById('card').style.animation='', 650);
      if (correct) {
        setGuessUIHidden(false); // reveal and re-enable actions
        playCheer();
        // Nudge the coffee button
        if (els.btnCoffee) {
          els.btnCoffee.classList.add('pulse');
          setTimeout(()=> els.btnCoffee.classList.remove('pulse'), 1200);
        }
      }
    });
    els.choices.appendChild(btn);
  });
  els.guessBox.classList.remove('hidden');
}

/* ---------- Cheer SFX (WebAudio; no external files) ---------- */
function playCheer(){
  try{
    ensureAudioCtx();
    const dur = 1.2;
    const now = audioCtx.currentTime;

    // Crowd-ish noise: two oscillators + envelope
    const oscA = audioCtx.createOscillator();
    const oscB = audioCtx.createOscillator();
    const g = audioCtx.createGain();
    oscA.type = 'sawtooth'; oscB.type = 'triangle';
    oscA.frequency.value = 220; oscB.frequency.value = 180;
    oscB.detune.value = +50;
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(0.25, now + 0.08);
    g.gain.exponentialRampToValueAtTime(0.001, now + dur);

    oscA.connect(g); oscB.connect(g); g.connect(audioCtx.destination);
    oscA.start(now); oscB.start(now);
    oscA.stop(now + dur); oscB.stop(now + dur);

    // Handclap noise burst
    const clapDur = 0.25;
    const bufferSize = audioCtx.sampleRate * clapDur;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i=0;i<bufferSize;i++) data[i] = (Math.random()*2-1) * (1 - i/bufferSize);
    const clap = audioCtx.createBufferSource(); clap.buffer = buffer;
    const cg = audioCtx.createGain();
    cg.gain.setValueAtTime(0.8, now + 0.05);
    cg.gain.exponentialRampToValueAtTime(0.001, now + 0.05 + clapDur);
    clap.connect(cg); cg.connect(audioCtx.destination);
    clap.start(now + 0.05);
  }catch(_){}
}

/* ---------- Copy / Share ---------- */
async function copyText(){
  const txt = current ? `Now listening: ${current.title} — ${current.artist}` : 'Guess what I’m listening to?';
  try{
    await navigator.clipboard.writeText(txt);
    flash('Copied!');
  }catch(e){
    flash('Copy failed.');
  }
}
async function shareNow(){
  const txt = current ? `Now listening: ${current.title} — ${current.artist}` : 'Guess what I’m listening to?';
  if (navigator.share){
    try{ await navigator.share({text: txt}); }catch(_){}
  } else {
    copyText();
  }
}
function flash(msg){
  els.result.textContent = msg;
  setTimeout(()=>{ if (els.result.textContent === msg) els.result.textContent=''; }, 1500);
}

/* ---------- Canvas exports (Card + Story) ---------- */
async function downloadCard(){
  await exportCanvas({
    w: 1200, h: 630,
    filename: 'now-listening.png',
    includeText: !els.toggleOnlyCovers?.checked
  });
}
async function downloadStory(){
  await exportCanvas({
    w: 1080, h: 1920,
    filename: 'now-listening-story.png',
    includeText: !els.toggleOnlyCovers?.checked,
    storySafe: true
  });
}

async function exportCanvas({w, h, filename, includeText=true, storySafe=false}){
  const c = els.canvas, ctx = c.getContext('2d');
  c.width = w; c.height = h;

  // Background gradient
  const g = ctx.createLinearGradient(0,0,w,h);
  g.addColorStop(0,'#0b0f14'); g.addColorStop(1,'#142238');
  ctx.fillStyle = g; ctx.fillRect(0,0,w,h);

  // Cover
  let drewImage = false;
  if (current?.artwork){
    try{
      const img = new Image(); img.crossOrigin = 'anonymous'; img.src = current.artwork;
      await img.decode();
      const ratio = storySafe ? 0.85 : 0.70;
      const sz = Math.min(w, h) * ratio;
      const x = (w - sz)/2;
      const y = storySafe ? Math.max(40, h*0.07) : (h - sz)/2;
      roundImage(ctx, img, x, y, sz, sz, storySafe ? 40 : 24);
      drewImage = true;
    }catch(e){ /* ignore */ }
  }

  if (includeText){
    ctx.fillStyle = '#e9f1ff';
    ctx.textBaseline = 'top';
    const padX = storySafe ? 72 : (drewImage ? 60 : 120);
    const topY = storySafe ? Math.round(h*0.72) : 120;

    ctx.font = storySafe ? 'bold 56px system-ui, -apple-system, Segoe UI, Roboto'
                         : 'bold 52px system-ui, -apple-system, Segoe UI, Roboto';
    ctx.fillText('Now listening', padX, topY);

    ctx.font = 'bold 72px system-ui, -apple-system, Segoe UI, Roboto';
    const title = current?.title || 'Something random';
    wrapText(ctx, title, padX, topY + 80, w - padX*2, storySafe ? 76 : 72);

    ctx.font = '32px system-ui, -apple-system, Segoe UI, Roboto';
    const artist = current?.artist || '???';
    wrapText(ctx, 'by ' + artist, padX, topY + 80 + 110, w - padX*2, 38);
  }

  const url = c.toDataURL('image/png');
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  a.click();
}

function roundImage(ctx, img, x, y, w, h, r){
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
  ctx.clip();
  ctx.drawImage(img,x,y,w,h);
  ctx.restore();
}
function wrapText(ctx, text, x, y, maxWidth, lineHeight){
  const words = (text || '').split(' ');
  let line = '', yy = y;
  for (let n=0;n<words.length;n++){
    const test = line + words[n] + ' ';
    if (ctx.measureText(test).width > maxWidth && n>0){
      ctx.fillText(line, x, yy); line = words[n] + ' '; yy += lineHeight;
    } else line = test;
  }
  ctx.fillText(line, x, yy);
}

/* ---------- Only-covers UI toggle ---------- */
function applyOnlyCovers(){
  if (els.toggleOnlyCovers && els.toggleOnlyCovers.checked) {
    document.body.classList.add('only-covers');
  } else {
    document.body.classList.remove('only-covers');
  }
}

/* ---------- Events ---------- */
els.btnRandom.addEventListener('click', surprise);
els.btnNext.addEventListener('click', surprise);
els.btnPlay.addEventListener('click', playPreview);
els.btnPause.addEventListener('click', pausePreview);
els.btnCopy.addEventListener('click', copyText);
els.btnShare.addEventListener('click', shareNow);
els.btnDownload.addEventListener('click', downloadCard);
els.btnDownloadStory.addEventListener('click', downloadStory);
if (els.btnCoffee) els.btnCoffee.addEventListener('click', () => openCoffee("tip_button"));
if (els.toggleOnlyCovers) els.toggleOnlyCovers.addEventListener('change', applyOnlyCovers);
document.addEventListener('keydown', (e)=>{ 
  if (e.key === ' ') { e.preventDefault(); (els.audio.paused ? playPreview() : pausePreview()); } 
});

/* First paint placeholder cover */
els.cover.src = 'data:image/svg+xml;utf8,' + encodeURIComponent(`
<svg xmlns='http://www.w3.org/2000/svg' width='600' height='600'>
  <defs><linearGradient id='g' x1='0' y1='0' x2='1' y2='1'>
    <stop offset='0%' stop-color='#0b0f14'/><stop offset='100%' stop-color='#142238'/>
  </linearGradient></defs>
  <rect width='100%' height='100%' fill='url(#g)'/>
  <text x='50%' y='50%' dominant-baseline='middle' text-anchor='middle' fill='#9bb2c7' font-family='Arial' font-size='26'>Tap Surprise me</text>
</svg>`);

/* Apply toggle state on load (in case browser restores checkbox state) */
applyOnlyCovers();
