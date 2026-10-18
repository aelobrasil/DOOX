# DOOX Omega: upload and video render pipeline

## User flow

1. The client buys an insertion and sends the company details and creative files.
2. DOOX reviews the order, confirms payment and approves the supplied materials.
3. In the private Control area, an operator uploads the edited episode and assigns the approved insertion orders to the agreed positions.
4. The system validates that no two insertions occupy the same minute, creates a render job and shows its progress.
5. A background worker composites the insertions, renders an MP4, checks the output and stores it privately.
6. Control and the relevant client tracking page expose a time-limited download link when the render passes validation.

## Recommended implementation

- Keep source videos, approved creative assets and rendered files in private Supabase Storage buckets. Upload large source videos directly from the browser with resumable TUS uploads; do not send the video bytes through a Vercel Function.
- Store an immutable render manifest per job: source object key and checksum, episode ID, ordered placements, start/end timestamps, asset object keys and versions, audio mix settings, output profile, creator and job status.
- Enqueue a render job after the manifest is validated. A dedicated background worker runs FFmpeg, downloads only authorized inputs, composites transparent PNG/video layers and mixes audio at the scheduled timestamps.
- Write each render to a unique private object key. Mark it ready only after FFmpeg exits successfully and a probe confirms the expected duration, dimensions, codecs and non-empty file.
- Make retries idempotent, preserve failed-job logs, clean up temporary working files and keep source files until an operator approves the finished video.
- Give clients signed, expiring download URLs scoped to their own order. Keep source episode videos and Control-only logs private.

## Job states

`RECEIVED → VALIDATING → QUEUED → RENDERING → VERIFYING → READY`

Any non-terminal state may become `FAILED`; an operator can retry after correcting the input or worker error. Cancellation is allowed before final verification.

## Data and access boundaries

The database should have separate records for `render_jobs` and `render_job_placements`. Enforce one placement per minute with a unique constraint on `(episode_id, minute_index)` for active placements, and validate episode sponsor positions separately. Only authenticated Control users can create or retry jobs. Client access uses the existing private order token or authenticated account and can retrieve only that order's final output.

Do not expose episode sponsor orders or sponsor identities in the internal Control dashboard; the render worker should receive only the approved placement manifest it needs to produce the episode. Preserve an audit event for every upload, schedule change, render, retry, approval and download-link issuance.

## Current branch status

The DOOX Omega web prototype can generate and download a transparent PNG preview in the browser. This pipeline is an implementation specification; resumable uploads, payment processing, render queue, FFmpeg worker, final MP4 delivery and client authentication are not connected in this branch yet. Production work must also reconcile the existing database catalog with the approved product prices, capacities and weekly-app sponsorship rules before accepting live orders.
