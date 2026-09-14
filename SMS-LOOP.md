# The SMS loop

> Spec, not a decision. Written 2026-09-14 in answer to Doug Hirsch's note:
> *"Consider whether it could just be text-based."*
>
> The honest answer is that most of the weekly loop could, and that saying so
> out loud is clarifying rather than threatening. What follows is what the
> product looks like if you take the question seriously.

## The claim

**You should never need to open Circles to use Circles.**

The app is where you *find* a circle and *join* it. The texts are where you
*go* to it. Nobody opens an app to attend something they already agreed to
attend; they look at their phone when it buzzes and decide in four seconds.

That split is not a retreat from the app. It is the strongest version of the
thesis: if recurrence is the point, then the weekly beat has to be effortless,
and the most effortless surface on a phone is the one that interrupts you.

## What moves to SMS

The entire weekly beat. In order:

| When | Message | Reply |
|---|---|---|
| 24h before | the ask | `Y` / `N` / `M` |
| on reply | confirmation with who else is in | |
| 3h before | the nudge, with the count | still open to `Y` / `N` / `M` |

Draft copy, written to fit one segment (160 chars) so each message costs one
unit and arrives whole.

**24h:**

```
Circles: Late Night Rofo Chicken meets tomorrow 11pm at Fleet
Street Royal Farms. Coming? Reply Y, N or M. Reply STOP to stop.
```

The brand name at the front and the STOP line at the end are not padding.
Carriers look for both during campaign review, and an unbranded message with
no opt-out is a filtering risk even after a campaign is approved. It costs
most of the segment, which is the argument for keeping everything else short.

**On `Y`:**

```
Circles: you're in. 5 going so far: Sam, Kaya, Kian +2. See you there.
```

**On `N`:**

```
Circles: no problem. Next one is Friday the 26th.
```

**On `M`:**

```
Noted as a maybe. We'll nudge you 3 hours before.
```

**3h, to anyone who said yes or maybe:**

```
Circles: Rofo Chicken in 3 hours, 11pm, Fleet Street Royal Farms. 6 going.
```

**3h, to anyone who has not answered:** the same, with the ask on the end.

Note what the confirmation does. It answers Doug's *"how do I know people will
show"* in the one moment the question is live, using names rather than a
number, because "Sam, Kaya, Kian" is a reason to go and "5" is a statistic.

## What stays in the app

Four things, and they are exactly the four a text cannot do.

**The map.** Discovery is spatial. "Circles near you" is a picture, not a
sentence, and it is the only part of this product that a group chat cannot
replicate. This is the moat.

**The blurred area.** Strangers meeting strangers needs a rendered region, not
a coordinate pasted into a text. Sending anyone a precise address by SMS
undoes the location privacy work entirely.

**Creating and running a circle.** Dropping a pin, setting a schedule,
approving a request. Form work, done once, done sitting down.

**Deciding to join.** Who is in it, how often they show, where it meets,
what it is. That is a page, and it is the page a flyer's QR code should land
on.

## What becomes vestigial, and that is fine

Being honest about this is the point of the exercise.

- **Home** stops being the product and becomes a fallback view of what the
  texts already told you. Still worth having; no longer worth optimising.
- **Notifications** is close to dead. Its whole job was telling you things,
  and the texts do that better.
- **Email reminders** become the fallback for people who will not give a
  phone number, rather than the primary channel. The consent plumbing already
  built stays exactly as it is.
- **Posts** are the genuinely ambiguous one. Group SMS is a known mess:
  reply-all storms, no threading, carrier limits. Proposal: posts stay in the
  app, and a text goes out only when an admin marks a note as important
  ("Parking on Thames is free after 10. Meet at the counter.") That keeps the
  channel scarce, which is the only thing that keeps it opened.

## Inbound parsing

Generous, because people type what they think rather than what the menu said.

```
yes  y  yeah  yep  yup  in  i'm in  1   → going
no   n  nope  can't  cant  out  2       → not going
maybe  m  mb  3                          → maybe
stop unsubscribe cancel end quit         → opt out (carrier handles too)
help info                                → help text
```

Anything else: `Didn't catch that. Reply Y, N or M. Or open <short link>.`

**The ambiguity problem.** A bare `Y` has to resolve to one circle and one
date. Someone in three circles with meets the same evening makes that
genuinely ambiguous.

Resolution: scope the reply to the **most recent outbound ask to that number**,
kept for 26 hours. If two asks are open when a reply lands, answer with a
disambiguation instead of guessing:

```
Which one? Reply 1 for Rofo Chicken (11pm) or 2 for Run Club (6:30pm).
```

Guessing is worse than asking. Marking the wrong person as going corrupts the
one number the product is selling.

## Compliance, which is heavier than email

Email got away with `List-Unsubscribe` and a suppression table. SMS is TCPA
territory and the rules have teeth.

- **Express written consent** before the first message, captured with the
  language and a timestamp. A checkbox is not enough on its own; the
  surrounding copy has to say what they are agreeing to receive.
- **STOP / HELP** handled at both the carrier layer and ours. Carriers honour
  STOP automatically; we still record it, or we keep trying to send and keep
  paying for messages that never arrive.
- **A2P 10DLC registration** is mandatory. The full field-by-field pack, with
  the copy written out, is in [A2P-REGISTRATION.md](A2P-REGISTRATION.md). Brand plus campaign, needs an EIN,
  takes days to weeks. Unregistered traffic is filtered silently rather than
  rejected loudly, which is the worst failure mode available: it looks like it
  works.
- **Phone numbers are heavier PII than email.** Same RLS discipline as
  everything else, plus they should never reach the client. A phone column on
  `profiles` readable by `anon` would be a serious mistake.
- **Quiet hours.** No sends before 8am or after 9pm local to the recipient.
  The timezone work already done makes this cheap: circles carry an IANA zone
  already.

## Cost

Using the figure already recorded in `PRODUCTION.md` (~$0.013 a message plus
roughly $15/month for the campaign):

One person, one circle, one week: the ask, their reply, the confirmation, and
the nudge. Four segments, about **$0.05 per person per week**, so roughly
**$2.70 a year**.

A thousand weekly actives is about **$2,900 a year** plus the campaign fee.
That is cheap for the core loop of the product, and it is the first per-unit
cost in the stack, which is worth noticing: every message has to earn itself.
The scarcity that implies is a feature.

## Build order

1. **A2P 10DLC registration.** Long pole, weeks of lead time, blocks
   everything else. Start it before writing any code.
2. **Phone on the profile, with real consent copy.** Optional at first, so it
   can be tested against a handful of pilots without touching signup.
3. **Outbound.** Reuse `due_email_reminders()` verbatim. The resolver already
   knows who is owed what and when, in the circle's own timezone, and already
   claims rows before sending so a retry cannot double-send. Only the
   transport changes.
4. **Inbound webhook.** One endpoint, signature-verified, the parser above,
   writes a check-in through the same path the buttons use so the trigger
   still guards the window.
5. **Phone as the credential.** Supabase OTP. This is the point where signup
   becomes a phone number and nothing else, which is where Doug started.

Steps 3 and 4 are small. The email infrastructure was the hard part and it is
already built and proven; this is a second transport hanging off the same
resolver.

## What this would tell us

If the texts carry the loop and the app gets quieter, that is the product
working, not failing. The number to watch is not sessions. It is **the share
of people who said yes who actually showed**, which is the subject of the next
piece of work and the one Doug actually asked about.
