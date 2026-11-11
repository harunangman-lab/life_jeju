import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
import {webcrypto} from 'node:crypto';
const root=new URL('../',import.meta.url);
const source=Object.fromEntries(await Promise.all(['book-model.js','book-cloud.js','book.js'].map(async file=>[file,await readFile(new URL(file,root),'utf8')])));
function context(extra={}){const ctx=vm.createContext({window:{},crypto:webcrypto,Blob,URL,Intl,setTimeout,clearTimeout,atob,console,...extra});vm.runInContext(source['book-model.js'],ctx);ctx.window.jejuPhotos={validate(value){if(!/^data:image\/jpeg;base64,\/9j\/[A-Za-z0-9+/]*={0,2}$/.test(value)||value.length>800000)throw Error('Invalid JPEG');}};return ctx;}
const c=context(),M=c.window.jejuBookModel;
const original={id:'source-1',date:'2026-11-11',type:'산책',title:'원본',body:'숲의 빛',place:'제주',tags:['숲']};
const book=M.create(),copy=M.snapshot(original,'data:image/jpeg;base64,/9j/AA==');book.document.sections[1].articles.push(copy);M.validate(book);
copy.title='원고 수정';copy.tags.push('책');assert.equal(original.title,'원본');assert.deepEqual(original.tags,['숲']);original.body='원본 나중 수정';assert.equal(copy.body,'숲의 빛');
const clone=M.validate(book);clone.document.sections[1].articles[0].body='다른 복사본';assert.equal(copy.body,'숲의 빛');
const before=M.stats(book).characters;copy.body+='🌳';assert.equal(M.stats(book).characters,before+1);assert.equal(M.stats(book).count,1);
assert.equal(M.move(book.document.sections,-1,1),false);
const bad=M.clone(book);bad.document.sections[1].articles[0].photoData='data:image/svg+xml,<svg onload=alert(1)>';assert.throws(()=>M.validate(bad));
const duplicate=M.clone(book);duplicate.document.sections[1].id=duplicate.document.sections[0].id;assert.throws(()=>M.validate(duplicate));
const invalid=M.clone(book);invalid.document.sections.reverse();assert.throws(()=>M.validate(invalid));
const expanded=M.create();for(let i=0;i<105;i++)expanded.document.sections.splice(-1,0,M.chapter());
for(let i=0;i<1005;i++)expanded.document.sections[1].articles.push(M.article());
M.validate(expanded);assert.equal(M.stats(expanded).count,1005);
assert.equal(expanded.document.sections[1].articles[0].sourceId,'');

// Exercise the actual controller against asynchronous transactional storage.
const records=new Map();
const indexedDB={open(){const request={};setTimeout(()=>{request.result={close(){},createObjectStore(){},transaction(){const tx={};let aborted=false;tx.abort=()=>{aborted=true;setTimeout(()=>tx.onabort?.(),0);};tx.objectStore=()=>({get(key){const result={};setTimeout(()=>{result.result=records.has(key)?structuredClone(records.get(key)):undefined;result.onsuccess?.();setTimeout(()=>{if(!aborted)tx.oncomplete?.();},0);},0);return result;},put(value){records.set(value.scope,structuredClone(value));}});return tx;}};request.onsuccess?.();},0);return request;}};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
function controller(){
  const handlers={},elements=new Map();let renders=0;
  const document={addEventListener(name,fn){handlers[name]=fn;},querySelector(selector){if(!elements.has(selector))elements.set(selector,{textContent:'',innerHTML:'',classList:{toggle(){}},close(){},focus(){}});return elements.get(selector);}};
  const ctx=context({document,indexedDB});ctx.window.addEventListener=()=>{};
  let user=null,authChanged=()=>{};const remote=new Map(),saved=[];
  ctx.window.jejuBookCloud={configured:()=>false,init(fn){authChanged=fn;},get user(){return user;},async load(id){return remote.get(id)||null;},async save(owner,value){saved.push({owner,book:structuredClone(value)});const result=structuredClone(value);result.revision++;remote.set(owner,result);return result.revision;}};
  vm.runInContext(source['book.js'],ctx);
  return {api:ctx.window.jejuBook,ctx,elements,saved,remote,get renders(){return renders;},async init(){await this.api.init({getEntries:()=>[],notify(){},onChange(){renders++;}});},input(value){handlers.input({target:{dataset:{bookMeta:'title'},value}});},edit(dataset,value){handlers.input({target:{dataset,value}});},async click(id='',dataset={}){const button={id,dataset,hasAttribute:()=>false};await handlers.click({target:{closest:()=>button}});},switch(id){user=id?{id,email:id+'@example.test'}:null;authChanged(user);}};
}
const first=controller();await first.init();const renderCount=first.renders;first.input('기기에 보관한 책');assert.equal(await first.api.flush(),true);assert.equal(first.renders,renderCount,'Typing must not rebuild the editor');assert.equal(records.get('guest').book.meta.title,'기기에 보관한 책');
await first.click('book-add-chapter');await first.click('book-add-chapter');await first.api.flush();
const targetChapter=records.get('guest').book.document.sections[2].id;
for(let i=0;i<3;i++)await first.click('',{bookAddArticle:targetChapter});
await first.api.flush();let savedChapter=records.get('guest').book.document.sections[2];assert.equal(savedChapter.articles.length,3);
const firstArticle=savedChapter.articles[0].id;first.edit({bookField:'title',section:targetChapter,article:firstArticle},'직접 쓴 첫 꼭지');
await first.click('',{bookMove:'article',section:targetChapter,article:firstArticle,direction:'1'});await first.api.flush();
savedChapter=records.get('guest').book.document.sections[2];assert.equal(savedChapter.articles[1].title,'직접 쓴 첫 꼭지');assert.equal(records.get('guest').book.document.sections.length,5);
const second=controller();await second.init();assert.match(second.api.render(),/기기에 보관한 책/);first.input('먼저 저장');await first.api.flush();second.input('덮어쓰면 안 되는 글');assert.equal(await second.api.flush(),false);assert.equal(records.get('guest').book.meta.title,'먼저 저장');assert.match(second.elements.get('#book-save-status').textContent,/다른 창/);
// Changing accounts must immediately hide the previous user's editor, including on local save failure.
second.switch('user-a');assert.doesNotMatch(second.api.render(),/덮어쓰면 안 되는 글/);await delay(40);assert.doesNotMatch(second.api.render(),/먼저 저장/);second.input('A의 원고');await second.api.flush();await delay(1500);assert.equal(second.remote.get('user-a').meta.title,'A의 원고');assert.ok(second.saved.every(s=>s.owner==='user-a'));
second.switch('user-b');assert.doesNotMatch(second.api.render(),/A의 원고/);await delay(40);second.input('B의 원고');await second.api.flush();await delay(1500);assert.equal(second.remote.get('user-b').meta.title,'B의 원고');assert.equal(second.remote.get('user-a').meta.title,'A의 원고');assert.equal(records.get('user-b').book.revision,1);
second.switch(null);await delay(40);assert.match(second.api.render(),/덮어쓰면 안 되는 글/,'Failed local draft remains recoverable in its original scope');assert.doesNotMatch(second.api.render(),/B의 원고/);

// Exercise the cloud adapter using a mocked SDK boundary, not a real account.
let authCallback,rpcArgs,rpcError=null;const client={auth:{onAuthStateChange(fn){authCallback=fn;},async getSession(){return {data:{session:{user:{id:'owner'}}}};},async signInWithPassword(){return {data:{},error:null};}},async rpc(name,args){rpcArgs={name,args};return {data:2,error:rpcError};}};
const cloudContext=context({__sdk:{createClient:()=>client}});cloudContext.window.JEJU_SUPABASE_CONFIG={url:'https://example.supabase.co',publishableKey:'sb_publishable_test'};
vm.runInContext(source['book-cloud.js'].replace("await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm')",'__sdk'),cloudContext);
const cloud=cloudContext.window.jejuBookCloud;await cloud.init(()=>{});assert.equal(cloud.user.id,'owner');assert.equal(await cloud.save('owner',book),2);assert.equal(rpcArgs.name,'save_jeju_book');assert.equal(rpcArgs.args.p_expected_revision,0);await assert.rejects(()=>cloud.save('other',book));
rpcError={message:'BOOK_CONFLICT'};await assert.rejects(()=>cloud.save('owner',book),e=>e.conflict===true);authCallback('SIGNED_OUT',null);assert.equal(cloud.user,null);await assert.rejects(()=>cloud.save('owner',book));
console.log('Passed: independent snapshots, validation, Unicode counts, editor stability, persistence, multi-tab protection, account isolation, revision saves, SDK owner guard and conflict handling.');
