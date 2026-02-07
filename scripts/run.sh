#!/bin/bash
# Deriv Token Generator Runner
# Activates venv and runs the Python script

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

# Activate virtual environment
source venv/bin/activate

# Run the Python script with passed arguments
python create_deriv_token_final.py "$@"

# Deactivate when done
deactivate
