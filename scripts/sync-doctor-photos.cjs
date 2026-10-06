// Put original portraits under images/ or assets/doctors/, set seedDoctors[].img in portal-config.js,
// then run: node scripts/sync-doctor-photos.cjs
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const root = path.resolve(__dirname, '..');
const context = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(root,'portal-config.js'),'utf8'),context);
const doctors = context.window.NARI_CONFIG.seedDoctors;
const esc = s => String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
for(const doctor of doctors) {
  if(doctor.img && !/^https:\/\//.test(doctor.img)) {
    if(!/^(?:assets\/doctors|images)\/[\w.-]+\.(webp|png|jpe?g)$/.test(doctor.img) || !fs.existsSync(path.join(root,doctor.img))) throw new Error('Missing local portrait: '+doctor.img);
  }
}
for(const file of fs.readdirSync(root).filter(f=>f.endsWith('.html'))) {
  const target=path.join(root,file); const original=fs.readFileSync(target,'utf8');
  let html=original.replace(/<article class="expert-card">[\s\S]*?<\/article>/g,card=>{
    const doctor=doctors.find(d=>card.includes(esc(d.name)));
    if(!doctor) return card;
    const initials=doctor.name.replace(/^Dr\.\s*/,'').split(/\s+/).map(n=>n[0]).slice(0,2).join('');
    const fallback=`<div class="expert-placeholder" role="img" aria-label="Photo unavailable for ${esc(doctor.name)}"><span>${esc(initials)}</span><small>Photo coming soon</small></div>`;
    const photo=doctor.img ? `<img src="${esc(doctor.img)}" alt="${esc(doctor.name)}, ${esc(doctor.role)}" width="320" height="320" loading="lazy" decoding="async" onerror="this.hidden=true;this.nextElementSibling.hidden=false" /><div hidden>${fallback}</div>` : fallback;
    return card.replace(/(<div class="expert-img-wrap">)[\s\S]*?(<span class="verified-badge">)/,(_,open,badge)=>open+photo+badge);
  });
  html=html.replace(/<script type="application\/ld\+json">(.*?)<\/script>/gs,(all,raw)=>{
    const data=JSON.parse(raw); const people=data.member || data.employee; if(!people)return all;
    for(const employee of people) {
      const doctor=doctors.find(d=>d.name===employee.name); if(!doctor)continue;
      if(doctor.img)employee.image=new URL(doctor.img,'https://narihealth.in/').href;
      else delete employee.image;
    }
    return '<script type="application/ld+json">'+JSON.stringify(data)+'</script>';
  });
  if(html!==original)fs.writeFileSync(target,html);
}
console.log('Doctor photo markup and structured data synchronized.');
