const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const pages=require('../routes.js');
const root=path.resolve(__dirname,'..');
function client(href, script='http://localhost:5500/routes.js') {
  const location=new URL(href);
  const context={URL,console,location,history:{replaceState(_a,_b,value){context.location=new URL(value,href);}},document:{currentScript:{src:script},baseURI:href,addEventListener(){}},addEventListener(){}};
  context.window=context;
  vm.createContext(context);vm.runInContext(fs.readFileSync(path.join(root,'routes.js'),'utf8'),context);
  context.document.baseURI=context.location.href;
  return context;
}
test('all known local pages use real files; parameters and fragments survive',()=>{
 for(const hostname of ['localhost','127.0.0.1','[::1]']){
  const origin=`http://${hostname}:5500`;
  const c=client(origin+'/',origin+'/routes.js');
  for(const page of pages){
   const mapped=c.NariRoutes.url(page+'?ref=NH-SUDHA&next=member#plans');
   assert.equal(new URL(mapped,origin).pathname, '/'+page+'.html');
   assert.equal(new URL(mapped,origin).search,'?ref=NH-SUDHA&next=member');
   assert.equal(new URL(mapped,origin).hash,'#plans');
   assert(fs.existsSync(path.join(root,page+'.html')));
  }
 }
});
test('local refresh stays on the real filename while production keeps canonical routes',()=>{
 const local=client('http://localhost:5500/member-login.html?next=member#form');
 assert.equal(local.location.pathname,'/member-login.html');
 for(const page of pages){
  const production=client('https://narihealth.in/'+page+'.html?x=1#part','https://narihealth.in/routes.js');
  const expected='/'+page.replace(/(^|\/)index$/,'$1');
  assert.equal(production.location.pathname,expected);
  assert.equal(production.location.search,'?x=1');assert.equal(production.location.hash,'#part');
 }
});
test('nested and subdirectory navigation resolves without changing external links or assets',()=>{
 const c=client('http://localhost:5500/nari/admin/index.html','http://localhost:5500/nari/routes.js');
 assert.equal(c.NariRoutes.url('console?as=abc'),'http://localhost:5500/nari/admin/console.html?as=abc');
 assert.equal(c.NariRoutes.url('../member?as=abc'),'http://localhost:5500/nari/member.html?as=abc');
 for(const href of ['#payments','../styles.css','mailto:trust@narihealth.in','tel:123','https://example.org/member','/outside/member']) assert.equal(c.NariRoutes.url(href),href);
});
test('login destinations allow only real pages for the current role',()=>{
 const cases=[['member','member'],['panel','panel'],['console','dev']];
 for(const [fallback,valid] of cases){
  const folder=fallback==='member'?'':fallback==='panel'?'doctor/':'admin/';
  const c=client('http://localhost:5500/'+folder+'index.html');
  c.NariPortal={waLink:()=>''};vm.runInContext(fs.readFileSync(path.join(root,'portal.js'),'utf8'),c);
  for(const value of ['https://example.org','//evil.test','../admin/console','missing','%E0%A4%A']){
   c.location.search='?next='+value;
   assert.equal(new URL(c.PortalUI.nextParam(fallback),c.document.baseURI).pathname,'/'+folder+fallback+'.html');
  }
  c.location.search='?next='+valid+'.html';
  assert.equal(new URL(c.PortalUI.nextParam(fallback),c.document.baseURI).pathname,'/'+folder+valid+'.html');
 }
});
test('every page loads routing before it can navigate',()=>{
 for(const page of pages){
  const html=fs.readFileSync(path.join(root,page+'.html'),'utf8');
  assert.match(html,/<script src="(?:\.\.\/)?routes\.js"><\/script>/);
  assert(!html.includes('Clean address bar:'));
 }
});
test('preview server resolves clean, HTML and directory routes and returns real 404s',async()=>{
 const {createServer}=require('../scripts/serve.cjs');const server=createServer();
 await new Promise((resolve,reject)=>{server.once('error',reject);server.listen(0,'127.0.0.1',resolve);});
 const base='http://127.0.0.1:'+server.address().port;
 try{
  for(const page of pages){
   for(const suffix of ['','.html','/']){
    const url=base+'/'+page+suffix+'?ref=NH-SUDHA';
    const response=await fetch(url);
    assert.equal(response.status,200,url);
    assert.equal(new URL(response.url).search,'?ref=NH-SUDHA');
    assert.match(response.headers.get('content-type'),/text\/html/);
    assert((await response.text()).includes('routes.js'));
   }
  }
  for(const page of ['/doctor','/admin','/','/routes.js','/styles.css','/assets/logo.webp'])assert.equal((await fetch(base+page)).status,200,page);
  for(const page of ['/missing','/missing.html','/.git/config','/package.json','/scripts/serve.cjs'])assert.equal((await fetch(base+page)).status,404,page);
  assert.equal((await fetch(base+'/member-login',{method:'HEAD'})).status,200);
  assert.equal((await fetch(base+'/member-login',{method:'POST'})).status,405);
 }finally{await new Promise(resolve=>server.close(resolve));}
});
