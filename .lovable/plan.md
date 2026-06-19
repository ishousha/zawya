## Fix: Speaker Image Deformation

### Problem
Speaker photos uploaded in Special Guests are stretched/squished across all display locations (admin list, event detail, event card badge).

### Root Cause
The shadcn `AvatarImage` component does not apply `object-cover`, so non-square images are squished to fit the circular avatar bounds.

### Fix
Add `className="object-cover"` to `<AvatarImage>` in these three components:

1. `src/components/admin/SpeakerManagement.tsx` — list avatars and dialog preview
2. `src/components/FeaturedSpeaker.tsx` — event detail speaker card
3. `src/components/SpeakerBadge.tsx` — event card badge

This preserves the photo's aspect ratio by center-cropping it into the circle instead of stretching.

### Out of Scope
Upload-time image cropping, forced square uploads, or changing the avatar shape from circle to rounded square.