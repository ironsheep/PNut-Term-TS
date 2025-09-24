# PNut-Term-TS Command Line Setup Guide

This guide explains how to set up the `pnut-term-ts` command on your system after installation.

## Quick Setup

After installing PNut-Term-TS, you need to add it to your PATH to use the `pnut-term-ts` command from anywhere.

### macOS

1. **Install the app**:
   - Drag `PNut-Term-TS.app` to `/Applications`

2. **Add to PATH**:
   ```bash
   echo 'export PATH="/Applications/PNut-Term-TS.app/Contents/Resources/bin:$PATH"' >> ~/.zshrc
   source ~/.zshrc
   ```

   For bash users (older macOS):
   ```bash
   echo 'export PATH="/Applications/PNut-Term-TS.app/Contents/Resources/bin:$PATH"' >> ~/.bash_profile
   source ~/.bash_profile
   ```

3. **Verify**:
   ```bash
   which pnut-term-ts
   pnut-term-ts --version
   ```

### Windows

1. **Install the application**:
   - Copy the `pnut-term-ts` folder to `C:\Program Files\`

2. **Add to PATH** (as Administrator):

   **Option A: Command Line**
   ```cmd
   setx /M PATH "%PATH%;C:\Program Files\pnut-term-ts"
   ```

   **Option B: GUI**
   - Right-click "This PC" → Properties
   - Click "Advanced system settings"
   - Click "Environment Variables"
   - Under "System variables", select "Path" and click "Edit"
   - Click "New" and add: `C:\Program Files\pnut-term-ts`
   - Click OK on all windows

3. **Verify** (open new Command Prompt):
   ```cmd
   where pnut-term-ts
   pnut-term-ts --version
   ```

### Linux

1. **Install the application**:
   ```bash
   sudo tar -xzf pnut-term-ts-linux.tar.gz -C /
   # Or use the install script if provided:
   sudo ./install.sh
   ```

2. **Add to PATH**:
   ```bash
   echo 'export PATH="/opt/pnut-term-ts/bin:$PATH"' >> ~/.bashrc
   source ~/.bashrc
   ```

   For zsh users:
   ```bash
   echo 'export PATH="/opt/pnut-term-ts/bin:$PATH"' >> ~/.zshrc
   source ~/.zshrc
   ```

3. **Verify**:
   ```bash
   which pnut-term-ts
   pnut-term-ts --version
   ```

## How It Works

The `pnut-term-ts` command is a launcher script that:
1. Finds the Electron runtime in the installation directory
2. Launches it with the TypeScript entry point (`pnut-term-ts.min.js`)
3. Passes all command-line arguments through
4. Preserves your working directory context

### File Locations

| Platform | Launcher Location | Type |
|----------|------------------|------|
| macOS | `/Applications/PNut-Term-TS.app/Contents/Resources/bin/pnut-term-ts` | Shell script |
| Windows | `C:\Program Files\pnut-term-ts\pnut-term-ts.cmd` | Batch file |
| Linux | `/opt/pnut-term-ts/bin/pnut-term-ts` | Shell script |

## Troubleshooting

### "Command not found" error

1. **Check PATH is set**:
   - macOS/Linux: `echo $PATH | grep pnut-term-ts`
   - Windows: `echo %PATH% | findstr pnut-term-ts`

2. **Restart terminal**: PATH changes require a new terminal session

3. **Check installation**:
   - macOS: `ls -la /Applications/PNut-Term-TS.app/Contents/Resources/bin/`
   - Windows: `dir "C:\Program Files\pnut-term-ts\"`
   - Linux: `ls -la /opt/pnut-term-ts/bin/`

### Permission denied (Linux/macOS)

```bash
# Fix permissions
chmod +x /opt/pnut-term-ts/bin/pnut-term-ts  # Linux
chmod +x /Applications/PNut-Term-TS.app/Contents/Resources/bin/pnut-term-ts  # macOS
```

### Working with VSCode

Once in your PATH, VSCode can launch pnut-term-ts from:
- Terminal: Just type `pnut-term-ts`
- Tasks: Add to `tasks.json`
- Extensions: Can invoke the command

## Advanced Usage

### Custom Installation Locations

If you install to a non-standard location, adjust the PATH accordingly:

```bash
# Example for custom location
export PATH="/my/custom/path/pnut-term-ts/bin:$PATH"
```

### Multiple Versions

To run multiple versions, use full paths or create aliases:

```bash
# In ~/.bashrc or ~/.zshrc
alias pnut-term-ts-dev="/opt/pnut-term-ts-dev/bin/pnut-term-ts"
alias pnut-term-ts-stable="/opt/pnut-term-ts/bin/pnut-term-ts"
```

## Uninstalling

### macOS
1. Remove from PATH: Edit `~/.zshrc` or `~/.bash_profile`
2. Delete app: Move `/Applications/PNut-Term-TS.app` to Trash

### Windows
1. Remove from PATH: Edit System Environment Variables
2. Delete folder: Remove `C:\Program Files\pnut-term-ts\`

### Linux
1. Remove from PATH: Edit `~/.bashrc` or `~/.zshrc`
2. Delete installation: `sudo rm -rf /opt/pnut-term-ts`

## Support

For issues or questions:
- Check the [main documentation](../README.md)
- Report issues on GitHub
- Verify your installation matches the [Distribution Preparation Plan](project-specific/DISTRIBUTION_PREPARATION_PLAN.md)