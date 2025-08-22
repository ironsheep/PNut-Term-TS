## 🚨 CRITICAL: File System Access Rules
**FILESYSTEM MCP IS YOUR PRIMARY TOOL - ALWAYS USE IT FIRST**

#### GO-TO Tools (Use These FIRST):
- `mcp__filesystem__read_text_file` - NOT cat, NOT Bash read
- `mcp__filesystem__read_multiple_files` - Batch reading files
- `mcp__filesystem__write_file` - NOT echo, NOT Bash write
- `mcp__filesystem__edit_file` - For precise edits
- `mcp__filesystem__search_files` - NOT find, NOT grep for filenames
- `mcp__filesystem__list_directory` - NOT ls, NOT Bash listing
- `mcp__filesystem__create_directory` - NOT mkdir
- `mcp__filesystem__get_file_info` - NOT stat

#### ONLY Use Bash For:
- Git operations (git add, commit, diff, status)
- External programs (npm, python, compilers)
- Text processing on content (sed, awk - but prefer MCP edit)
- Running/testing code

#### Why Filesystem MCP First:
- Faster response times (no shell overhead)
- More reliable (built-in error handling)
- Better for context (structured responses)
- Reduces API latency impact

**REMEMBER: If you're about to use Bash for file operations, STOP and use filesystem MCP instead!**