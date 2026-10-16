# Circle visual assets

## Active cloud cottage assets

`cloud-cottage.webp` is the generated moonlit plush-room background. Five
transparent horizontal three-pose strips supply the decorative NPCs:

- `alfred.webp`: yellow Alfred, glasses and bow tie.
- `iggy.webp`: pink Iggy, headphones.
- `felipe.webp`: blue Felipe, beret.
- `todd.webp`: green Todd, big eyes and **black bow tie**.
- `jojo.webp`: magenta heart-shaped Jojo, sunglasses.

These assets were generated from the five user-supplied character references.
Exact prompts and generation provenance are preserved beside each asset in its
`.webp.json` sidecar. Each companion strip contains three equal horizontal cells;
CSS selects neutral, station and reaction poses and adds hopping, squash/stretch
and station gestures. `companions.ts` is the canonical name and demo-member
mapping; `room-motion.ts` owns the five station coordinates. Optimized public
copies are served from `next-app/public/circles`.

The room always shows five decorative companions independently of member count.
Their routines, greetings and gathering do not indicate live agent or member
activity. Progress appears only in explicitly fictional demo sessions. The same
strips illustrate demo header avatars, constellation members and feed authors;
real-account identities in those surfaces use initials. Scene materials stay
local to the room; community chrome retains the shared workspace theme.

## Historical people and scene assets

The following portrait, photo and six-human clubhouse assets describe earlier
Circles compositions and are not the current NPC room or demo-avatar source.
The locally hosted handwriting font remains active for milestone callouts.

`portraits.png` is a generated 3 × 2 sheet of six fictional people. CSS uses each
cell as a portrait only in explicitly fictional demo mode. Real members use
initials; these images must never imply verified identities or profile photos.

Generated with the built-in image generator on 2026-10-15. Prompt: Create a
production web asset: a 3 columns by 2 rows contact sheet of SIX DISTINCT fictional
young adult professional headshot portraits, each cell exactly equal sized, all
six faces centered with generous head and shoulders margins, circular cropping
safe. First row: East Asian woman long dark hair warm smile; South Asian man short
hair clean shaven; white man with glasses curly dark hair beard. Second row:
Black man with glasses close cut hair; South Asian woman shoulder length hair;
white woman wavy brown hair. Photorealistic natural candid professional portraits,
warm soft lighting, navy grey studio backgrounds. No text, no labels, no grid
borders, no graphics, no circles cut into photo. All portraits subtly different
backgrounds, consistent camera scale, friendly human community not corporate
stock. Wide image aspect ratio 3:2.

`handwriting.ttf` is Caveat Regular, served locally. Source:
https://fonts.gstatic.com/s/caveat/v23/WnznHAc5bAfYB2QRah7pcpNvOx-pjfJ9SII.ttf
License: SIL Open Font License, included alongside the font.

`scenes.png` is a generated two-band photographic asset, used as a decorative
header and opportunity backdrop. It does not depict a real employer or event.
Prompt: Create one production website photo asset divided into TWO equal
horizontal panorama bands, exactly upper half and lower half, no border or
margin. Overall wide landscape 3:2. UPPER HALF: cinematic quiet alpine mountain
range at dusk, dark navy pine forest silhouette foreground, layered mountains
and subtle peach sky, elegant realistic landscape photography, dark enough for
white UI overlays. LOWER HALF: close architectural photograph of a modern glass
and steel technology company building with dramatic angular facade, navy blue
glass reflections of late afternoon sky, no logos no signs no people no letters.
Cohesive understated navy blue and warm dusk palette in both. No text, no UI,
no decoration. Each half is independently usable as a very wide web banner
cropped around its center.

## Historical clubhouse room

`clubhouse.webp` is the generated empty study clubhouse background (1536 × 1024).
`characters.webp` is a generated transparent 3 × 2 sheet of six illustrated adult
avatars (1374 × 1145). These are decorative game avatars, not member photographs.
Both were produced with the built-in image generator on 2026-10-15 and compressed
with cwebp. The complete generation prompts are preserved in `room-prompts.json`.
Room movement is decorative and does not indicate real online presence. Only the
explicitly fictional demo has invented activity and session progress.

The superseded `walking.webp` contains six identity columns and three gait rows. The renderer
uses the authored 300px row pitch (the sheet includes bottom padding) and plays
0–1–2–1 while the actor travels a floor route. `stations.webp` is a 3 × 2 sheet:
Wesley seated at a desk, Maya waving, Sam writing, Alex reading, Jordan seated
with coffee, and Priya seated at a desk. Both are generated with the built-in
image tool; exact prompts live in the adjacent `.webp.json` provenance files.
