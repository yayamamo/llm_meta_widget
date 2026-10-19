import {test} from "node:test"
import assert from "node:assert/strict"
import {limitStopMessage, isResourceLimit, dispatchRemoteToolCall, runChatLoop} from "./orchestrator.js"

test("round limits explain incomplete replies and a possible successful retry in both languages", () => {
  assert.match(limitStopMessage({code:"max_rounds"},{lang:"ja",rounds:10}), /上限（10回）.*未完了.*制限内で完了する場合/)
  assert.match(limitStopMessage({code:"max_rounds"},{lang:"en",rounds:10}), /round limit \(10\).*incomplete.*may.*finish within/)
})

test("rate limits respect Retry-After rather than suggesting an immediate retry", () => {
  assert.match(limitStopMessage({status:429,retryAfter:"30"},{lang:"ja"}), /少なくとも30秒待ってから/)
  assert.match(limitStopMessage({status:429,retryAfter:"30"}), /Wait at least 30 seconds/)
})

test("budgets and operator stops require reset or service resumption", () => {
  assert.match(limitStopMessage({code:"daily_budget"},{lang:"ja"}), /解除・リセットされてから/)
  assert.match(limitStopMessage({code:"global_daily_budget"}), /budget is reset or restored/)
  assert.match(limitStopMessage({code:"stopped"},{lang:"ja"}), /サービスが再開してから/)
})

test("size and deadline limits are identified without mislabelling ordinary errors", () => {
  assert.match(limitStopMessage({code:"result_too_large"},{lang:"ja"}), /サイズ上限/)
  assert.match(limitStopMessage({code:"execution_timeout"}), /response time limit/)
  assert.equal(limitStopMessage(new Error("bad SPARQL")), null)
  assert.equal(isResourceLimit({status:401}), false)
})

test("MCP proxy rejection preserves structured code, status and Retry-After", async () => {
  const original = globalThis.fetch
  globalThis.fetch = async () => new Response(JSON.stringify({error:"tool_rate_limit",message:"quota"}),{status:429,headers:{"Retry-After":"45"}})
  try {
    await assert.rejects(dispatchRemoteToolCall({baseUrl:"https://hub.example",toolId:1}), error => {
      assert.equal(error.code,"tool_rate_limit")
      assert.equal(error.status,429)
      assert.equal(error.retryAfter,"45")
      return true
    })
  } finally {globalThis.fetch=original}
})

test("a rejected MCP call stops orchestration without another model or tool request", async () => {
  const original = globalThis.fetch
  const urls=[]
  globalThis.fetch=async url => {
    urls.push(String(url))
    if(String(url).endsWith("/single_llm_calls")) return new Response('event: tool_call\ndata: {"tool_call":{"id":"c1","name":"guide","arguments":{}}}\n\nevent: done\ndata: {"content":"Calling guide","finish_reason":"tool_calls"}\n\n')
    return new Response(JSON.stringify({error:"capacity",message:"busy"}),{status:503,headers:{"Retry-After":"10"}})
  }
  try {
    await assert.rejects(runChatLoop({baseUrl:"https://hub.example",modelName:"m",apiKeyUuid:"anonymous",messages:[{role:"user",content:"guide"}],remoteTools:[{id:1,name:"guide"}],maxRounds:10}), error=>error.code==="capacity")
    assert.equal(urls.length,2)
    assert.equal(urls.filter(u=>u.endsWith("/single_llm_calls")).length,1)
  } finally {globalThis.fetch=original}
})
