# Six minutes on camera, then the message

Two things in this task cannot be outsourced: the video and the WhatsApp message.
This is a plan for both, not a script. Reading a script is the thing they say they
will notice.

## Before you press record

- Vercel URL opens in an incognito window; `/health` answers and says
  `"storage": "supabase"` (if it says `sqlite`, the Render env vars are missing
  and a redeploy would wipe the calls).
- Past calls has three real calls in it, including one with an **audit warning**
  (the seed data ships one, so the feature is visible without a mis-tap).
- One call open and sitting at stage 3, ready to walk.
- Camera on: OBS or Loom, screen plus your face in a corner. 1080p is enough.
- Drive folder ready, link on **Anyone with the link can view**.

## The six minutes

**0:00 - 0:35 - Who you are, and the one sentence.**
Your name, what you built, and the sentence to remember. Mine: *the caller types
one tap and the prospect's words; everything else the screen does.*

**0:35 - 1:45 - What the hundred calls said.**
Numbers, without looking: median 93.5 seconds, 68 of 100 under two minutes; 13
were the wrong person or had left; 23 opened with "what is this regarding"; 24
were logged with no next step and no clear no. Say the last one slowly. It is the
whole reason the app exists.

**1:45 - 4:15 - The walkthrough, on one call.**
Start a call. Stage by stage, but do not narrate every tap:
- Stage 1: the wrong-number tap, and `End call` works from here, because 13 of
  the hundred ended here.
- Stage 2: "what is this regarding" is on screen before they say it.
- Stage 5: type the prospect's actual words into the one box. Then press **AI
  cue** and read the line out loud. Say: this is the only LLM button on the live
  screen, and it returns one spoken sentence, not a chat.
- Stage 7 and 8: `Next: Next step`, then `Close call`.
- **The close modal:** pick `agreed_to_receive_report` deliberately — the audit
  turns red and names the tap it disagrees with. Change it to the right outcome and
  watch it turn back. Say: the record is the caller's word, so it gets checked
  before it is written, not after.

**4:15 - 5:15 - One decision, and why.**
The strongest: *the outcome is chosen at the end but audited against the taps,
because the transcripts show the outcome is the least reliable field in the
record.* Name the evidence: `T010`, `T099`, `T084`, `T020`, and the 13
`not_logged`. Then the consequence: the audit warns, it never blocks, because the
caller was on the call and the model was not.

**5:15 - 6:00 - The limit, and the next thing.**
Say the limit out loud: no auth, one shared workspace, and the audit can only be
as honest as the taps. Then one thing you would build next. Naming the limit is
worth more than another feature.

## What they are watching for

1. You read the calls and can quote a number without looking.
2. You can defend a decision you made, not one a model made.
3. The product works live, on camera, first take.
4. You name the limit before they find it.
5. You are the person in the video.

## Recording kit

- OBS: Display Capture + Video Capture Device in one scene, record `.mkv`, remux
  to `.mp4` if Drive complains.
- Loom free caps at 5 minutes. Record in two parts, or use OBS.
- No captions, no music. Produced reads worse here than plain.

## Upload

1. Drive → New → File upload.
2. Share → General access → **Anyone with the link** → Viewer.
3. Open the link in an incognito window. Confirm it plays and runs past 6:00.
4. Paste into portal box 2.

## The WhatsApp message

Send it from the page's own button if it is offered, so the links and the
questions are already in the message. If you type it:

```
Tarun, I registered for the Forward Deployed Engineer task on Friday.
Repo: https://github.com/Nitro-Builds-Yash/spindle
App: https://spindle-call.vercel.app
Health: https://<api>.onrender.com/health

Six minutes: <drive link>

One thing worth pointing at: the outcome is the callers word, so the close
audit checks it against the taps before it is saved. In the hundred calls, 24
were logged with no next step and no clear no.

- <your name>, <your number>
```

Four links, one sentence of thinking, your name.

## Ten minutes before you send

- [ ] Repo public, `git status` clean, transcripts not in it
      (`git ls-files | grep -i transcript` returns nothing).
- [ ] README has the Vercel URL, the Render `/health` URL, and which LLM is used
      and for what.
- [ ] `schema.sql` in the repo root matches what is actually in Supabase.
- [ ] Live app works in incognito, cold, after Render has slept.
- [ ] Video over six minutes, on Drive, viewable without a login.
- [ ] No transcript text pasted into the repo, the video, or the message.
