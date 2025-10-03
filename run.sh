#!/bin/bash

# Load NVM
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

# Use the correct Node.js version
nvm use default

# Verify we're in the right directory
echo "Current directory: $(pwd)"
echo "Node.js version: $(node --version)"
echo "API Key loaded: $([ -n "$ANTHROPIC_API_KEY" ] && echo 'Yes' || echo 'No')"

# Run the script
npm run dev
