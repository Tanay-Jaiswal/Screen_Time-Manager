# WellScreen — Intelligent Screen Time & Digital Well-Being Controller

## Overview
A polished Expo React Native app that monitors smartphone screen usage, evaluates behavior using fuzzy logic, sends alerts, and provides parent notification support.

## Tech Stack
- **Frontend**: Expo Router (file-based routing), React Native, TypeScript
- **State**: React Context + AsyncStorage (local persistence)
- **UI**: Inter font, @expo/vector-icons, expo-linear-gradient, expo-haptics
- **Backend**: Express.js (port 5000) — serves landing page and API

## Architecture

### Key Files
- `lib/fuzzyLogic.ts` — Fuzzy logic engine (membership functions, defuzzification, risk evaluation)
- `lib/screenTimeContext.tsx` — Global state for sessions, stats, notifications, parent settings
- `app/(tabs)/_layout.tsx` — Tab navigation with NativeTabs (iOS 26+ liquid glass) / Tabs fallback
- `app/(tabs)/index.tsx` — Dashboard screen
- `app/(tabs)/log.tsx` — Log usage session screen
- `app/(tabs)/alerts.tsx` — Notifications & fuzzy logic explanation
- `app/(tabs)/settings.tsx` — Parent settings, notification toggles, data management
- `constants/colors.ts` — Dark navy theme palette

### Fuzzy Logic Engine
Uses membership functions for:
- Screen time duration (low/medium/high)
- Distraction ratio (low/high)
- Session frequency (low/high)
- Late-night factor

Rules classify behavior as: **Healthy** / **Warning** / **Addictive**

### App Categories
- **Productive**: Notion, Duolingo, GitHub, Coursera, etc.
- **Neutral**: Maps, Spotify, Safari, etc.
- **Distracting**: Instagram, TikTok, YouTube, Games, etc.

## Workflows
- `Start Backend`: `npm run server:dev` (port 5000)
- `Start Frontend`: `npm run expo:dev` (port 8081)

## Features
1. Dashboard with total/productive/distracting breakdown and weekly chart
2. Manual session logging with app picker modal
3. Fuzzy logic risk evaluation (Healthy/Warning/Addictive)
4. In-app alert system with unread badge
5. Parent contact settings with daily report preview
6. Notification toggles and data reset
