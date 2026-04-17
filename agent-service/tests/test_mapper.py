from unittest.mock import AsyncMock, MagicMock, patch

import pytest

try:
    from src.agents.mapper import _format_error_section, run_mapper
except ImportError:
    pass


def test_format_error_section():
    # Test Empty
    assert _format_error_section(None) == ""
    assert _format_error_section([]) == ""

    # Test Payload
    res = _format_error_section(["status is invalid", "date format incorrect"])
    assert "PREVIOUS VALIDATION ERRORS (you must fix these):" in res
    assert "- status is invalid" in res
    assert "- date format incorrect" in res


@pytest.mark.asyncio
@patch("src.agents.mapper.ChatOpenAI")
@patch("src.agents.mapper.ChatPromptTemplate")
async def test_run_mapper_success(mock_prompt_cls, mock_llm_cls):
    """
    Test run_mapper correctly ties together the Prompt and Structured Output.
    """
    mock_llm_instance = MagicMock()
    mock_structured_llm = MagicMock()

    # The result of .with_structured_output()
    mock_llm_instance.with_structured_output.return_value = mock_structured_llm
    mock_llm_cls.return_value = mock_llm_instance

    mock_prompt_instance = MagicMock()
    mock_prompt_cls.from_messages.return_value = mock_prompt_instance

    # Mocking the pipeline chain `chain = prompt | structured_llm`
    mock_chain = MagicMock()
    mock_prompt_instance.__or__.return_value = mock_chain

    # Mocking the structured output Pydantic model response
    mock_result = MagicMock()
    mock_result.model_dump.return_value = {
        "title": "Normalized Title",
        "external_ticket_id": "JIRA-123",
        "normalized_status": "open",
        "due_date": None,
    }
    mock_chain.ainvoke = AsyncMock(return_value=mock_result)

    # Execute
    mapped = await run_mapper(
        raw_payload={"id": "JIRA-123", "fields": {"summary": "bug"}},
        source="jira",
        validation_errors=[],
    )

    # Validations
    assert mapped["title"] == "Normalized Title"
    assert mapped["external_ticket_id"] == "JIRA-123"

    # Verify the chain was called with the correctly shaped payload string
    mock_chain.ainvoke.assert_called_once()
    call_args = mock_chain.ainvoke.call_args[0][0]

    assert call_args["source"] == "jira"
    assert "JIRA-123" in call_args["raw_payload"]
    assert call_args["error_section"] == ""


@pytest.mark.asyncio
@patch("src.agents.mapper.ChatOpenAI")
@patch("src.agents.mapper.ChatPromptTemplate")
async def test_run_mapper_injects_validation_errors(mock_prompt_cls, mock_llm_cls):
    """
    Ensure run_mapper explicitly feeds back validation errors if they exist.
    """
    mock_llm_instance = MagicMock()
    mock_llm_instance.with_structured_output.return_value = MagicMock()
    mock_llm_cls.return_value = mock_llm_instance

    mock_prompt_instance = MagicMock()
    mock_prompt_cls.from_messages.return_value = mock_prompt_instance

    mock_chain = MagicMock()
    mock_prompt_instance.__or__.return_value = mock_chain

    mock_result = MagicMock()
    mock_result.model_dump.return_value = {}  # Doesn't matter here
    mock_chain.ainvoke = AsyncMock(return_value=mock_result)

    # Execute
    await run_mapper(
        raw_payload={"key": "val"},
        source="linear",
        validation_errors=["normalized_status must be 'open'"],
    )

    # Validate the error section was properly embedded in the API call arguments
    call_args = mock_chain.ainvoke.call_args[0][0]
    assert "PREVIOUS VALIDATION ERRORS" in call_args["error_section"]
    assert "normalized_status must be 'open'" in call_args["error_section"]
