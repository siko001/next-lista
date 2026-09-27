import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const source = await readFile(new URL('../app/lib/claimGuestLists.js', import.meta.url), 'utf8');
const {claimGuestLists} = await import(`data:text/javascript;base64,${Buffer.from(source).toString('base64')}`);
const options = {apiBase:'https://example.test/wp-json',guestToken:'guest-test',guestUserId:7,accountToken:'account-test'};
const json = (value, status=200) => ({ok:status===200,status,json:async()=>value});

test('empty or shared-only guest lists need no transfer', async()=> {
    let calls=0;
    const count=await claimGuestLists({...options,fetcher:async()=>{calls++;return json([{id:1,acf:{owner_id:8}}]);}});
    assert.equal(count,0); assert.equal(calls,1);
});
test('owned lists use both session proofs, never a supplied destination ID',async()=>{
    const calls=[];
    const count=await claimGuestLists({...options,fetcher:async(url,init)=>{calls.push({url,init});return calls.length===1?json([{id:1,acf:{owner_id:'7'}}]):json({success:true,transferred_count:1});}});
    assert.equal(count,1);
    assert.equal(calls[1].init.headers.Authorization,'Bearer guest-test');
    assert.deepEqual(JSON.parse(calls[1].init.body),{account_token:'account-test'});
});
test('missing endpoint and failed transfer reject before login can commit cookies',async()=>{
    for(const status of [404,403,500]) {
        let calls=0;
        await assert.rejects(claimGuestLists({...options,fetcher:async()=>++calls===1?json([{acf:{owner_id:7}}]):json({},status)}));
    }
});
test('failed list lookup and malformed responses never silently discard guest lists',async()=>{
    await assert.rejects(claimGuestLists({...options,fetcher:async()=>json({},500)}));
    await assert.rejects(claimGuestLists({...options,fetcher:async()=>json({})}));
});

test('transfer rejection exposes a safe WordPress code and HTTP status', async()=>{
    let calls=0;
    await assert.rejects(claimGuestLists({...options,fetcher:async()=>++calls===1
        ? json([{acf:{owner_id:7}}])
        : json({code:'lista_account_validation_failed',message:'private upstream diagnostic'},403)}),error=>{
        assert.equal(error.code,'lista_account_validation_failed');
        assert.equal(error.status,403);
        assert.match(error.message,/own API/);
        assert.match(error.message,/HTTP 403/);
        assert.doesNotMatch(error.message,/private upstream/);
        return true;
    });
});

test('non-JSON upstream failures still give a usable error', async()=>{
    let calls=0;
    await assert.rejects(claimGuestLists({...options,fetcher:async()=>++calls===1
        ? json([{acf:{owner_id:7}}])
        : {ok:false,status:502,json:async()=>{throw new SyntaxError('html page');}}}),/transfer_request_failed; HTTP 502/);
});
