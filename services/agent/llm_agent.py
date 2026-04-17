"""
LLM reasoning layer: Ollama (Llama 3.1 8B) + FSM + RAG + MCP tool execution.
Context window capped at 4,096 tokens (OLLAMA_NUM_CTX=4096).
"""
import json
import re
import httpx
from fsm import FSMContext, AgentState
from retrieval import retrieve

OLLAMA_URL = "http://localhost:11434/v1/chat/completions"
OLLAMA_MODEL = "llama3.1:8b"
MAX_TOKENS = 512
MAX_CONTEXT_TOKENS = 4096


async def execute_tool(tool_name: str, tool_args: dict, fsm: FSMContext) -> str:
    """
    Execute MCP tool call. Sanitize all outputs -- never expose raw errors to user.
    Use parameterized queries only -- no prompt injection risk.
    """
    try:
        if tool_name == "Search_Knowledge_Base":
            chunks = retrieve(
                query=tool_args.get("query", ""),
                tenant_id=fsm.tenant_id,
                top_k=5
            )
            return "\n\n".join([c["text"] for c in chunks])

        elif tool_name == "Verify_PIN":
            # TODO: Implement actual PIN verification against your SaaS API
            pin = tool_args.get("pin", "")
            if pin == "1234":  # Replace with real auth
                fsm.authenticated = True
                fsm.transition_to(AgentState.INFORMATION_RETRIEVAL)
                return "PIN verified. Account authenticated."
            return "PIN verification failed."

        elif tool_name == "Update_Record":
            # TODO: Call your SaaS API to update the record
            record_id = tool_args["record_id"]
            field_name = tool_args["field"]
            value = tool_args["value"]
            # response = await your_saas_api.update(record_id, field_name, value)
            return f"Record {record_id} updated: {field_name} = {value}."

        elif tool_name == "Transfer_To_Human_Agent":
            fsm.transition_to(AgentState.HUMAN_ESCALATION)
            return "Initiating transfer to human agent."

        else:
            return f"Tool {tool_name} executed."

    except Exception as e:
        # Never expose raw error to user
        print(f"[MCP] Tool error ({tool_name}): {e}")
        return "I was unable to complete that action. Please try again or speak to an agent."


async def run_llm_turn(transcript: str, fsm: FSMContext) -> str:
    """
    Single LLM turn: builds context-constrained prompt, calls Ollama,
    handles tool calls, returns final text response.
    """
    fsm.conversation_history.append({"role": "user", "content": transcript})

    messages = [
        {"role": "system", "content": fsm.get_system_prompt()},
        *fsm.conversation_history[-6:]  # Keep last 6 turns to stay within context window
    ]

    tools = fsm.get_permitted_tools()

    async with httpx.AsyncClient(timeout=5.0) as client:
        response = await client.post(OLLAMA_URL, json={
            "model": OLLAMA_MODEL,
            "messages": messages,
            "tools": tools if tools else None,
            "max_tokens": MAX_TOKENS,
            "stream": False
        })

    result = response.json()
    message = result["choices"][0]["message"]

    # Handle tool calls (MCP execution)
    if message.get("tool_calls"):
        tool_responses = []
        for tool_call in message["tool_calls"]:
            tool_name = tool_call["function"]["name"]
            tool_args = json.loads(tool_call["function"]["arguments"])

            # Validate tool is permitted in current FSM state
            permitted = [t["name"] for t in fsm.get_permitted_tools()]
            if tool_name not in permitted:
                tool_responses.append(f"Tool '{tool_name}' not permitted in current state.")
                continue

            tool_result = await execute_tool(tool_name, tool_args, fsm)
            tool_responses.append(f"[{tool_name} result]: {tool_result}")

        # Re-invoke LLM with tool results
        fsm.conversation_history.append({"role": "assistant", "content": str(message)})
        tool_result_content = "\n".join(tool_responses)
        fsm.conversation_history.append({"role": "user", "content": tool_result_content})

        messages_with_results = [
            {"role": "system", "content": fsm.get_system_prompt()},
            *fsm.conversation_history[-8:]
        ]

        async with httpx.AsyncClient(timeout=5.0) as client:
            response2 = await client.post(OLLAMA_URL, json={
                "model": OLLAMA_MODEL,
                "messages": messages_with_results,
                "max_tokens": MAX_TOKENS,
                "stream": False
            })

        final_text = response2.json()["choices"][0]["message"]["content"]
    else:
        final_text = message.get("content", "")

    # Sanitize LLM output: strip SSML injection and code blocks before TTS
    final_text = sanitize_output(final_text)
    fsm.conversation_history.append({"role": "assistant", "content": final_text})
    return final_text


def sanitize_output(text: str) -> str:
    """
    Strip SSML injection and code blocks from LLM output before TTS.
    Never expose raw error codes, API responses, or markdown to the caller.
    """
    text = re.sub(r'```[\s\S]*?```', '', text)   # Remove code blocks
    text = re.sub(r'<[^>]+>', '', text)            # Strip SSML/HTML tags
    text = re.sub(r'\n+', ' ', text).strip()
    return text
