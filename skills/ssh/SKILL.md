---
name: ssh
description: Use when connecting to remote machines or running commands over OpenSSH with a host alias, hostname, or IP address.
license: MIT
metadata:
  author: roman-pinchuk
  version: "1.0.0"
  repository: https://github.com/roman-pinchuk/agent-skills
---

# SSH

Use the system OpenSSH client for remote command execution. Prefer the user's
existing `~/.ssh/config`, SSH agent, identities, `known_hosts`, jump hosts, and
connection settings instead of duplicating them in a script or skill.

## Safety

- Never print private keys, passphrases, agent details, or secret environment variables.
- Preserve host-key verification. Do not use `StrictHostKeyChecking=no`, `UserKnownHostsFile=/dev/null`, or equivalent bypasses.
- Do not automate password entry. With `BatchMode=yes`, authentication and host-key prompts fail instead of blocking the agent.
- Treat remote commands as potentially destructive. Ask for confirmation before deleting data, changing services, modifying firewall or access settings, rebooting, or changing production state.
- Prefer read-only inspection before mutations and verify the resulting remote state after a mutation.
- Use `sudo -n` for non-interactive privilege escalation. If it requires a password or TTY, stop and report that requirement.
- Do not retry a state-changing command after a transport failure until the remote state has been inspected.

## Connection Workflow

1. Use the requested SSH config alias, hostname, IP address, or `user@host` exactly as provided.
2. Confirm the client is available with `ssh -V` when setup is uncertain.
3. Inspect effective configuration with `ssh -G TARGET` when diagnosing user, host, port, identity, proxy, or jump-host behavior. Do not expose sensitive values from the output.
4. Run a bounded, non-interactive connectivity check:

   ```bash
   ssh -T -n \
     -o BatchMode=yes \
     -o ConnectTimeout=10 \
     -o ServerAliveInterval=15 \
     -o ServerAliveCountMax=3 \
     TARGET 'true'
   ```

   `TARGET` may be an SSH config alias, an IP address, or `user@example.net`.
   An empty command such as `ssh TARGET ""` is not a meaningful health check.

5. Set a separate local command timeout for the overall agent operation. SSH keepalives detect an unresponsive connection but do not limit remote command runtime.

## Remote Commands

Use `-T` and `-n` for commands that do not need a terminal or standard input:

```bash
ssh -T -n -o BatchMode=yes -o ConnectTimeout=10 TARGET \
  'uname -s; id -un; pwd'
```

Single-quote the remote command so shell expansion happens on the remote host:

```bash
ssh ... TARGET 'printf "%s\\n" "$HOME"'
```

Do not interpolate untrusted text into a remote shell string. SSH passes the
command to the remote shell and does not provide local array-style argument
boundaries or shell escaping. Quote each value for the remote shell, or use a
fixed script with carefully separated input.

For a short multiline script, send the script to a remote shell. Omit `-n`
because standard input is intentionally used:

```bash
ssh -T -o BatchMode=yes -o ConnectTimeout=10 TARGET 'bash -s' <<'REMOTE_SCRIPT'
set -euo pipefail
cd /srv/app
git status --short
REMOTE_SCRIPT
```

Use `sh -s` instead of `bash -s` when the target is only known to provide POSIX
`sh`. Make the working directory explicit rather than relying on startup files.

## TTYs, Files, and Long Jobs

- Do not allocate a TTY by default. Use `-tt` only when the remote program explicitly requires one.
- Use `scp` or `sftp` only when file transfer is requested; preserve the same host-key and authentication rules.
- For work that must survive disconnection, use a deliberate remote job mechanism and verify its status. Do not assume a backgrounded process will survive SSH.
- Capture stdout and stderr separately when the caller needs machine-readable output. Keep diagnostics and secrets out of parsed output.

## Exit Status and Troubleshooting

SSH normally returns the remote command's exit status. A connection or SSH
client failure commonly returns `255`, but inspect stderr rather than relying
only on the number.

- `Permission denied (publickey)`: verify the requested user, SSH alias, loaded identity, and agent availability without exposing key material.
- `Host key verification failed`: stop and investigate the host identity or `known_hosts`; never bypass verification.
- `Connection timed out` or `No route to host`: report the bounded failure and check network access, port, firewall, and `ProxyJump` configuration.
- `sudo: a password is required` or a TTY error: stop and ask for a non-interactive authorization path or explicit user guidance.
- A remote non-zero status: report the command result and relevant stderr, then avoid speculative retries for mutations.
