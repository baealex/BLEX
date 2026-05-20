#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/../backend/src"
ENV_FILE="$SCRIPT_DIR/../.env"
SAMPLE_ENV_FILE="$SCRIPT_DIR/../../samples/.env"

if [ ! -f "$ENV_FILE" ] && [ -f "$SAMPLE_ENV_FILE" ]; then
    cp "$SAMPLE_ENV_FILE" "$ENV_FILE"
fi

cd "$SCRIPT_DIR"

python -m venv mvenv

source mvenv/bin/activate

pip install -r requirements.txt
