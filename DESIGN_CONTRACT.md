# DESIGN CONTRACT — BErozgar / Campus OS

> **Status:** FROZEN  
> **Effective:** Immediately  
> **Rule:** No visual, animation, or interaction changes unless the user explicitly requests a design change.

---

## Table of Contents

1. [Color System](#1-color-system)
2. [Typography](#2-typography)
3. [Spacing & Layout](#3-spacing--layout)
4. [Shadows & Depth](#4-shadows--depth)
5. [Animation & Motion](#5-animation--motion)
6. [Cursor System](#6-cursor-system)
7. [Page Transitions](#7-page-transitions)
8. [Scroll Behaviour](#8-scroll-behaviour)
9. [Component Patterns](#9-component-patterns)
10. [3D Shield (Portal3D)](#10-3d-shield-portal3d)
11. [Fluid Mask (WebGL)](#11-fluid-mask-webgl)
12. [Per-Module Accent Map](#12-per-module-accent-map)
13. [Accessibility](#13-accessibility)
14. [Explicitly Forbidden Changes](#14-explicitly-forbidden-changes)

---

## 1. Color System

### 1.1 CSS Custom Properties (`index.css :root`)

| Token | Light Mode (HSL) | Dark Mode (HSL) |
|---|---|---|
| `--background` | `0 0% 100%` (white) | `0 0% 100%` (white)* |
| `--foreground` | `0 0% 0%` (black) | `0 0% 0%` (black)* |
| `--portal` | `0 0% 0%` (black) | `0 0% 100%` (white) |
| `--portal-foreground` | `0 0% 100%` (white) | `0 0% 0%` (black) |
| `--primary` | `195 100% 50%` | `195 100% 50%` |
| `--accent` | `180 80% 50%` | `180 80% 50%` |
| `--muted` | `0 0% 96.1%` | `0 0% 14.9%` |
| `--muted-foreground` | `0 0% 45.1%` | `0 0% 63.9%` |
| `--destructive` | `0 84.2% 60.2%` | `0 62.8% 30.6%` |
| `--secondary` | `0 0% 96.1%` | `0 0% 14.9%` |
| `--card` | `0 0% 100%` | `0 0% 3.9%` |
| `--popover` | `0 0% 100%` | `0 0% 3.9%` |
| `--border` | `0 0% 89.8%` | `0 0% 14.9%` |
| `--ring` | `0 0% 3.9%` | `0 0% 83.1%` |

> *Background/foreground intentionally stay the same across themes — the portal layer handles light/dark inversion.*

### 1.2 Tailwind Extended Colors (`tailwind.config.ts`)

| Token | Value |
|---|---|
| `portal` | `hsl(var(--portal))` |
| `portal-foreground` | `hsl(var(--portal-foreground))` |
| `primary` | `hsl(var(--primary))` — cyan `#00BFFF` equiv |
| `accent` | `hsl(var(--accent))` — teal |
| `sidebar-*` | Full set: background, foreground, primary, accent, border, ring |

### 1.3 Hard-coded Accent Colors

| Color | Hex | Usage |
|---|---|---|
| Module menu active | `#a3ff12` | MasterExperience module list, ContextNav admin link |
| Shield — Orange | `#FF9800` | Portal3D top-left section |
| Shield — Green | `#4CAF50` | Portal3D top-right section |
| Shield — Blue | `#2196F3` | Portal3D bottom section |
| Shield — Rim | Gold metallic | Portal3D rim `meshStandardMaterial` |
| Body background | `#ffffff !important` | `body` in `index.css` — required for cursor blend mode |

### 1.4 Per-Module Accent Colors

See [Section 12](#12-per-module-accent-map) for full per-page accent mapping.

---

## 2. Typography

### 2.1 Font Families (`tailwind.config.ts`)

| Role | Family | Tailwind Class |
|---|---|---|
| Display / Headings | **Syne** | `font-display` |
| Body / Mono labels | **Space Grotesk** | `font-body` |
| System mono | `ui-monospace, monospace` | `font-mono` |

### 2.2 Type Scale (`index.css` utility classes)

| Class | `font-size` | `font-weight` | `line-height` | `letter-spacing` |
|---|---|---|---|---|
| `.text-hero-massive` | `clamp(2rem, 8vw, 11rem)` | 800 | 0.8 | -0.04em |
| `.text-module-title` | `clamp(1.5rem, 4vw, 3.2rem)` | 800 | 1.05 | -0.03em |

### 2.3 Common Inline Patterns

| Pattern | Classes |
|---|---|
| Mono labels | `text-[10px] font-mono uppercase tracking-[0.3em]` or `tracking-widest` |
| Category badges | `text-[9px] uppercase tracking-widest` |
| Section counters | `font-mono text-lg md:text-xl` |
| Module numbers | `font-mono text-[10px] tracking-wider` |
| CTA buttons | `font-display uppercase tracking-wider text-sm` |

---

## 3. Spacing & Layout

### 3.1 Border Radius (`tailwind.config.ts`)

| Token | Value |
|---|---|
| `--radius` | `0.5rem` |
| `lg` | `var(--radius)` |
| `md` | `calc(var(--radius) - 2px)` |
| `sm` | `calc(var(--radius) - 4px)` |

### 3.2 Grid Patterns

| Pattern | Breakpoints |
|---|---|
| Listing grid | 1 col → 2 col (sm) → 3 col (lg) → 4 col (xl) |
| Module card grid | `grid-cols-1 lg:grid-cols-2` |
| Content max-width | `max-w-7xl mx-auto` (most pages) |

### 3.3 Corner Frame Pattern

All module pages use corner frame decorators at section boundaries:

```
top-left:     border-l-2 border-t-2  w-12 h-12
top-right:    border-r-2 border-t-2  w-12 h-12
bottom-left:  border-l-2 border-b-2  w-12 h-12
bottom-right: border-r-2 border-b-2  w-12 h-12
```

Positioned at `top-8 left-8` / `top-8 right-8` / `bottom-8 left-8` / `bottom-8 right-8`, `z-10`.  
Border color matches the page's module accent at `/{accent}-400/30`.

---

## 4. Shadows & Depth

### 4.1 CSS Custom Shadow Scale (`index.css`)

| Token | Value |
|---|---|
| `--shadow-soft` | `0 2px 8px rgba(0,0,0,0.04)` |
| `--shadow-medium` | `0 4px 16px rgba(0,0,0,0.08)` |
| `--shadow-strong` | `0 8px 32px rgba(0,0,0,0.12)` |

### 4.2 Z-Index Stack

| Layer | z-index |
|---|---|
| Page transition overlay | `z-60` |
| Cursor | `z-[9999]` (`.cursor-gooey`) |
| ContextNav | `z-50` (fixed) |
| Corner frames | `z-10` |
| Content | default |

---

## 5. Animation & Motion

### 5.1 GSAP Easing Curves (Canonical Set)

| Easing | Where Used |
|---|---|
| `power2.in` | Hero text parallax departure (TRUST) |
| `power2.inOut` | Landing page loader counter |
| `power2.out` | Hero text parallax (CENTRIC), stagger text reveal, glitch animation |
| `power3.out` | Content reveals (landing nav, CTA, scroll-triggered entries), listing grid stagger |
| `power3.inOut` | Page transition circle-wipe |
| `power4.out` | Landing page line reveals, SplitText `reveal` mode |
| `power4.inOut` | Loader slide-out, portal expansion (MasterExperience, AuthPortal) |
| `sine.inOut` | Landing page portal floating loop (yoyo) |

### 5.2 CSS Transition Easings (`index.css`)

| Token | Value |
|---|---|
| `--transition-smooth` | `cubic-bezier(0.16, 1, 0.3, 1)` |
| `--transition-bounce` | `cubic-bezier(0.34, 1.56, 0.64, 1)` |

### 5.3 Tailwind Keyframe Animations (`tailwind.config.ts`)

| Name | Behaviour | Duration / Easing |
|---|---|---|
| `accordion-down` | height 0 → `var(--radix-accordion-content-height)` | — |
| `accordion-up` | height → 0 | — |
| `portal-expand` | 350px circle → 100vw rect, border-radius 50% → 0 | 1.2s `cubic-bezier(0.16, 1, 0.3, 1)` |
| `text-split` | translateY(100%) → 0, opacity 0 → 1 | 1s `cubic-bezier(0.16, 1, 0.3, 1)` |
| `fade-in-up` | translateY(10px) → 0, opacity 0 → 1 | 0.8s `cubic-bezier(0.16, 1, 0.3, 1)` |
| `cursor-pulse` | scale 1 → 1.5 → 1, opacity 1 → 0 → 1 | — |
| `glitch-1` | translate + hue-rotate + clip-path | — |

### 5.4 CSS Keyframe Animations (`index.css`)

| Name | Behaviour |
|---|---|
| `glitch-anim-1` | translateX(-2px, 2px) + hue-rotate(0–360) + random clip-path |
| `glitch-anim-2` | translateX(2px, -2px) + hue-rotate(0–360) + random clip-path |
| `scan-line` | translateY(-100% → 100%) infinite | Used in `.hud-image-box::after` |
| `stagger-1` through `stagger-5` | `animation-delay` 0.1s–0.5s |

### 5.5 SplitText Component Modes

| Mode | Transform | Duration | Easing | Stagger |
|---|---|---|---|---|
| `fadeUp` | y:40, rotateX:-90°, perspective:1000px → origin | 0.8s | `power3.out` | 0.03s |
| `stagger` | x:-20 → 0 | 0.5s | `power2.out` | 0.03s |
| `reveal` | y:100% → 0 (overflow-hidden clip) | 1.0s | `power4.out` | 0.03s |
| `glitch` | random x(±20) y(±10) → 0 | 0.3s | `power2.out` | 0.03s |

Split types: `chars`, `words`, `lines`.  
Trigger options: `scroll` (start `top 80%`, toggleActions `play none none reverse`), `load`, `none`.

### 5.6 Component-Specific Timings

#### AuthPortal
- Scale: 0.5 → 1, border-radius: 50% → 0%, opacity: 0 → 1
- Duration: 1.2s, easing: `power4.inOut`
- Content: y:50 → 0, opacity 0 → 1, 0.8s, `power3.out`, overlap `-=0.4`

#### Landing Page Loader
- Counter 0 → 100: 2.4s, `power2.inOut`
- Progress bar: scaleX 0 → 1, 2.4s, `power2.inOut`
- Loader slide-out: yPercent -100, 1.0s, `power4.inOut`
- Nav brand/status: y:-20 → 0, 0.6s, `power3.out`
- Typography lines: yPercent:120 → 0, 0.9s, `power4.out`, staggered with `-=0.6` overlaps
- Portal: scale 0.6 → 1, 1.0s, `power3.out` → floating y:-12 yoyo 3s `sine.inOut`
- CTA: opacity/y:30 → 0, 0.7s, `power3.out`

#### MasterExperience Scroll
- Container: 500vh, scrub: 4
- TRUST: y → -100vh, 0.35s, `power2.in`
- CENTRIC: y → -60vh, 0.32s, `power2.out`
- EXCHANGE: y → 80vh, 0.35s, `power2.in`
- Portal expansion: 100vw/100vh, `power4.inOut`, 0.50s
- Symbol: scale 2.0 → fade to opacity 0, scale 1.6, blur 8px
- Module items: fade in at 0.38, stagger 0.02, y:30

#### ListingGrid Stagger Entry
- GSAP: y:30, rotateX:10, opacity:0 → origin, stagger 0.08, 0.8s, `power3.out`
- ScrollTrigger: start `top 85%`

#### ContextNav Fullscreen Menu
- Circle clip-path from top-right: 0% → 150%
- Nav items: stagger 0.1, x:100 → 0

---

## 6. Cursor System

### GooeyCursor.tsx

| Property | Value |
|---|---|
| Main blob size | 28px (default via prop) |
| Trail blob size | main × 1.5 |
| Trail opacity | 0.4 |
| Color | `white` |
| Blend mode | `mix-blend-mode: difference` |
| Main easing (lerp) | 0.15 |
| Trail easing (lerp) | 0.08 |
| Hover scale (main) | 2× on `a`, `button`, `.module-link`, `[role="button"]` |
| Hover scale (trail) | 1.5× on same elements |
| Touch detection | `matchMedia('(pointer: fine)')` — hidden on touch |
| CSS class | `.cursor-gooey` → `z-[9999]`, `pointer-events: none` |
| Global cursor hide | `.hide-global-cursor` → `cursor: none` on `body` (homepage) |

---

## 7. Page Transitions

### PageTransition.tsx

| Phase | Property | Value |
|---|---|---|
| Wipe-in | clip-path | `circle(0% at 50% 50%)` → `circle(150% at 50% 50%)` |
| Wipe-in | duration | 0.6s |
| Wipe-in | easing | `power3.inOut` |
| Hold | duration | 0.1s |
| Content-in | opacity | 0 → 1 |
| Content-in | scale | 0.95 → 1 |
| Content-in | duration | 0.4s |
| Content-in | easing | `power2.out` |
| Wipe-out | clip-path | `circle(150%)` → `circle(0%)` |
| Wipe-out | duration | 0.6s |
| Overlay | color | `bg-portal` |
| Overlay | z-index | `z-60` |

---

## 8. Scroll Behaviour

### MasterExperience (Homepage)

- Total scroll height: `500vh`
- GSAP ScrollTrigger with `scrub: 4`
- Text parallax: each word departs at different rates (see §5.6)
- Portal expansion tied to scroll position
- Module list fades in at normalized position 0.38

### Module Pages

- SplitText scroll triggers: `start: 'top 80%'`, `toggleActions: 'play none none reverse'`
- ListingGrid scroll trigger: `start: 'top 85%'`
- ContextNav scroll progress bar at bottom

### ContextNav Scroll Detection

- Dark-bg threshold: scroll > `0.06` of page height
- Per-page dark background list maintained in component

---

## 9. Component Patterns

### 9.1 ListingGrid Cards

| Property | Value |
|---|---|
| Aspect ratio | `aspect-[4/5]` |
| Border | `border border-white/5` |
| Background | `bg-white/10` |
| Image filter | `grayscale` → `grayscale-0` on hover |
| Image scale | `scale-105` → `scale-110` on hover |
| Transition | `duration-700` |
| Gradient overlay | `from-black via-black/20 to-transparent` |
| Corner frames | top-right + bottom-left, `border-2 border-primary`, translate ±4 → 0 on hover |
| Primary overlay | `opacity-10`, `mix-blend-overlay` on hover |
| Category badge | `bg-black/60 backdrop-blur-md text-[9px] uppercase tracking-widest` |
| Price | `text-primary font-display text-xl` |
| Institution tag | `text-[9px] uppercase tracking-[0.2em] text-white/40` |

### 9.2 HUD Image Box (`.hud-image-box`)

- Border: `1px dashed rgba(163, 255, 18, 0.3)`
- Scan-line pseudo-element: `::after` with `scan-line` animation
- Padding: `0.5rem`

### 9.3 Module Link Underline (`.module-link::after`)

- Pseudo-element underline: `scaleX(0)` → `scaleX(1)` on hover
- Transform origin flips: `bottom right` → `bottom left`

### 9.4 NotificationCenter

- Trigger: Bell icon, `rotate-12` open / `-rotate-12` hover
- Badge: `rounded-none bg-primary text-black animate-bounce`
- Panel: `bg-[#0a0a0a] border-white/10 rounded-none`
- Items: `p-6 border-b border-white/5 hover:bg-white/5`
- Header: "Notification Terminal" / "Global Protocol Alerts"
- Footer: "End of Operational Logs"

### 9.5 Auth Pages (Login / Signup / Verify)

- Form validation messages: `text-red-400 text-[11px]`
- CTA buttons: `bg-primary hover:bg-teal-400 text-black font-bold h-14 rounded-none`
- Glow: `bg-gradient-to-l from-primary/20 to-teal-500/20 blur-xl`
- Links: `text-primary hover:text-teal-300`

### 9.6 FAQ Accordion Pattern (MessPage, HospitalPage)

- Container: `border border-white/5 bg-white/[0.01]`
- Counter: `text-[10px] font-mono text-{accent}/40 tracking-widest`
- Title: `font-display text-base md:text-xl font-bold uppercase group-hover:text-{accent}/90`
- Chevron box: `w-8 h-8 border border-white/10`, rotates 180° when open
- Accent bg/border on open state

### 9.7 Glitch Text Pattern

Multi-layer absolute-positioned text with offset + opacity transitions:
```
Layer 1: text-{accent}/30, translate(2px, 2px)
Layer 2: text-red-400/20, translate(-1px, -1px)
Base:    text-white
```

Visible on `group-hover`, `transition-opacity duration-200`.

---

## 10. 3D Shield (Portal3D)

### Geometry Constants

| Constant | Value |
|---|---|
| `BODY_DEPTH` | 0.18 |
| `RIM_DEPTH` | 0.22 |
| Shield width | 0.78 |
| Shield heights | 0.88 / 1.0 (quadratic curves) |
| Rim scale factors | outer × 1.12 / 1.07 / 1.06 |

### Materials

| Part | Material | Properties |
|---|---|---|
| Body sections | `meshBasicMaterial` | Full brightness, unlit |
| Orange section | `meshBasicMaterial` | `#FF9800` |
| Green section | `meshBasicMaterial` | `#4CAF50` |
| Blue section | `meshBasicMaterial` | `#2196F3` |
| Rim | `meshStandardMaterial` | Gold metallic |
| Back faces | `meshBasicMaterial` | Same colors, `THREE.BackSide` |

### Animation

- Mouse-follow rotation (x/y axes)
- Auto Y-axis rotation (continuous)
- Z-offset: body at `z = -depth/2`, sections at `z = depth/2 + 0.01`

---

## 11. Fluid Mask (WebGL)

### FluidMaskCursor Configuration

| Parameter | Value |
|---|---|
| `MASK_RES` | 256 |
| `SIM_RESOLUTION` | 64 |
| `DYE_RESOLUTION` | 256 |
| `DENSITY_DISSIPATION` | 4.5 |
| `VELOCITY_DISSIPATION` | 3.0 |
| `PRESSURE` | 0.1 |
| `PRESSURE_ITERATIONS` | 20 |
| `CURL` | 5 |
| `SPLAT_RADIUS` | 0.22 |
| `SPLAT_FORCE` | 1800 |
| `SHADING` | true |

Architecture: GPU Navier-Stokes → white luminance mask → `canvas.toDataURL()` → CSS `mask-image` on reveal layer.

---

## 12. Per-Module Accent Map

Each module page has a unique accent color applied to corner frames, headings, badges, hover states, and gradient highlights.

| Page | Route | Accent Color | Tailwind Class |
|---|---|---|---|
| **Resale** | `/resale` | Primary / Teal | `primary`, `teal-400` |
| **Accommodation** | `/accommodation` | Cyan | `cyan-400` |
| **Mess / Tiffin** | `/mess` | Amber / Orange | `amber-400`, `orange-300` |
| **Hospital** | `/hospital` | Emerald / Red | `emerald-400` (general), `red-400` (critical/emergency) |
| **Academics** | `/academics` | Violet | `violet-400` |
| **Essentials** | `/essentials` | Violet (hub) + Amber (mess) / Emerald (hospital) per sub-module |
| **MasterExperience** | `/home` | `#a3ff12` (module list) |
| **Landing** | `/` | Emerald (status dot), primary (CTA) |

---

## 13. Accessibility

### Reduced Motion (`index.css`)

Full `@media (prefers-reduced-motion: reduce)` block:

- All `animation` and `transition` set to `none !important`
- `scroll-behavior: auto`
- Cursor blobs hidden
- Parallax disabled (`transform: none`)
- `ScrollTrigger` effects suppressed

### Skip-to-Content

`SkipToContent` component provides keyboard-accessible skip link.

### Focus States

Default Tailwind `focus-visible:ring` preserved on interactive elements.

---

## 14. Explicitly Forbidden Changes

The following changes **MUST NOT** be made without an explicit user request:

### Colors
- ❌ Do not modify CSS custom properties in `:root` or `.dark`
- ❌ Do not change `--primary: 195 100% 50%` or `--accent: 180 80% 50%`
- ❌ Do not alter per-module accent colors (§12)
- ❌ Do not change `#a3ff12` module menu accent
- ❌ Do not modify Portal3D shield colors (`#FF9800`, `#4CAF50`, `#2196F3`)
- ❌ Do not change `body { background-color: #ffffff !important }`

### Typography
- ❌ Do not swap Syne or Space Grotesk for other fonts
- ❌ Do not change `.text-hero-massive` or `.text-module-title` clamp values
- ❌ Do not alter the `font-display` / `font-body` / `font-mono` mapping

### Animation & Motion
- ❌ Do not change any GSAP easing curve listed in §5.1
- ❌ Do not alter SplitText animation modes or their parameters
- ❌ Do not modify page transition clip-path pattern or timing
- ❌ Do not change landing page loader sequence or durations
- ❌ Do not modify MasterExperience scroll timeline positions
- ❌ Do not alter `--transition-smooth` or `--transition-bounce` curves

### Cursor
- ❌ Do not change gooey cursor blob sizes, colors, or blend mode
- ❌ Do not alter lerp easing values (0.15 / 0.08)
- ❌ Do not change hover scale multipliers (2× / 1.5×)

### Layout
- ❌ Do not modify listing grid column breakpoints
- ❌ Do not change corner frame dimensions or positioning
- ❌ Do not alter card aspect ratios (`4/5`)

### 3D & WebGL
- ❌ Do not change Portal3D geometry constants
- ❌ Do not alter FluidMaskCursor simulation parameters
- ❌ Do not change fluid `SPLAT_RADIUS`, `SPLAT_FORCE`, `DENSITY_DISSIPATION`, or `CURL` values

### Interaction Patterns
- ❌ Do not change grayscale → color hover on listing cards
- ❌ Do not alter the circle clip-path wipe pattern (page transitions, nav menu)
- ❌ Do not modify NotificationCenter panel styling or terminology
- ❌ Do not change auth button style (`rounded-none`, `bg-primary hover:bg-teal-400`)

---

*This contract documents the design system as it exists. It is a reference, not a roadmap. All values are drawn directly from source code. Any deviation requires explicit user approval.*
