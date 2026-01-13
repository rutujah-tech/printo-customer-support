# Automatic Sheet3 Updates - Setup Guide

## What This Does

Automatically updates Sheet3 every hour with new conversations from November 20, 2025 onwards in the single-row format.

## Quick Setup (Recommended)

**Run this file as Administrator:**
```
setup-auto-update.bat
```

This will:
- Create a Windows scheduled task
- Run every hour automatically
- Update Sheet3 with new conversations
- Only process conversations from Nov 20 onwards

## Manual Setup (Alternative)

If the batch file doesn't work, create the scheduled task manually:

1. Open **Task Scheduler** (search in Windows Start menu)
2. Click **"Create Task"** (not "Create Basic Task")
3. **General tab:**
   - Name: `Printo Sheet3 Auto-Update`
   - Check: "Run whether user is logged on or not"
   - Check: "Run with highest privileges"
4. **Triggers tab:**
   - Click "New"
   - Begin the task: "On a schedule"
   - Settings: Daily
   - Repeat task every: 1 hour
   - Click OK
5. **Actions tab:**
   - Click "New"
   - Action: "Start a program"
   - Program: `node`
   - Arguments: `"C:\Users\Savitha Rosaline\printo-cs-assistant\printo-cs-assistant-app\aggregate-from-date.js"`
   - Start in: `C:\Users\Savitha Rosaline\printo-cs-assistant\printo-cs-assistant-app`
   - Click OK
6. Click OK to save the task

## How It Works

```
Every hour:
1. Script reads all conversations from Sheet1
2. Filters only conversations from Nov 20, 2025 onwards
3. Checks Sheet3 for existing session IDs
4. Adds only NEW conversations (no duplicates)
5. Sheet3 updates automatically
```

## Data Flow

```
Customer chats → Sheet1 (multi-row) → Auto-aggregator (hourly) → Sheet3 (single-row)
                   ↓ (immediate)                                      ↓ (hourly)
             Always saved                                    Only Nov 20 onwards
```

## Check If It's Running

**View scheduled task:**
```
schtasks /query /tn "Printo Sheet3 Auto-Update"
```

**Run it manually now:**
```
schtasks /run /tn "Printo Sheet3 Auto-Update"
```

## Disable Auto-Updates

If you want to stop automatic updates:

```
schtasks /delete /tn "Printo Sheet3 Auto-Update" /f
```

## Manual Update Anytime

You can still manually update Sheet3 anytime:

```bash
cd printo-cs-assistant-app
node aggregate-from-date.js
```

## What Gets Updated

- ✅ Sheet3: Auto-updates every hour with new conversations
- ✅ Only conversations from Nov 20, 2025 onwards
- ✅ No duplicates (incremental mode)
- ✅ Sheet1: Stays unchanged (raw data)

## Summary

**Before (Manual):**
- You run command → Sheet3 updates

**After (Automatic):**
- Every hour → Sheet3 updates automatically
- You don't need to do anything

**Result:**
- Sheet1: Raw logs (immediate)
- Sheet3: Aggregated format (updates hourly)
- Both stay in sync automatically
