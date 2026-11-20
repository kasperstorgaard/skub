# Player feedback

## Problem

Ratings only come from Kasper's local rating flow. A fresh-player push is
coming, and its feedback should be captured without being pushy: both the
"sure, I'll rate this" players who rate when asked, and the ones who come
looking to say something after a good or bad experience.

## Approach

One feedback dialog, two shapes:

- **About a puzzle:** difficulty (too easy / just right / too hard), liked
  (thumbs up/down) and an optional line.
- **About the game:** a message.

Both take an optional reply address, the same as puzzle submission.

Sent feedback goes three ways: stored in KV (every piece by id, plus the latest
rating per player and puzzle), emailed to `SUBMISSIONS_EMAIL` the way
submissions are, and tracked as `feedback_sent` (message included, reply address not). It counts as sent once KV or
the email takes it. Without JS it posts and 303s back with
`dialog=feedback-sent`. With JS it fetches and stays on the page, so a solved
board isn't reloaded and re-posted.

### Where it's offered

- **Celebration slot (`prompted`):** the second call to action, beside See
  solutions, becomes a rotation picked by the server, deterministically per
  player and puzzle, so a reload never flips it. Play one more on a player's
  first solve (still onboarding). Rate it on the second (a first impression
  from new players). After that, a third each of Rate it, Build your own (folded
  in from #302) and Play one more. A puzzle already rated gets Play instead of
  Rate.
- **Celebration icon (`celebration`):** a small rate icon beside "Thanks for
  playing", on every celebration, for players who want to say something whether
  or not they were asked.
- **Solutions page nudge (`nudge`):** "How was it? Rate it" for a player who
  has solved the puzzle and hasn't rated it.
- **Sidebar (`panel`):** on the profile and high score pages, "Got thoughts?
  Send feedback" replaces "Build a puzzle". It's about the game, not a puzzle.
  Every other page keeps the builder link.

The source is stored and tracked, so prompted ratings can be told apart from
the ones players went looking to give.

## Non-goals

- Showing ratings anywhere, or using them in scoring yet. They're stored for
  that, keyed one per player and puzzle.
- Rate limiting: same stance as submissions, revisit if abused.
- A rate action on the puzzle page itself outside the celebration.
