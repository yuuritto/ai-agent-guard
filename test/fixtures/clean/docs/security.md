# Security notes

Never run the agent with `--dangerously-skip-permissions`. Grant narrow, named
permissions instead so destructive commands still stop for review.

Prose that names the flag must not be reported — otherwise this tool is loudest in
the repositories that document it properly.
