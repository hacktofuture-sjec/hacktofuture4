"""
RAG Triad Evaluation using TruLens.
Measures: Context Relevance, Groundedness, Answer Relevance.
Run this against your test call logs BEFORE demo.
"""
# pip install trulens-eval

from trulens_eval import Tru, TruChain, Feedback
from trulens_eval.feedback import Groundedness
from trulens_eval.feedback.provider import OpenAI as FeedbackOpenAI

tru = Tru()
provider = FeedbackOpenAI()
grounded = Groundedness(groundedness_provider=provider)

# Define RAG Triad metrics
f_context_relevance = (
    Feedback(provider.context_relevance, name="Context Relevance")
    .on_input()
    .on(...)  # context chunks
    .aggregate(...)
)

f_groundedness = (
    Feedback(grounded.groundedness_measure_with_cot_reasons, name="Groundedness")
    .on(...)  # context chunks
    .on_output()
    .aggregate(grounded.grounded_statements_aggregator)
)

f_answer_relevance = (
    Feedback(provider.relevance, name="Answer Relevance")
    .on_input()
    .on_output()
)

# Target Scores:
# Context Relevance  > 0.85
# Groundedness       > 0.90  (zero-hallucination target)
# Answer Relevance   > 0.88
