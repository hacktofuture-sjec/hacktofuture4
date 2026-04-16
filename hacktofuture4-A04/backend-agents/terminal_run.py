import asyncio
import json
import main

async def run_terminal_demo():
    print("=" * 70)
    print("🚀 LIVE AGENT EXECUTION VIA GOOGLE GEMINI")
    print("=" * 70)
    
    # We are calling the ACTUAL tools and the ACTUAL Google Gemini Agent.
    # No mock outputs. The agent itself answers.
    result = await main.healing_workflow("Terminal Real Run")
    
    print("\n" + "=" * 70)
    print("🎯 FINAL AGENT RESPONSE")
    print("=" * 70)
    print(json.dumps(result, indent=2))
    print("\n✓ Process exited.")

if __name__ == "__main__":
    asyncio.run(run_terminal_demo())
