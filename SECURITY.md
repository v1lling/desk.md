# Security Policy

## Supported versions

Desk is actively developed and only the **latest release** receives security
fixes. Please make sure you are on the most recent version before reporting.

## Reporting a vulnerability

**Please do not report security vulnerabilities through public GitHub issues.**

Instead, report them privately one of these ways:

- Use GitHub's [**Report a vulnerability**](../../security/advisories/new)
  button (Security → Advisories), or
- Email **sascha@svilling.de** with the details.

Please include:

- A description of the issue and its potential impact
- Steps to reproduce, or a proof of concept
- The version of Desk and your operating system

You can expect an initial acknowledgement within a few days. Once the issue is
confirmed and fixed, a new release will be published and the advisory disclosed.

## Scope notes

Desk stores work content as plain Markdown. In local mode those files stay in
the data folder you choose; in self-hosted mode they live on the server you
operate. The hosted authentication database contains accounts and sessions, not
your workspace content.

External access is opt-in:

- **Smart Index:** when enabled, Desk sends file previews to the Anthropic or
  OpenAI provider you select so it can generate summaries. Local API keys are
  stored in the operating system's secure credential store. In hosted mode, the
  server operator supplies the provider key through an environment variable.
- **MCP:** a self-hosted server can grant an external AI client read-only access
  after an OAuth sign-in and consent flow. Per-workspace `.aiignore` rules are
  enforced by the read layer for tree, read, search, and catalog operations.

Desk does not include an in-app chatbot, and MCP clients cannot write workspace
content today.

If you find a way for data to leave your machine unexpectedly, that is in
scope — please report it.
