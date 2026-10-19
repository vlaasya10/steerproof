from unittest.mock import Mock, patch

import pytest
from app.schemas import WriteRequest
from app.write.writer import run_writer


def test_writer_never_returns_invalid_second_attempt():
    llm = Mock()
    llm.structured.return_value = (Mock(), False)
    request = WriteRequest(paperId="P-TEST", meta={}, claims=[], language="en")
    with patch(
        "app.write.writer.validate_writer_result",
        return_value=(False, ["missing provenance"]),
    ), pytest.raises(ValueError, match="failed validation after retry"):
        run_writer(request, llm)
    assert llm.structured.call_count == 2
    assert all(
        call.kwargs["temperature"] == 0.7 for call in llm.structured.call_args_list
    )
    assert "missing provenance" in llm.structured.call_args_list[1].kwargs["prompt"]
