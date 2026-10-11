// Creates and deletes only this run's disposable accounts and fixtures.
import {mkdir, writeFile} from 'node:fs/promises';
import {randomBytes} from 'node:crypto';
import assert from 'node:assert/strict';
if (!process.argv.includes('--create-and-delete-test-accounts')) throw new Error('Explicit disposable-account flag required.');
const base='https://yellowgreen-woodpecker-591324.hostingersite.com/wp-json';
const stamp=Date.now(); const report=`mobile/.cache/account-privacy-${stamp}.json`;
const state={accounts:[],lists:[],products:[],checks:[],cleanup:[]};
await mkdir('mobile/.cache',{recursive:true});
const save=()=>writeFile(report,JSON.stringify(state,null,2),{mode:0o600});
function check(ok,label){assert.ok(ok,label);state.checks.push(label);console.log('PASS '+label);}
async function api(path,actor=null,method='GET',body){
 const r=await fetch(base+path,{method,redirect:'error',signal:AbortSignal.timeout(45000),headers:{'Content-Type':'application/json',...(actor?{Authorization:`Bearer ${actor.token}`}:{})},...(body===undefined?{}:{body:JSON.stringify(body)})});
 let data;try{data=await r.json();}catch{throw new Error(`${path}: invalid response HTTP ${r.status}`);}return{status:r.status,data};
}
function status(r,n,label){check(r.status===n,`${label} (HTTP ${r.status})`);}
async function guest(label){const r=await api('/custom/v1/create-user',null,'POST',{});status(r,200,'Create '+label);const a={label,id:r.data.user_id,token:r.data.token,ticket:r.data.username};state.accounts.push(a);await save();return a;}
async function list(a){const r=await api('/wp/v2/shopping-list',a,'POST',{title:`Privacy rehearsal ${a.label} ${stamp}`,status:'publish',acf:{owner_id:999999,owner_token:'must-not-be-persisted'}});status(r,201,'Create '+a.label+' list');check(Number(r.data.acf.owner_id)===a.id,'Server assigns list owner from session');const l={id:r.data.id,actor:a.label};state.lists.push(l);await save();return l;}
async function product(a){const r=await api('/custom/v1/create-custom-product',a,'POST',{title:`Privacy test ${a.label} ${stamp}`});status(r,200,'Create '+a.label+' product');const p={id:r.data.id,actor:a.label};state.products.push(p);await save();return p;}
async function share(owner,l,member){const invite=await api('/custom/v1/generate-share-code',owner,'POST',{list_id:l.id});status(invite,200,'Create expiring invitation');check(invite.data.code.length===24&&invite.data.expires_at>Date.now()/1000,'Invitation has strong code and future expiry');status(await api('/custom/v1/accept-shared-list',member,'POST',{list_id:l.id,user_id:member.id,code:invite.data.code}),200,'Accept invitation');return invite.data.code;}
async function removeAccount(a){const r=await api('/custom/v1/delete-my-account',a,'POST',{account_id:a.id,confirmation:'DELETE MY LISTA ACCOUNT'});if(r.status===200&&r.data.deleted===true){a.deleted=true;await save();}return r;}
try{
 const a=await guest('A'),b=await guest('B'),c=await guest('C');
 const la=await list(a),lb=await list(b),lc=await list(c);const pa=await product(a),pb=await product(b),pc=await product(c);
 for(const path of ['/custom/v1/google-auth','/custom/v1/link-google-account']) status(await api(path,null,'POST',{email:'nobody@example.invalid',google_id:'unverified'}),403,'Unverified Google identity rejected');
 status(await api('/wp/v2/posts',a,'POST',{title:`Denied privacy test ${stamp}`,status:'draft'}),403,'Guest has no WordPress editorial privileges');
 status(await api('/wp/v2/users',a),403,'User enumeration blocked');
 status(await api('/wp/v2/custom-product/'+pb.id,a),403,'Native private-product read blocked');
 status(await api('/wp/v2/shopping-list/'+lb.id,a),403,'Native unrelated list read blocked');
 status(await api('/wp/v2/shopping-list/'+lb.id,a,'POST',{title:'Must not change'}),403,'Native unrelated list edit blocked');
 status(await api('/wp/v2/shopping-list/'+la.id,a,'POST',{title:'Cannot change owner',acf:{owner_id:b.id}}),400,'Ownership mass assignment blocked');
 status(await api('/wp/v2/users/me',a,'POST',{roles:['administrator']}),400,'Role escalation blocked');
 status(await api('/custom/v1/update-shopping-list',a,'POST',{shoppingListId:la.id,productId:pb.id,action:'add'}),403,'Foreign private product cannot be discovered by adding its ID');
 status(await api('/custom/v1/bag-all-products',a,'POST',{shoppingListId:la.id,baggedProducts:[{id:lb.id}],action:'bag'}),403,'Bulk bagging cannot inject arbitrary posts');
 const before=await api('/custom/v1/sync-revision',a);status(before,200,'Authenticated revision read');
 status(await api('/custom/v1/sync-revision'),401,'Anonymous revision read denied');
 status(await api('/custom/v1/update-shopping-list',a,'POST',{shoppingListId:la.id,productId:pa.id,action:'add'}),200,'Guest can add own product');
 status(await api('/custom/v1/update-shopping-list',a,'POST',{shoppingListId:la.id,productId:pa.id,action:'bag'}),200,'Guest can bag product');
 const after=await api('/custom/v1/sync-revision',a);check(after.data.revision!==before.data.revision,'List mutation changes only an opaque revision marker');check(Object.keys(after.data).join(',')==='revision','Sync response has no list content');
 const invite=await share(a,la,b);await share(b,lb,a);
 status(await api('/custom/v1/update-shopping-list',a,'POST',{shoppingListId:lb.id,productId:pa.id,action:'add'}),200,'Guest can add own product to shared list');
 status(await api('/wp/v2/shopping-list/'+la.id,b,'POST',{title:'Shared rename works'}),200,'Shared member can rename list');
 status(await api('/wp/v2/shopping-list/'+la.id,b,'DELETE'),403,'Shared member cannot delete owner list');
 status(await api('/custom/v1/remove-user-from-shared',a,'POST',{listId:la.id,userId:b.id}),200,'Owner removes member');
 status(await api('/custom/v1/accept-shared-list',b,'POST',{list_id:la.id,user_id:b.id,code:invite}),403,'Removed member cannot reuse an old invitation');
 await share(a,la,b);
 const password=randomBytes(24).toString('base64url')+'!9'; const email=`lista-privacy-${stamp}@example.invalid`;
 status(await api('/wp/v2/users/me',b,'POST',{name:'Disposable privacy account',email,password}),200,'Guest registers with chosen credentials');
 const login=await api('/jwt-auth/v1/token',null,'POST',{username:email,password});status(login,200,'Registered account can sign in');
 const profile=await api('/custom/v1/user-data',b);check(profile.data.registered==='yes'&&!('token'in profile.data),'Registration marker correct and profile excludes session secrets');
 status(await api('/custom/v1/claim-guest-lists',a,'POST',{account_token:c.token}),403,'Guest cannot be used as a registered transfer destination');
 status(await api('/custom/v1/update-shopping-list',c,'POST',{shoppingListId:lc.id,productId:pc.id,action:'add'}),200,'Create guest data before transfer');
 status(await api('/custom/v1/add-to-favourites',c,'POST',{productId:pc.id}),200,'Create guest favourite before transfer');
 const savedFavourite=await api('/custom/v1/get-favourites',c);check(savedFavourite.data.some(p=>p.id===pc.id),'First guest favourite persists across requests');
 status(await api('/custom/v1/claim-guest-lists',c,'POST',{account_token:b.token}),200,'Transfer guest lists to registered account');
 status(await api('/wp/v2/shopping-list/'+lc.id,b),200,'Registered account receives guest list');
 status(await api('/wp/v2/shopping-list/'+lc.id,c),403,'Old guest loses transferred list access');
 const received=await api('/custom/v1/get-custom-products',b);check(received.data.some(p=>p.id===pc.id),'Guest custom products transfer to account');
 const favourites=await api('/custom/v1/get-favourites',b);check(favourites.data.some(p=>p.id===pc.id),'Guest favourites transfer to account');
 status(await api('/custom/v1/assistant-quota',a,'POST',{}),200,'Authenticated assistant quota available');
 for(let i=1;i<40;i++){const q=await api('/custom/v1/assistant-quota',a,'POST',{});assert.equal(q.status,200,'Guest quota allows requests up to its limit');}
 status(await api('/custom/v1/assistant-quota',a,'POST',{}),429,'AI quota blocks excess requests without calling an AI provider');
 status(await api('/custom/v1/assistant-quota',null,'POST',{}),401,'Anonymous AI quota denied');
 status(await api('/custom/v1/delete-my-account',a,'POST',{account_id:b.id,confirmation:'DELETE MY LISTA ACCOUNT'}),400,'Cannot delete a different account');
 status(await api('/custom/v1/delete-my-account',a,'POST',{account_id:a.id}),400,'Deletion requires explicit confirmation');
 const preview=await api('/custom/v1/account-deletion-preview',a);check(preview.data.account_id===a.id&&preview.data.owned_lists===1,'Deletion preview limited to own data');
 status(await removeAccount(a),200,'Guest deletes own account and associated data');
 check((await api('/custom/v1/user-data',a)).status>=400,'Deleted account bearer token no longer authenticates');
 check((await api('/wp/v2/shopping-list/'+la.id,b)).status===404,'Owned list removed for collaborators');
 status(await api('/wp/v2/shopping-list/'+lb.id,b),200,'Other account owned list survives deletion');
 const items=await api('/custom/v1/get-shopping-list-products?shoppingListId='+lb.id,b);check(!items.data.linkedProducts.some(p=>(p.id||p.ID)===pa.id),'Deleted custom product removed from surviving shared lists');
 const surviving=await api('/custom/v1/shopping-list/'+lb.id,b);const members=surviving.data.acf.shared_with_users;check((members===false||members===null||Array.isArray(members))&&!((members||[]).some(u=>Number(u.ID||u.id||u)===a.id)),'Deleted account removed from surviving memberships');
}catch(error){state.failure=error.message;console.error('FAILED '+error.message);process.exitCode=1;}
finally{
 for(const a of state.accounts){if(a.deleted)continue;try{const r=await removeAccount(a);state.cleanup.push({account:a.id,status:r.status,deleted:r.data.deleted===true});if(!a.deleted)process.exitCode=1;}catch(e){state.cleanup.push({account:a.id,error:e.message});process.exitCode=1;}}
 if(state.accounts.every(a=>a.deleted))for(const a of state.accounts){delete a.token;delete a.ticket;}
 await save();console.log(JSON.stringify({checks:state.checks.length,failure:state.failure,cleanup:state.cleanup,report}));
}
