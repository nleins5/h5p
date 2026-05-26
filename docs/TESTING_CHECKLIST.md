# Testing Checklist

## Smoke Test

- Open frontend URL.
- Confirm page title says `H5P Interactive Video Generator`.
- Confirm YouTube video preview appears.
- Confirm backend health URL returns `{ "ok": true }`.

## Listen & Choose

- Select `Listen & choose`.
- Click `Add Interaction`.
- Upload:
  - `demo-assets/audio/prompt-audio-small.m4a`
  - `demo-assets/audio/option-audio-a-small.m4a`
  - `demo-assets/audio/option-audio-b-small.m4a`
- Confirm audio fields show embedded/ready status.
- Confirm `Correct option` can be selected.
- Drag the interaction marker on the video.
- Confirm `x` and `y` values change in the form.

## Read Aloud

- Select `Read aloud`.
- Click `Add Interaction`.
- Confirm the form has Prompt, Word or phrase, Accepted answer, Input language.
- Confirm the `Record` button appears.

## Export

- Click `Generate H5P`.
- Confirm a `.h5p` file downloads.
- Do not double-click the `.h5p` in Finder.
- Upload the `.h5p` into an H5P-compatible platform to preview.

## Expected Result

- Exported file should be named from the title, for example `interactive-video.h5p`.
- Generated package should include the YouTube video reference and the configured interactions.
- Audio-based interactions should work without depending on the original local audio files.
