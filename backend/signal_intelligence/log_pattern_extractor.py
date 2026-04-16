from __future__ import annotations

import re
from collections import Counter


class LogPatternExtractor:
    @staticmethod
    def normalize_line(line: str) -> str:
        normalized = re.sub(r"\b[0-9a-f]{8,}\b", "<id>", line)
        normalized = re.sub(r"\d{4}-\d{2}-\d{2}T\S+", "<ts>", normalized)
        normalized = re.sub(r"\b\d+\b", "<N>", normalized)
        normalized = re.sub(r"[\w\.-]+@[\w\.-]+", "<email>", normalized)
        normalized = re.sub(r"\b(?:\d{1,3}\.){3}\d{1,3}\b", "<ip>", normalized)
        return normalized[:200].strip()

    def deduplicate(self, lines: list[str]) -> list[str]:
        return [self.normalize_line(line) for line in lines if line.strip()]

    def extract_signatures(self, lines: list[str], top_n: int = 5) -> list[dict[str, int | str]]:
        normalized = self.deduplicate(lines)
        counts = Counter(normalized)
        return [
            {"signature": signature, "count": count}
            for signature, count in counts.most_common(top_n)
            if signature
        ]
