# A2P 10DLC registration pack

> Everything a carrier will ask, with the answers written out. Prepared
> 2026-09-14. The point of this file is that the copy fields are where
> campaigns get rejected, and they get rejected days later, so getting them
> right the first time is worth an hour now.

## Read this first: what can and cannot be submitted today

Registration is two separate things and they have different blockers.

**Brand** describes who you are. Nothing in the product gates it. **Submit it
today.**

**Campaign** describes what you will send and, critically, **how people opt
in**. Reviewers check the described opt-in against the live site. Right now
there is no phone field anywhere in Circles: `profiles` has no phone column
and there is no consent screen. Submitting a campaign that describes an
opt-in flow a reviewer cannot find is the most common way to get rejected,
and a rejection costs a resubmission fee and another wait.

So the order is: **brand now, opt-in screen live, then campaign.** The opt-in
screen is small, perhaps an hour, and it is the next thing to build.

---

## Which brand type

The fork is whether you have an **EIN**.

| | Sole Proprietor | Standard |
|---|---|---|
| Needs an EIN | No | Yes |
| Verification | OTP to your own mobile | Business records |
| Throughput | Low, roughly 1 message/sec | Higher, tiered by vetting score |
| Daily cap to T-Mobile | A few thousand segments | Much higher |
| Good for | A pilot | Once flyers are out |

**For the pilot, Sole Proprietor is the right answer** and it is fast. A few
thousand segments a day is far beyond what a handful of circles will use:
per the cost working in `SMS-LOOP.md`, a person in one circle uses about four
segments a week.

Plan to re-register as Standard before any real flyer campaign. Confirm the
current throughput numbers in Twilio's console rather than trusting this
table; the tiers move.

---

## Brand registration fields

| Field | Answer |
|---|---|
| Legal entity name | your legal name, or the LLC if one exists |
| Entity type | Sole Proprietor (or the registered type) |
| EIN / Tax ID | only for Standard |
| Country | US |
| Address | the registered address |
| Website | `https://hicircles.com` |
| Vertical / industry | Technology, or Social Networking if offered |
| Contact name | Ben Bookstaver |
| Contact email | `benjamin@hicircles.com` |
| Contact phone | your mobile, the one that receives the OTP |
| Job title | Founder |

The website matters more than it looks. Reviewers open it. It should describe
the product plainly and carry a privacy policy and terms.

**Gap:** `hicircles.com` has neither a privacy policy nor terms of service.
Campaign review generally wants both, and a privacy policy specifically
saying that phone numbers are collected, what they are used for, and that
they are not sold or shared for marketing. Worth writing before the campaign
goes in, not after it comes back.

---

## Campaign registration fields

**Use case:** `Account Notification`. This is notification about something the
person has an account-level relationship with, which is exactly what a
reminder for a circle you joined is. It is not Marketing, and calling it
Marketing would invite both stricter review and worse deliverability.

Login OTP, if phone becomes the credential later, is a different use case and
may not belong on this campaign at all. Check whether it goes through Twilio
Verify, which has its own path.

**Campaign description** (paste as is):

> Circles is a web app for local groups that meet on a recurring schedule,
> such as a weekly run club or a monthly book club. Members who choose to add
> a phone number receive reminders before a meeting of a group they have
> joined: one the day before and one a few hours before. Members reply Y, N
> or M to say whether they are coming, and receive a short confirmation. No
> marketing or promotional content is sent on this campaign.

**Opt-in type:** Web form.

**Opt-in flow description** (this is the field reviewers check hardest, so it
describes exactly what the screen will do):

> A signed-in member goes to their profile page at hicircles.com/profile and
> enters a mobile number in an optional field labelled "Text me before my
> circles meet". Directly beside the field is an unticked checkbox reading:
> "Text me reminders before my circles meet. Message and data rates may
> apply. Message frequency varies by how often your circles meet. Reply STOP
> to cancel, HELP for help." The member must tick the box and press Save.
> Nothing is sent to a number that has not been through this screen, and the
> checkbox is never pre-ticked. The number and the time of consent are stored
> against the member's account.

**Sample messages.** These must match what is actually sent, so the app has to
send these. Note the STOP line in the first one, which the draft copy in
`SMS-LOOP.md` did not have and now needs.

1. `Circles: Late Night Rofo Chicken meets tomorrow 11pm at Fleet Street Royal Farms. Coming? Reply Y, N or M. Reply STOP to stop.`
2. `Circles: you're in. 5 going so far: Sam, Kaya, Kian +2. See you there.`
3. `Circles: Rofo Chicken in 3 hours, 11pm, Fleet Street Royal Farms. 6 going.`
4. `Circles: no problem. Next one is Friday the 26th.`

**Opt-out message:**

> `Circles: you will not get any more texts from us. Reply START to turn them back on.`

**Help message:**

> `Circles sends reminders before groups you have joined meet. Reply STOP to stop. Help: benjamin@hicircles.com`

**Other declarations:**

| Question | Answer |
|---|---|
| Embedded links | Yes, occasionally a link to the circle page |
| Embedded phone numbers | No |
| Age-gated content | No |
| Direct lending | No |
| Affiliate marketing | No |
| Subscriber opt-in | Yes |
| Subscriber opt-out | Yes |
| Subscriber help | Yes |

---

## The order

1. **Today:** Twilio account, then Brand registration. Nothing blocks it.
2. **Next, about an hour of work:** the phone field and consent checkbox on
   the profile, with the exact wording above, plus a `phone` and
   `phone_consent_at` on `profiles`. It has to be live and reachable before
   the campaign is reviewed.
3. **Then:** submit the campaign with the copy above.
4. **Also before review:** a privacy policy and terms at `hicircles.com`,
   with the phone-number paragraph.
5. **While waiting:** build the outbound and inbound halves. They hang off
   `due_email_reminders()`, which already knows who is owed what and claims
   rows before sending, so only the transport changes.

## Two things to get right, which are easy to get wrong

**Never send to a number that did not tick the box.** Not to pilot users you
know, not to yourself from a seed script, not "just to test". Consent has to
be real and recorded, because the record is the defence.

**Record STOP yourself.** Carriers honour it at their layer, so the message
never arrives, but if we keep queueing sends we keep paying for them and our
own numbers stay out of step with reality. The email suppression table is the
model: `email_suppressions` already does exactly this job for the other
channel, and the phone version should mirror it.
