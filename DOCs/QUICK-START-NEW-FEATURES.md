# Quick Start Guide - New Features
*PNut-Term-TS v0.9.85*

## 🚀 What's New

This guide covers the major new features added to PNut-Term-TS:
- Streamlined menu system
- Preferences dialog for customization
- Performance monitoring dashboard
- Binary recording & playback system

---

## 📋 New Menu Structure

### What Changed?
- **Debug menu removed** - Windows now open automatically from P2
- **Settings moved** - Now under Edit → Preferences (Ctrl+,)
- **Performance Monitor added** - Access via Window menu

### Quick Access
- **Preferences**: `Ctrl+,` or Edit → Preferences
- **Performance Monitor**: Window → Performance Monitor
- **Start Recording**: `Ctrl+R` or click ⏺ button
- **Playback**: `Ctrl+P` or click ▶ button

---

## ⚙️ Preferences Dialog

### How to Open
Edit → Preferences or press `Ctrl+,`

### Quick Settings
1. **Change Terminal Mode**: Terminal section → Terminal Mode dropdown
2. **Switch Themes**: Terminal section → Color Theme dropdown
3. **Control Line Setup**: Serial Port section → DTR/RTS radio buttons
4. **Enable Auto-Logging**: Logging section → Auto-save checkbox

> **Note**: Settings apply immediately but aren't saved between sessions yet.

---

## 📊 Performance Monitor

### Opening the Monitor
Window → Performance Monitor

### What to Watch
- **Green throughput line**: Should be steady
- **Buffer bar < 80%**: Good performance
- **Queue depth < 100**: Normal operation
- **Status symbol ✓**: System healthy

### Troubleshooting with Monitor
- **High buffer usage**: Reduce baud rate or close windows
- **Growing queue depth**: System can't keep up, reduce data rate
- **Red status ✗**: Check for errors in Active Windows list

---

## 🎬 Recording System

### Quick Recording
1. **Start**: Click ⏺ or press Ctrl+R
2. **Stop**: Click ⏹ or press Ctrl+R again
3. **Files saved**: `./recordings/recording_[timestamp].p2rec`

### Quick Playback
1. **Open**: Click ▶ or press Ctrl+P
2. **Select**: Choose .p2rec file
3. **Control**: Use playback bar (appears automatically)
   - Click progress bar to seek
   - Change speed with dropdown (0.5x, 1x, 2x)
   - Pause/resume with ⏸/▶ buttons

### Common Use Cases

#### Capture a Bug
```
1. Start recording before running P2 code
2. Reproduce the issue
3. Stop recording
4. Share .p2rec file with team
```

#### Test Window Changes
```
1. Load a recording with File → Open Recording
2. Make window changes
3. Play recording to verify windows handle data correctly
```

#### Create Training Materials
```
1. Record a clean demo session
2. Save with descriptive name
3. Students can replay to learn
```

---

## 💡 Pro Tips

### Performance Optimization
1. **Before debugging**: Open Performance Monitor
2. **If sluggish**: Check buffer usage and queue depth
3. **For heavy data**: Lower baud rate in Preferences

### Recording Best Practices
1. **Always record debugging sessions** - Never lose a bug reproduction
2. **Name files descriptively** - Include date, test name, outcome
3. **Keep recordings organized** - Create project folders

### Keyboard Efficiency
- `Ctrl+,` → Quick settings access
- `Ctrl+R` → Toggle recording
- `Ctrl+P` → Quick playback
- `F1` → Help when stuck

---

## 🆘 Quick Fixes

### "Can't see Performance Monitor"
→ Window → Performance Monitor

### "Settings aren't saving"
→ Normal - persistence coming in next version

### "Recording won't start"
→ Check disk space, recordings folder permissions

### "Playback timing seems off"
→ Close other applications to free CPU

### "Debug windows won't open"
→ Windows open from P2 DEBUG commands, not menu

---

## 📚 Next Steps

1. **Explore Preferences**: Try different themes and settings
2. **Monitor Performance**: Keep Performance Monitor open while debugging
3. **Record Everything**: Build a library of test recordings
4. **Read Full Guide**: See USER-GUIDE-UPDATED.md for complete details

---

*Happy Debugging! 🐛*