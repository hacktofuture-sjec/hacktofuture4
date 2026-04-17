"""
VoxBridge Finite State Machine.
Critical architectural principle: At any FSM state, the LLM only has access
to the tools and context permitted by that state.
"""
from enum import Enum
from dataclasses import dataclass, field


class AgentState(Enum):
    AUTHENTICATION = "authentication"
    INFORMATION_RETRIEVAL = "information_retrieval"
    ACTION_EXECUTION = "action_execution"
    HUMAN_ESCALATION = "human_escalation"
    TERMINATED = "terminated"


# MCP tool definitions -- each tool corresponds to a permitted action
MCP_TOOLS = {
    "Verify_PIN": {
        "description": "Verify caller PIN for authentication. Returns boolean.",
        "parameters": {"pin": "string"}
    },
    "Lookup_Account": {
        "description": "Look up account details by caller ID.",
        "parameters": {"caller_id": "string"}
    },
    "Search_Knowledge_Base": {
        "description": "Search product documentation. Returns relevant chunks.",
        "parameters": {"query": "string", "tenant_id": "string"}
    },
    "Update_Record": {
        "description": "Update a record in the SaaS platform.",
        "parameters": {"record_id": "string", "field": "string", "value": "string"}
    },
    "Calculate_Metric": {
        "description": "Calculate a business metric.",
        "parameters": {"metric_name": "string", "inputs": "object"}
    },
    "Submit_Ticket": {
        "description": "Submit a support ticket.",
        "parameters": {"description": "string", "priority": "string"}
    },
    "Transfer_To_Human_Agent": {
        "description": "Transfer the call to a human agent via SIP.",
        "parameters": {"department": "string", "reason": "string"}
    }
}

STATE_CONFIG = {
    AgentState.AUTHENTICATION: {
        "system_prompt": (
            "You are VoxBridge, a voice support agent. Your ONLY task right now is "
            "caller authentication. Ask the caller for their PIN. Use Verify_PIN to "
            "validate. Do NOT answer any other questions. Do NOT search documentation."
        ),
        "permitted_tools": ["Verify_PIN", "Lookup_Account"],
    },
    AgentState.INFORMATION_RETRIEVAL: {
        "system_prompt": (
            "You are VoxBridge, a voice support agent. Answer the caller's question "
            "using ONLY the retrieved documentation context provided. "
            "STRICT CONSTRAINT: Your verbal response must not exceed 8-12 seconds "
            "of spoken audio (~100-150 words). Summarize technical documentation "
            "concisely. Never read raw manual text. If you cannot answer from context, "
            "say so clearly and offer to escalate."
        ),
        "permitted_tools": ["Search_Knowledge_Base"],
    },
    AgentState.ACTION_EXECUTION: {
        "system_prompt": (
            "You are VoxBridge, a voice support agent. The caller wants to take an "
            "action on the system. Confirm the exact action with the caller before "
            "executing. Use the appropriate tool with a strict JSON payload. "
            "Confirm success or failure verbally after execution."
        ),
        "permitted_tools": ["Update_Record", "Calculate_Metric", "Submit_Ticket"],
    },
    AgentState.HUMAN_ESCALATION: {
        "system_prompt": (
            "You are VoxBridge. The caller needs human assistance. Apologize briefly, "
            "summarize the issue for the agent, and use Transfer_To_Human_Agent. "
            "Do not attempt to resolve the issue yourself."
        ),
        "permitted_tools": ["Transfer_To_Human_Agent"],
    }
}


@dataclass
class FSMContext:
    state: AgentState = AgentState.AUTHENTICATION
    tenant_id: str = ""
    caller_id: str = ""
    authenticated: bool = False
    conversation_history: list[dict] = field(default_factory=list)
    turn_count: int = 0

    def get_system_prompt(self) -> str:
        return STATE_CONFIG[self.state]["system_prompt"]

    def get_permitted_tools(self) -> list[dict]:
        tool_names = STATE_CONFIG[self.state]["permitted_tools"]
        return [
            {"name": name, **MCP_TOOLS[name]}
            for name in tool_names if name in MCP_TOOLS
        ]

    def transition_to(self, new_state: AgentState):
        print(f"[FSM] Transition: {self.state.value} -> {new_state.value}")
        self.state = new_state
