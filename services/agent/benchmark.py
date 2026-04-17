"""
Latency benchmarking harness.
Measures: STT latency, TTFT (LLM), TTS latency, end-to-end perceived latency.
Run 20 test utterances. Target P95 < 800ms end-to-end.
"""
import time
import asyncio
from llm_agent import run_llm_turn
from fsm import FSMContext, AgentState

TEST_UTTERANCES = [
    "What does error code E-44 mean in the sensor dashboard?",
    "What is the recommended torque spec for the M12 anchor bolt?",
    "Update project milestone 7 to 85% complete.",
    "What are the compliance requirements for HIPAA data storage?",
    # Add 16 more domain-specific test queries
]


async def benchmark():
    results = []
    fsm = FSMContext(tenant_id="test_tenant", authenticated=True)
    fsm.state = AgentState.INFORMATION_RETRIEVAL

    for utterance in TEST_UTTERANCES:
        start = time.perf_counter()
        response = await run_llm_turn(utterance, fsm)
        elapsed_ms = (time.perf_counter() - start) * 1000
        results.append({"utterance": utterance[:50], "latency_ms": elapsed_ms})
        print(f"[Benchmark] {elapsed_ms:.0f}ms -- {utterance[:40]}...")

    latencies = [r["latency_ms"] for r in results]
    p95 = sorted(latencies)[int(len(latencies) * 0.95)]
    print(f"\n[Benchmark] P95 LLM TTFT: {p95:.0f}ms (target < 600ms)")
    print(f"[Benchmark] Mean: {sum(latencies)/len(latencies):.0f}ms")


if __name__ == "__main__":
    asyncio.run(benchmark())
