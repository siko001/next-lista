# Assistant add jobs

AI ingredient adds, direct chat adds, and confirmed voice item batches use the same durable browser queue. Once a destination list has been resolved and the batch accepted, its items, list ID, product IDs and completed count are saved in account-scoped localStorage records. Tokens are never included.

The root progress component waits for UserProvider to validate the current session, then resumes unfinished jobs on any page. Closing the assistant or refreshing does not lose the queue. Closing the browser pauses execution until Lista is opened again in the same browser and account; this is not a server worker. AI response generation, active microphone recordings, transcription, and destination-list creation before batch acceptance are not queued.

Each product ID is checkpointed before linking it. If a link request succeeded but its response was lost, replay uses the same list/product pair; WordPress's existing add action ignores IDs already linked. Product resolution reads custom products fresh to recover a creation whose response was lost. The existing custom-product creation endpoint has no idempotency key, so simultaneous creation requests (including an old request still running on WordPress during a refresh) are not guaranteed exactly-once.

Web Locks serialize this queue's work across tabs on browsers that support them. Older/insecure browser contexts fall back to one runner per page. Account changes stop the runner before its next operation. Already-sent requests can still finish. Other accounts cannot load or resume these saved jobs.

Failed jobs retain their checkpoint and destination, and expose **Retry remaining items**. Completed jobs remain visible until dismissed. Discarding a failed job removes its saved remaining work. A blocked/full store prevents accepting a new batch rather than promising persistence that cannot be provided. Clearing browser site data removes saved jobs.

Run regression tests with `node --test tests/assistantAddQueue.test.mjs`. They cover refresh with an uncertain write result, completed-item checkpoints, retry, account isolation, two tabs, storage failure, completed jobs, and malformed records.
