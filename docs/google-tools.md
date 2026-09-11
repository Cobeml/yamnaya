# Google tools through your website allowance

Yamnaya uses your signed-in Gemini or Google AI Studio website session for image generation. It does not connect to the Gemini API, buy credits, or switch to a paid API when a website quota is reached. Google displays and enforces your account's current website allowance; Yamnaya cannot read that balance.

## Image workflow

1. In **Sites**, open a publication and expand **Google image studio**. Write an image brief and caption, or ask an agent to prepare one with `camp_request_image`.
2. Copy the prompt and open Gemini or AI Studio. Use the same Google account as your subscription and choose the site's included generation mode. Stop when Google reports your limit; the camp does not purchase extra usage.
3. Download the result and use **Import generated image** on the pending brief. PNG, JPEG and WebP inputs are accepted. The browser resizes and compresses the image for a bounded document upload.
4. The imported illustration, prompt provenance and caption become versioned Quarto source files. The homepage includes the illustration with an AI-generated label. Render the new revision and review it before publication.

Requests remain **awaiting your Google generation** until you import an image or cancel them. An agent's image request is a human handoff, not an image-generation receipt. An import records operator provenance; it does not independently authenticate Google's authorship. Images are stored as self-contained SVG files embedding a JPEG, so source previews and published sites need no Google session or external image host.

Google's product limits can change. See the current [Google AI Pro benefits](https://support.google.com/googleone/answer/14534406?hl=en) and [Gemini app limits](https://support.google.com/gemini/answer/16275805?hl=en). AI Studio may also present separately billed API/project options; these are outside this workflow.

Other useful subscription tools include Gemini's research features and Google Flow for visual exploration. Their website outputs can inform camp instructions and documents. Yamnaya currently provides the complete request/import workflow for images; it does not automate those websites or claim access to their quota counters.
