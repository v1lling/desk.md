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

Desk is a **local-first** desktop app — your content stays in plain files on
your machine. Two things worth knowing:

- **AI features** (Smart Index, AI Chat, email drafting) send content to the
  AI provider you configure (e.g. Anthropic or OpenAI). This only happens when
  you enable and use those features.
- **API keys** are stored in your operating system's secure credential store
  where available.

If you find a way for data to leave your machine unexpectedly, that is in
scope — please report it.
