"""
Verifier for the `format_tokens` millions task.

This file is NOT in the repo the agent works in. The harness copies it into the
sandbox *after* the agent has finished and before `verify` runs, so the agent
can neither read it, satisfy it narrowly, nor delete it. That is the whole
reason `verifyFiles` exists - a benchmark whose test the subject can see is a
measure of test-reading, not of the task.
"""

from aider.utils import format_tokens


def test_existing_behaviour_is_preserved():
    # Regression guard. The task extends format_tokens; it must not rewrite it.
    assert format_tokens(0) == "0"
    assert format_tokens(999) == "999"
    assert format_tokens(1000) == "1.0k"
    assert format_tokens(9999) == "10.0k"
    assert format_tokens(10000) == "10k"
    assert format_tokens(500000) == "500k"


def test_millions_use_one_decimal_below_ten_million():
    assert format_tokens(1_000_000) == "1.0M"
    assert format_tokens(2_500_000) == "2.5M"
    assert format_tokens(9_499_999) == "9.5M"


def test_millions_are_whole_numbers_at_or_above_ten_million():
    assert format_tokens(10_000_000) == "10M"
    assert format_tokens(25_400_000) == "25M"
    assert format_tokens(1_000_000_000) == "1000M"


def test_boundaries_mirror_the_thousands_logic():
    # The k-branch rounds to a whole number right up to the 1M cutover, so
    # 999_999 stays "1000k" - it does not become "1.0M".
    assert format_tokens(999_999) == "1000k"
    # And 9_999_999 rounds up within the one-decimal M branch, exactly as
    # 9_999 rounds up to "10.0k" within the one-decimal k branch.
    assert format_tokens(9_999_999) == "10.0M"
