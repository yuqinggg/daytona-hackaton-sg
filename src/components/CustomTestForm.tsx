"use client";

import type { ChangeEvent } from "react";
import type { CustomTestInput } from "@/lib/scenario";

export const EMPTY_CUSTOM_TEST: CustomTestInput = {
  repo: "",
  ref: "main",
  task: "",
  testPath: "tests/custom_test.py",
  testContents: "",
  verifyCommand: "python -m pytest tests/custom_test.py -q",
};

export function CustomTestForm({
  value,
  onChange,
}: {
  value: CustomTestInput;
  onChange: (value: CustomTestInput) => void;
}) {
  const set = (field: keyof CustomTestInput, next: string) => {
    onChange({ ...value, [field]: next });
  };

  const uploadTest = async (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    const contents = await file.text();
    onChange({
      ...value,
      testPath:
        value.testPath === EMPTY_CUSTOM_TEST.testPath || !value.testPath.trim()
          ? `tests/${file.name}`
          : value.testPath,
      testContents: contents,
    });
  };

  const fieldClass =
    "mt-1 w-full rounded-lg border border-[var(--color-edge)] bg-[var(--color-canvas)] px-3 py-2 text-sm text-[var(--color-ink)] placeholder:text-[var(--color-muted)]/60";

  return (
    <section className="mt-5 rounded-2xl border border-[var(--color-live)]/35 bg-[var(--color-panel)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold text-[var(--color-ink)]">Add your test case</h2>
          <p className="mt-1 max-w-2xl text-sm text-[var(--color-muted)]">
            Tell the agent what to change, then provide a deterministic test that proves whether
            it worked.
          </p>
        </div>
        <span className="rounded border border-[var(--color-live)] px-2 py-1 text-xs text-[var(--color-live)]">
          Hidden from the agent
        </span>
      </div>

      <div className="mt-5 grid gap-4 md:grid-cols-[minmax(0,1fr)_12rem]">
        <label className="text-sm text-[var(--color-muted)]">
          Repository URL
          <input
            type="url"
            value={value.repo}
            onChange={(event) => set("repo", event.target.value)}
            placeholder="https://github.com/your-org/your-repo.git"
            className={fieldClass}
          />
        </label>
        <label className="text-sm text-[var(--color-muted)]">
          Branch or tag
          <input
            value={value.ref}
            onChange={(event) => set("ref", event.target.value)}
            placeholder="main"
            className={fieldClass}
          />
        </label>
      </div>

      <label className="mt-4 block text-sm text-[var(--color-muted)]">
        What should the agent change?
        <textarea
          value={value.task}
          onChange={(event) => set("task", event.target.value)}
          placeholder="Describe the expected change, constraints, and any behavior that must stay unchanged."
          rows={5}
          className={`${fieldClass} resize-y`}
        />
      </label>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <label className="text-sm text-[var(--color-muted)]">
          Test file location
          <input
            value={value.testPath}
            onChange={(event) => set("testPath", event.target.value)}
            placeholder="tests/custom_test.py"
            className={fieldClass}
          />
          <span className="mt-1 block text-xs">Where the file will be placed inside the repository.</span>
        </label>
        <label className="text-sm text-[var(--color-muted)]">
          Command that runs the test
          <input
            value={value.verifyCommand}
            onChange={(event) => set("verifyCommand", event.target.value)}
            placeholder="python -m pytest tests/custom_test.py -q"
            className={fieldClass}
          />
          <span className="mt-1 block text-xs">Exit code 0 means pass; any other code means fail.</span>
        </label>
      </div>

      <div className="mt-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <label htmlFor="custom-test-code" className="text-sm text-[var(--color-muted)]">
            Test code
          </label>
          <label className="cursor-pointer rounded-lg border border-[var(--color-edge)] px-3 py-1.5 text-xs font-semibold text-[var(--color-ink)] hover:border-[var(--color-live)]">
            Upload a test file
            <input
              type="file"
              accept=".py,.js,.jsx,.ts,.tsx,.go,.rs,.java,.rb,.php,.sh,.txt"
              onChange={uploadTest}
              className="sr-only"
            />
          </label>
        </div>
        <textarea
          id="custom-test-code"
          value={value.testContents}
          onChange={(event) => set("testContents", event.target.value)}
          placeholder={'def test_expected_behavior():\n    assert feature() == "expected"'}
          rows={10}
          spellCheck={false}
          className={`${fieldClass} resize-y font-mono`}
        />
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          This file is copied into each fresh machine only after the agent finishes editing.
        </p>
      </div>
    </section>
  );
}
