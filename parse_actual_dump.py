import sys
import os

# Let's see what is inside FW_ANALYSIS or test files
print("Checking workspace files...")
for f in os.listdir('.'):
    if f.endswith('.bin') or f.endswith('.txt'):
        print(f, os.path.getsize(f))
