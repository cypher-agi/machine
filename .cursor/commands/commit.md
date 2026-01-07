# /commit

Commit and push the latest changes to the remote repository.

## Instructions

1. First, check the current git status to see what files have changed
2. Stage all changes with `git add -A`
3. Ask the user for a commit message, or generate a concise, descriptive commit message based on the staged changes
4. Commit with the message
5. Push to the current branch on origin

## Example Usage

```
/commit
```

Or with a message:
```
/commit fix: resolve SSH key sync issue
```

## Command Flow

```bash
# Check status
git status

# Stage all changes
git add -A

# Commit (use provided message or generate one)
git commit -m "<message>"

# Push to origin
git push origin HEAD
```





