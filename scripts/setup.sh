#!/bin/bash

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )/../backend/src"

cd "$SCRIPT_DIR"

python -m venv mvenv

source mvenv/bin/activate

pip install -r requirements.txt
