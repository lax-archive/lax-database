# LAX Database

Database resources for the LAX archive.

The default branch accepts publication commits only from the Lax Database
Publisher GitHub App. Each candidate commit is first pushed to a temporary
`lax-publish/**` branch, where the required `single-folder-change` check
verifies that it changes one `lax-<issue>` directory and only the three
canonical Archive filenames. The protected default branch rejects the commit
unless that check passes; force pushes and branch deletion are forbidden.
