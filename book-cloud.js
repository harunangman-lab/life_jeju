'use strict';
window.jejuBookCloud=(()=>{
  let client=null,user=null,problem='';
  function configured(){const c=window.JEJU_SUPABASE_CONFIG;return Boolean(c?.url&&c?.publishableKey);}
  async function init(changed){
    if(!configured())return;
    try{
      const config=window.JEJU_SUPABASE_CONFIG,url=new URL(config.url),key=config.publishableKey;
      if(url.protocol!=='https:'||url.username||url.password||key.startsWith('sb_secret_'))throw Error('공개용 프로젝트 설정을 확인해 주세요.');
      if(!key.startsWith('sb_publishable_')){
        const payload=JSON.parse(atob(key.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')));
        if(payload.role!=='anon')throw Error('공개용 anon key만 사용할 수 있습니다.');
      }
      const {createClient}=await import('https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.119.0/+esm');
      client=createClient(url.origin,key,{auth:{storageKey:'jeju-one-book.auth.v1',persistSession:true,autoRefreshToken:true,detectSessionInUrl:true}});
      client.auth.onAuthStateChange((_event,session)=>{user=session?.user||null;setTimeout(()=>changed(user),0);});
      const result=await client.auth.getSession();if(result.error)throw result.error;user=result.data.session?.user||null;changed(user);
    }catch{problem='계정 저장에 연결하지 못했어요. 이 기기의 원고는 계속 보관됩니다.';changed(null);}
  }
  async function login(email,password,signup=false){
    if(!client)throw Error('계정 저장 연결을 확인해 주세요.');
    const result=signup?await client.auth.signUp({email,password}):await client.auth.signInWithPassword({email,password});
    if(result.error)throw Error(signup?'회원가입하지 못했어요. 이메일·비밀번호와 기존 가입 여부를 확인해 주세요.':'로그인하지 못했어요. 이메일·비밀번호와 이메일 인증 여부를 확인해 주세요.');
    return signup&&!result.data.session?'이메일로 받은 인증 링크를 확인한 뒤 로그인해 주세요.':'';
  }
  async function logout(){if(client){const result=await client.auth.signOut({scope:'local'});if(result.error)throw Error('로그아웃하지 못했어요.');}}
  async function load(owner){
    if(!client||user?.id!==owner)throw Error('로그인을 확인해 주세요.');
    const result=await client.from('jeju_books').select('id,title,subtitle,author,description,revision,updated_at').eq('user_id',owner).order('updated_at',{ascending:false}).limit(1).maybeSingle();
    if(result.error)throw Error('계정 원고를 불러오지 못했어요. 연결과 저장 설정을 확인해 주세요.');
    if(!result.data)return null;
    const manuscript=await client.from('jeju_book_manuscripts').select('document').eq('book_id',result.data.id).eq('user_id',owner).single();
    if(manuscript.error)throw Error('계정의 원고 본문을 불러오지 못했어요.');
    const row=result.data;return {id:row.id,revision:Number(row.revision),meta:{title:row.title,subtitle:row.subtitle,author:row.author,description:row.description},document:manuscript.data.document};
  }
  async function save(owner,book){
    if(!client||user?.id!==owner)throw Error('로그인이 바뀌어 계정 저장을 중단했어요.');
    const result=await client.rpc('save_jeju_book',{p_book_id:book.id,p_expected_revision:book.revision,p_metadata:book.meta,p_document:book.document});
    if(result.error){const error=Error(result.error.message?.includes('BOOK_CONFLICT')?'다른 기기에서 원고가 바뀌었어요. 이 기기 원고를 유지하며 계정 저장을 멈췄습니다.':'계정에 저장하지 못했어요. 이 기기의 원고는 보관됩니다.');error.conflict=result.error.message?.includes('BOOK_CONFLICT');throw error;}
    const revision=Number(result.data);if(!Number.isSafeInteger(revision)||revision<1)throw Error('계정 저장 응답을 확인하지 못했어요.');return revision;
  }
  return {configured,init,login,logout,load,save,get user(){return user;},get problem(){return problem;}};
})();
