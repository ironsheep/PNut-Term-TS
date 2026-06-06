#!/bin/bash
# Workspace shell customizations — appended to ~/.bashrc by the devcontainer postCreate.

export PATH="$HOME/.local/bin:$PATH"

# Large TS/Electron builds need more heap than the 2G default (project-grounded).
export NODE_OPTIONS="--max-old-space-size=8192"

alias lsf='ls -F'
alias myclaude='claude --dangerously-skip-permissions --verbose'
