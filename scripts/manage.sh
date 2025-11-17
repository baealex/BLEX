#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/../backend/src"

# Activate virtual environment
source "$SCRIPT_DIR/mvenv/bin/activate"

# Load environment variables
export $(cat "$SCRIPT_DIR/../.env" | xargs)

# Change to script directory to run manage.py
cd "$SCRIPT_DIR"

# Execute Django command with all passed arguments
python manage.py "$@"
