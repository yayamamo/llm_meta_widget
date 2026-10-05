# Anonymous TogoMCP static deployment

These Japanese and English landing-page examples use the actual widget and
https://hub.aibranch.org, without Google Identity Services or bearer tokens.
The original technical/reference content remains in English. The landing-page
snapshot is illustrative; incorporate its chat section into the current vhmcp
page rather than replacing newer documentation with this snapshot.

From the repository root:

```sh
mkdir -p /tmp/togomcp-static/assets
cp -R examples/togomcp-anonymous/ja examples/togomcp-anonymous/en /tmp/togomcp-static/
cp examples/togomcp-anonymous/ja/index.html /tmp/togomcp-static/index.html
cp app/assets/javascripts/llm_meta_widget/llm-meta-widget.js /tmp/togomcp-static/assets/
```

Copy `index.html`, `ja/`, `en/`, and `assets/` into the existing static container's
web document root. Back up the current HTML first. No additional Rails service,
Google client ID, client secret, or widget server is needed. Existing tutorial
links point to the live site. Keep the host's existing scripts when integrating
into its source page; this example snapshot does not include its original UI scripts.

The public hub must allow the exact browser Origin in CORS_ORIGINS. The intended
Origin is https://test-togomcp.rdfportal.org. localhost:3007 is not currently
allowed: local browser testing uses a temporary same-origin proxy, which is not
part of the deployment. Copying the static files cannot configure the public hub.

The selected model is qwen3-8-27b-fast; only TogoMCP is shown in the tool picker.
TogoMCP tools are selected upon first discovery; visitors can change them.
max-rounds=4 bounds model/tool rounds in the client. This is a UI limit, not
server-side abuse prevention. Trial wording does not promise specific quotas.

Acceptance: open either language page, open chat, check TogoMCP tools are loaded,
ask for TogoMCP_Usage_Guide with empty arguments once and a three-item summary.
Verify anonymous LLM request, tool_call, MCP POST, tool-result message in the
next LLM request, and final answer. Also verify status/elapsed time and failures.
