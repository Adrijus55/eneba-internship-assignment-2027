# Assignment workflow

Work on one testable feature at a time. After verifying it, show the student the relevant code and give them a chance to explain the data flow before starting the next feature. Reserve the last day for checks and submission.

Refresh the private conversation export after each milestone. Locate the assignment chat's JSONL by its thread ID, then run `node scripts/export-chat.mjs "<session path>"`. To include the current reply, start the same command with `--finish-turn` before replying. Check that the preceding final reply was captured when work resumes. If the chat moves to a new thread, retain the original export and extend the exporter before using the new chat for implementation.

Preserve the exact visible prompts and replies. Resolve any unknown message type against the original conversation. Keep the raw log, private transcript, and environment files out of Git. Review the complete final transcript locally before sharing it with the evaluator.
